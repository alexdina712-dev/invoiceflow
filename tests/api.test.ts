import 'dotenv/config';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../server/app.js';
import { db } from '../server/db.js';
import { writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const prefix = 'test-' + Date.now(),
  password = 'StrongPassword!2026',
  a = request.agent(app),
  b = request.agent(app);
let uid = '',
  other = '',
  client: any,
  invoice: any;
const profile = {
  name: 'Studio Ștefan',
  address: '10 Studio Street, Bucharest',
  country: 'Romania',
  email: 'studio@example.com',
  phone: '',
  taxId: 'TEST-VAT',
  paymentDetails: 'Pay by bank transfer.',
};
const line = {
  description: 'Design consulting',
  unit: 'hour',
  quantity: '2',
  unitPrice: '100',
  discountPercent: '10',
  taxRate: '20',
};
const draft = () => ({
  clientId: client.id,
  issueDate: '2026-01-01',
  dueDate: '2026-01-14',
  currency: 'EUR',
  notes: 'Thank you.',
  items: [line],
});
beforeAll(async () => {
  const x = await a
    .post('/api/auth/register')
    .send({ name: 'Test Studio', email: prefix + '@example.com', password });
  expect(x.status).toBe(201);
  uid = x.body.id;
  other = (
    await b
      .post('/api/auth/register')
      .send({ name: 'Other Studio', email: prefix + '-other@example.com', password })
  ).body.id;
});
afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: [uid, other].filter(Boolean) } } });
  await db.$disconnect();
});
describe('Private business API', () => {
  it('protects routes, validates registration, and hashes passwords', async () => {
    expect((await request(app).get('/api/workspace/invoices')).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/auth/register')
          .send({ name: 'A', email: 'no', password: 'x' })
      ).status,
    ).toBe(400);
    const u = await db.user.findUniqueOrThrow({ where: { id: uid } });
    expect(u.passwordHash).not.toBe(password);
    expect(u.passwordHash.startsWith('$2')).toBe(true);
    expect((await a.get('/api/auth/me')).body.email).toBe(prefix + '@example.com');
  });
  it('rejects wrong login and untrusted origins', async () => {
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: prefix + '@example.com', password: 'wrong' })
      ).status,
    ).toBe(401);
    expect(
      (await a.put('/api/workspace/profile').set('Origin', 'https://evil.example').send(profile))
        .status,
    ).toBe(403);
  });
  it('saves the seller profile and creates a validated client', async () => {
    expect((await a.put('/api/workspace/profile').send(profile)).status).toBe(200);
    expect((await a.post('/api/workspace/clients').send({ name: 'Bad' })).status).toBe(400);
    const r = await a
      .post('/api/workspace/clients')
      .send({ ...profile, name: 'Client One', kind: 'COMPANY', notes: 'Private' });
    expect(r.status).toBe(201);
    client = r.body;
    expect((await a.get('/api/workspace/clients')).body).toHaveLength(1);
  });
  it('supports client updates while enforcing ownership', async () => {
    expect(
      (await b.patch('/api/workspace/clients/' + client.id).send({ ...profile, name: 'Hijack' }))
        .status,
    ).toBe(404);
    expect((await b.delete('/api/workspace/clients/' + client.id)).status).toBe(404);
    expect(
      (
        await a
          .patch('/api/workspace/clients/' + client.id)
          .send({ ...profile, name: 'Client Updated' })
      ).status,
    ).toBe(200);
  });
  it('creates, edits, and deletes service presets', async () => {
    const service = {
      description: 'Consulting',
      unit: 'hour',
      unitPrice: '85.50',
      taxRate: '20',
      currency: 'GBP',
    };
    const r = await a.post('/api/workspace/services').send(service);
    expect(r.status).toBe(201);
    expect((await b.patch('/api/workspace/services/' + r.body.id).send(service)).status).toBe(404);
    expect(
      (await a.patch('/api/workspace/services/' + r.body.id).send({ ...service, unitPrice: '90' }))
        .body.unitPrice,
    ).toBe('90');
    expect((await a.delete('/api/workspace/services/' + r.body.id)).status).toBe(204);
  });
  it('computes totals on the server and snapshots the parties', async () => {
    const r = await a.post('/api/workspace/invoices').send({ ...draft(), total: '1.00' });
    expect(r.status).toBe(201);
    invoice = r.body;
    expect(invoice.total).toBe('216');
    expect(invoice.taxTotal).toBe('36');
    expect(invoice.clientSnapshot.name).toBe('Client Updated');
    expect(invoice.number).toMatch(/^IF-2026-00001$/);
  });
  it('validates dates, numeric strings, and foreign client IDs', async () => {
    expect(
      (await a.post('/api/workspace/invoices').send({ ...draft(), dueDate: '2025-12-01' })).status,
    ).toBe(400);
    expect(
      (
        await a
          .post('/api/workspace/invoices')
          .send({ ...draft(), items: [{ ...line, unitPrice: '1e5' }] })
      ).status,
    ).toBe(400);
    expect((await b.post('/api/workspace/invoices').send(draft())).status).toBe(404);
  });
  it('serializes concurrent invoice numbering', async () => {
    const responses = await Promise.all(
      Array.from({ length: 3 }, () => a.post('/api/workspace/invoices').send(draft())),
    );
    expect(responses.every((r) => r.status === 201)).toBe(true);
    expect(new Set(responses.map((r) => r.body.number)).size).toBe(3);
  });
  it('edits drafts with optimistic concurrency', async () => {
    const r = await a
      .patch('/api/workspace/invoices/' + invoice.id)
      .send({ ...draft(), revision: invoice.revision, notes: 'Updated draft' });
    expect(r.status).toBe(200);
    expect(
      (
        await a
          .patch('/api/workspace/invoices/' + invoice.id)
          .send({ ...draft(), revision: invoice.revision })
      ).status,
    ).toBe(409);
    invoice = r.body;
  });
  it('records manual delivery, derives overdue, and locks contents', async () => {
    const r = await a
      .patch('/api/workspace/invoices/' + invoice.id + '/status')
      .send({ status: 'SENT', revision: invoice.revision });
    expect(r.status).toBe(200);
    invoice = r.body;
    expect(invoice.effectiveStatus).toBe('OVERDUE');
    expect(
      (
        await a
          .patch('/api/workspace/invoices/' + invoice.id)
          .send({ ...draft(), revision: invoice.revision })
      ).status,
    ).toBe(409);
    expect((await a.delete('/api/workspace/invoices/' + invoice.id)).status).toBe(409);
  });
  it('keeps sent snapshots after client and seller updates', async () => {
    await a
      .patch('/api/workspace/clients/' + client.id)
      .send({ ...profile, name: 'New Client Name' });
    await a.put('/api/workspace/profile').send({ ...profile, name: 'New Seller Name' });
    const r = await a.get('/api/workspace/invoices/' + invoice.id);
    expect(r.body.clientSnapshot.name).toBe('Client Updated');
    expect(r.body.sellerSnapshot.name).toBe('Studio Ștefan');
  });
  it('checks ownership on every invoice action and PDF', async () => {
    for (const path of ['', '/pdf'])
      expect((await b.get('/api/workspace/invoices/' + invoice.id + path)).status).toBe(404);
    expect((await b.post('/api/workspace/invoices/' + invoice.id + '/duplicate')).status).toBe(404);
    expect(
      (
        await b
          .patch('/api/workspace/invoices/' + invoice.id + '/status')
          .send({ status: 'PAID', revision: invoice.revision })
      ).status,
    ).toBe(404);
    expect((await b.delete('/api/workspace/invoices/' + invoice.id)).status).toBe(404);
    expect((await b.get('/api/workspace/export/invoices')).text).not.toContain(invoice.number);
  });
  it('generates a real Unicode PDF with extractable invoice details', async () => {
    const r = await a
      .get('/api/workspace/invoices/' + invoice.id + '/pdf')
      .buffer(true)
      .parse((res, callback) => {
        const data: Buffer[] = [];
        res.on('data', (c) => data.push(c));
        res.on('end', () => callback(null, Buffer.concat(data)));
      });
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('application/pdf');
    expect(r.body.subarray(0, 5).toString()).toBe('%PDF-');
    const file = resolve('tests/pdf-check-' + Date.now() + '.pdf');
    writeFileSync(file, r.body);
    const code =
      "import {PDFParse} from 'pdf-parse';import {readFileSync} from 'node:fs';const p=new PDFParse({data:readFileSync(process.argv[1])});console.log((await p.getText()).text);await p.destroy();";
    const parsed = spawnSync(process.execPath, ['--input-type=module', '-e', code, file], {
      encoding: 'utf8',
      timeout: 20000,
    });
    unlinkSync(file);
    expect(parsed.status, parsed.stderr).toBe(0);
    expect(parsed.stdout).toContain(invoice.number);
    expect(parsed.stdout).toContain('Ștefan');
    expect(parsed.stdout).toContain('216.00');
  });
  it('paginates a 100-line Unicode PDF without losing rows', async () => {
    const r = await a
      .post('/api/workspace/invoices')
      .send({
        ...draft(),
        items: Array.from({ length: 100 }, (_, n) => ({
          ...line,
          description: 'Ștefan delivery item ' + (n + 1),
        })),
      });
    expect(r.status).toBe(201);
    const pdf = await a
      .get('/api/workspace/invoices/' + r.body.id + '/pdf')
      .buffer(true)
      .parse((res, cb) => {
        const parts: Buffer[] = [];
        res.on('data', (c) => parts.push(c));
        res.on('end', () => cb(null, Buffer.concat(parts)));
      });
    const file = resolve('tests/pdf-long-' + Date.now() + '.pdf');
    writeFileSync(file, pdf.body);
    const code =
      "import {PDFParse} from 'pdf-parse';import {readFileSync} from 'node:fs';const p=new PDFParse({data:readFileSync(process.argv[1])});const r=await p.getText();console.log(JSON.stringify({pages:r.total,text:r.text}));await p.destroy();";
    const parsed = spawnSync(process.execPath, ['--input-type=module', '-e', code, file], {
      encoding: 'utf8',
      timeout: 20000,
    });
    unlinkSync(file);
    expect(parsed.status, parsed.stderr).toBe(0);
    const data = JSON.parse(parsed.stdout);
    expect(data.pages).toBeGreaterThan(1);
    expect(data.text).toContain('delivery item 100');
    expect(data.text).toContain('21600.00');
    await a.delete('/api/workspace/invoices/' + r.body.id);
  });
  it('records payments and blocks terminal transitions', async () => {
    const r = await a
      .patch('/api/workspace/invoices/' + invoice.id + '/status')
      .send({ status: 'PAID', revision: invoice.revision });
    expect(r.status).toBe(200);
    invoice = r.body;
    expect(invoice.paidAt).toBeTruthy();
    expect(invoice.effectiveStatus).toBe('PAID');
    expect(
      (
        await a
          .patch('/api/workspace/invoices/' + invoice.id + '/status')
          .send({ status: 'CANCELLED', revision: invoice.revision })
      ).status,
    ).toBe(409);
  });
  it('duplicates with a new number, preserves amounts, and starts as a draft', async () => {
    const r = await a.post('/api/workspace/invoices/' + invoice.id + '/duplicate');
    expect(r.status).toBe(201);
    expect(r.body.number).not.toBe(invoice.number);
    expect(r.body.status).toBe('DRAFT');
    expect(r.body.total).toBe(invoice.total);
    expect((await a.delete('/api/workspace/invoices/' + r.body.id)).status).toBe(204);
  });
  it('filters invoices and exports proper CSV', async () => {
    const r = await a.get('/api/workspace/invoices?status=PAID&q=' + invoice.number);
    expect(r.body).toHaveLength(1);
    const csv = await a.get('/api/workspace/export/invoices?status=PAID');
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain(invoice.number);
    expect((await a.get('/api/workspace/invoices?from=2026-12-01&to=2026-01-01')).status).toBe(400);
  });
  it('deletes clients while preserving historical snapshots', async () => {
    expect((await a.delete('/api/workspace/clients/' + client.id)).status).toBe(204);
    const r = await a.get('/api/workspace/invoices/' + invoice.id);
    expect(r.body.clientId).toBeNull();
    expect(r.body.clientSnapshot.name).toBe('Client Updated');
  });
  it('revokes sessions on logout and can sign in again', async () => {
    expect((await a.post('/api/auth/logout')).status).toBe(204);
    expect((await a.get('/api/auth/me')).status).toBe(401);
    expect(
      (await a.post('/api/auth/login').send({ email: prefix + '@example.com', password })).status,
    ).toBe(200);
  });
  it('requires a password to delete the account and cascades records', async () => {
    expect((await a.delete('/api/workspace/account').send({ password: 'wrong' })).status).toBe(400);
    expect((await a.delete('/api/workspace/account').send({ password })).status).toBe(204);
    expect(await db.invoice.count({ where: { userId: uid } })).toBe(0);
    expect((await a.get('/api/auth/me')).status).toBe(401);
  });
});
