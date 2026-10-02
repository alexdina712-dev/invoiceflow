import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { querySchema, transitionSchema } from '../../shared/validation.js';
import { ApiError } from '../errors.js';
import {
  include,
  present,
  createInvoice,
  editInvoice,
  transition,
  duplicate,
  ownInvoice,
  lock,
} from '../services/invoices.js';
import { invoicePdf } from '../services/pdf.js';
export const invoices = Router();
export async function filtered(userId: string, query: unknown) {
  const q = querySchema.parse(query);
  const all = await db.invoice.findMany({
    where: {
      userId,
      ...(q.clientId ? { clientId: q.clientId } : {}),
      ...(q.currency ? { currency: q.currency } : {}),
      ...(q.from || q.to
        ? {
            issueDate: {
              ...(q.from ? { gte: new Date(q.from + 'T00:00:00Z') } : {}),
              ...(q.to ? { lte: new Date(q.to + 'T00:00:00Z') } : {}),
            },
          }
        : {}),
    },
    include,
    orderBy: { createdAt: 'desc' },
  });
  return all
    .map(present)
    .filter(
      (i) =>
        (!q.status || i.effectiveStatus === q.status) &&
        (!q.q ||
          `${i.number} ${(i.clientSnapshot as any).name}`
            .toLowerCase()
            .includes(q.q.toLowerCase())),
    );
}
invoices.get('/', async (req, res) => res.json(await filtered(req.userId, req.query)));
invoices.post('/', async (req, res) =>
  res.status(201).json(await createInvoice(req.userId, req.body)),
);
invoices.get('/:id', async (req, res) =>
  res.json(present(await ownInvoice(db, String(req.params.id), req.userId))),
);
invoices.patch('/:id', async (req, res) =>
  res.json(await editInvoice(req.userId, String(req.params.id), req.body)),
);
invoices.post('/:id/duplicate', async (req, res) =>
  res.status(201).json(await duplicate(req.userId, String(req.params.id))),
);
invoices.patch('/:id/status', async (req, res) => {
  const input = transitionSchema.parse(req.body);
  res.json(await transition(req.userId, String(req.params.id), input.status, input.revision));
});
invoices.delete('/:id', async (req, res) => {
  await db.$transaction(async (tx) => {
    await lock(tx, req.userId);
    const i = await ownInvoice(tx, String(req.params.id), req.userId);
    if (i.status !== 'DRAFT')
      throw new ApiError(
        409,
        'Only drafts can be deleted. Cancel an issued unpaid invoice instead.',
      );
    await tx.invoice.delete({ where: { id: i.id } });
  });
  res.status(204).end();
});
const pdfLimit = rateLimit({
  windowMs: 60000,
  limit: 30,
  keyGenerator: (req) => req.userId,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many PDF downloads. Try again in a minute.' },
});
invoices.get('/:id/pdf', pdfLimit, async (req, res) => {
  const i = present(await ownInvoice(db, String(req.params.id), req.userId));
  const file = await invoicePdf(i);
  res
    .set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${i.number}.pdf"`,
    })
    .send(file);
});
