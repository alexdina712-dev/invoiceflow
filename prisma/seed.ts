import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../server/db.js';
import { calculateInvoice } from '../shared/calculations.js';
import { party } from '../server/services/invoices.js';
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true')
  throw new Error('Explicit ALLOW_DEMO_SEED=true required for production seed.');
const email = 'demo@invoiceflow.app';
const existing = await db.user.findUnique({ where: { email } });
if (existing) {
  console.log('Demo already exists; seed does not overwrite workspace changes.');
  await db.$disconnect();
  process.exit(0);
}
const seller = {
  name: 'Northline Studio',
  address: '18 Linden Street, Suite 4\nBucharest 010101',
  country: 'Romania',
  email: 'hello@northline.example',
  phone: '+40 700 000 101',
  taxId: 'RO-DEMO-28461',
  paymentDetails:
    'Bank transfer reference: invoice number.\nDemo account only — no real banking details.',
};
const u = await db.user.create({
  data: {
    name: 'Alex Morgan',
    email,
    passwordHash: await bcrypt.hash('InvoiceFlowDemo!2026', 12),
    profile: { create: seller },
  },
});
const names = [
  'Evergreen Coffee Co.',
  'Forma Architecture',
  'Brightside Digital',
  'Atelier Ștefan',
  'Harbor & Co.',
  'Cedar Creative',
];
const clients = [];
for (const [n, name] of names.entries())
  clients.push(
    await db.client.create({
      data: {
        userId: u.id,
        kind: n === 3 ? 'PERSON' : 'COMPANY',
        name,
        address: 20 + n + ' Market Lane, Office ' + (n + 1),
        country: ['Germany', 'Romania', 'United Kingdom', 'Romania', 'United States', 'France'][n],
        email: 'accounts' + n + '@example.com',
        phone: '+40 700 000 10' + n,
        taxId: 'DEMO-' + (1000 + n),
        notes: 'Fictional portfolio client. Contact details are not real.',
      },
    }),
  );
const presets = [
  ['Website design', 'project', '2200', '20', 'EUR'],
  ['Brand identity', 'project', '1500', '20', 'EUR'],
  ['Development consulting', 'hour', '85', '20', 'EUR'],
  ['Monthly maintenance', 'month', '240', '20', 'EUR'],
  ['UX discovery workshop', 'day', '650', '0', 'GBP'],
  ['Design sprint', 'project', '7500', '19', 'RON'],
  ['Technical audit', 'project', '950', '0', 'USD'],
];
for (const [description, unit, unitPrice, taxRate, currency] of presets)
  await db.service.create({
    data: { userId: u.id, description, unit, unitPrice, taxRate, currency: currency as any },
  });
const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return new Date(d.toISOString().slice(0, 10) + 'T00:00:00Z');
};
for (let n = 0; n < 20; n++) {
  const paid = n < 12,
    status = paid ? 'PAID' : n < 17 ? 'SENT' : n === 19 ? 'CANCELLED' : 'DRAFT',
    currency = n === 14 ? 'USD' : n === 15 ? 'GBP' : n === 16 ? 'RON' : 'EUR';
  const item = {
    description: [
      'Website design & development',
      'Brand identity package',
      'Development consulting',
      'Monthly website maintenance',
    ][n % 4],
    unit: n % 4 === 2 ? 'hour' : 'project',
    quantity: n % 4 === 2 ? '12' : '1',
    unitPrice:
      currency === 'RON' ? '7500' : n % 4 === 2 ? '85' : String([2200, 1500, 85, 240][n % 4]),
    discountPercent: n % 5 === 0 ? '5' : '0',
    taxRate: currency === 'USD' || currency === 'GBP' ? '0' : '20',
  };
  const t = calculateInvoice([item]);
  const issue = day(paid ? -150 + n * 12 : n === 12 ? -35 : -18 + (n % 5) * 5);
  await db.invoice.create({
    data: {
      userId: u.id,
      clientId: clients[n % 6].id,
      number: 'IF-' + issue.getUTCFullYear() + '-' + String(n + 1).padStart(5, '0'),
      issueDate: issue,
      dueDate: new Date(issue.getTime() + 14 * 86400000),
      currency: currency as any,
      status: status as any,
      sellerSnapshot: seller,
      clientSnapshot: party(clients[n % 6]),
      notes: 'Thank you for trusting Northline Studio. This invoice is fictional demo data.',
      subtotal: t.subtotal,
      discountTotal: t.discountTotal,
      taxTotal: t.taxTotal,
      total: t.total,
      sentAt: status !== 'DRAFT' ? issue : null,
      paidAt: paid ? new Date(issue.getTime() + 7 * 86400000) : null,
      items: { create: t.items.map((i, position) => ({ ...i, position })) },
      events: {
        create: [
          { action: 'Draft created', createdAt: issue },
          ...(status !== 'DRAFT'
            ? [
                {
                  action: paid
                    ? 'Payment recorded'
                    : status === 'CANCELLED'
                      ? 'Invoice cancelled'
                      : 'Marked as sent (manual delivery)',
                  createdAt: paid ? new Date(issue.getTime() + 7 * 86400000) : issue,
                },
              ]
            : []),
        ],
      },
    },
  });
}
await db.user.update({ where: { id: u.id }, data: { invoiceSequence: 20 } });
console.log('InvoiceFlow fictional demo ready: demo@invoiceflow.app / InvoiceFlowDemo!2026');
await db.$disconnect();
