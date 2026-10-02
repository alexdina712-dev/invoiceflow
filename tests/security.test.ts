import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../server/app.js';
import { db } from '../server/db.js';
const created: string[] = [];
afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: created } } });
  await db.$disconnect();
});
describe('request boundary security', () => {
  it('rejects oversized JSON without caching or echoing content', async () => {
    const r = await request(app)
      .post('/api/auth/login')
      .send({ payload: 'x'.repeat(512 * 1024 + 1) });
    expect(r.status).toBe(413);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body.error).toMatch(/limit|large/i);
    expect(JSON.stringify(r.body).length).toBeLessThan(200);
  });
  it('does not cache malformed JSON errors', async () => {
    const r = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{invalid');
    expect(r.status).toBe(400);
    expect(r.headers['cache-control']).toBe('no-store');
  });
  it('enforces the bcrypt byte boundary for login and deletion', async () => {
    const password = '\u5bc6'.repeat(24); // Exactly 72 UTF-8 bytes.
    const email = `boundary-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    const client = request.agent(app);
    const registered = await client
      .post('/api/auth/register')
      .send({ name: 'Boundary Tester', email, password });
    expect(registered.status).toBe(201);
    created.push(registered.body.id);
    expect((await client.post('/api/auth/login').send({ email, password })).status).toBe(200);
    expect(
      (await client.delete('/api/workspace/account').send({ password: password + 'x' })).status,
    ).toBe(400);
    expect((await client.get('/api/auth/me')).status).toBe(200);
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email, password: password + 'x' })
      ).status,
    ).toBe(400);
  });
});
