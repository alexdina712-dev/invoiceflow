import { Prisma } from '@prisma/client';
import { db } from '../db.js';
import { ApiError } from '../errors.js';
import { calculateInvoice, effectiveStatus } from '../../shared/calculations.js';
import { invoiceSchema, profileSchema, type InvoiceInput } from '../../shared/validation.js';
export const include = {
  items: { orderBy: { position: 'asc' as const } },
  events: { orderBy: { createdAt: 'desc' as const } },
};
export const present = (i: any) => ({ ...i, effectiveStatus: effectiveStatus(i) });
export async function lock(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
}
export const party = (p: any) => ({
  name: p.name,
  address: p.address,
  country: p.country,
  email: p.email,
  phone: p.phone,
  taxId: p.taxId,
});
function amounts(input: InvoiceInput) {
  try {
    return calculateInvoice(input.items);
  } catch (e) {
    if (e instanceof RangeError) throw new ApiError(400, e.message);
    throw e;
  }
}
export async function ownInvoice(
  tx: Prisma.TransactionClient | typeof db,
  id: string,
  userId: string,
) {
  const invoice = await tx.invoice.findFirst({ where: { id, userId }, include });
  if (!invoice) throw new ApiError(404, 'Invoice not found.');
  return invoice;
}
async function source(tx: Prisma.TransactionClient, input: InvoiceInput, userId: string) {
  const [profile, client] = await Promise.all([
    tx.businessProfile.findUnique({ where: { userId } }),
    tx.client.findFirst({ where: { id: input.clientId, userId } }),
  ]);
  if (!client) throw new ApiError(404, 'Client not found.');
  if (!profile || !profileSchema.safeParse(profile).success)
    throw new ApiError(400, 'Complete your business profile before creating an invoice.');
  return {
    sellerSnapshot: { ...party(profile), paymentDetails: profile.paymentDetails },
    clientSnapshot: party(client),
  };
}
function rows(t: ReturnType<typeof calculateInvoice>) {
  return t.items.map((i, position) => ({ ...i, position }));
}
async function number(tx: Prisma.TransactionClient, userId: string, issueDate: string) {
  const u = await tx.user.update({
    where: { id: userId },
    data: { invoiceSequence: { increment: 1 } },
  });
  return `IF-${issueDate.slice(0, 4)}-${String(u.invoiceSequence).padStart(5, '0')}`;
}
export async function createInvoice(userId: string, raw: unknown) {
  const input = invoiceSchema.parse(raw),
    t = amounts(input);
  return db.$transaction(async (tx) => {
    await lock(tx, userId);
    if ((await tx.invoice.count({ where: { userId } })) >= 500)
      throw new ApiError(400, 'Your portfolio workspace holds up to 500 invoices.');
    const snapshots = await source(tx, input, userId);
    return present(
      await tx.invoice.create({
        data: {
          userId,
          clientId: input.clientId,
          number: await number(tx, userId, input.issueDate),
          issueDate: new Date(input.issueDate + 'T00:00:00Z'),
          dueDate: new Date(input.dueDate + 'T00:00:00Z'),
          currency: input.currency,
          notes: input.notes,
          ...snapshots,
          subtotal: t.subtotal,
          discountTotal: t.discountTotal,
          taxTotal: t.taxTotal,
          total: t.total,
          items: { create: rows(t) },
          events: { create: { action: 'Draft created' } },
        },
        include,
      }),
    );
  });
}
export async function editInvoice(userId: string, id: string, raw: unknown) {
  const input = invoiceSchema.parse(raw);
  if (!input.revision) throw new ApiError(400, 'A revision is required to edit this draft.');
  const t = amounts(input);
  return db.$transaction(async (tx) => {
    await lock(tx, userId);
    const i = await ownInvoice(tx, id, userId);
    if (i.status !== 'DRAFT')
      throw new ApiError(
        409,
        'Issued invoices are immutable. Duplicate this invoice to make a new draft.',
      );
    if (i.revision !== input.revision)
      throw new ApiError(409, 'This invoice changed in another tab. Refresh before editing.');
    const snapshots = await source(tx, input, userId);
    await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
    return present(
      await tx.invoice.update({
        where: { id },
        data: {
          clientId: input.clientId,
          issueDate: new Date(input.issueDate + 'T00:00:00Z'),
          dueDate: new Date(input.dueDate + 'T00:00:00Z'),
          currency: input.currency,
          notes: input.notes,
          ...snapshots,
          subtotal: t.subtotal,
          discountTotal: t.discountTotal,
          taxTotal: t.taxTotal,
          total: t.total,
          revision: { increment: 1 },
          items: { create: rows(t) },
          events: { create: { action: 'Draft updated' } },
        },
        include,
      }),
    );
  });
}
export async function transition(
  userId: string,
  id: string,
  status: 'SENT' | 'PAID' | 'CANCELLED',
  revision: number,
) {
  return db.$transaction(async (tx) => {
    await lock(tx, userId);
    const i = await ownInvoice(tx, id, userId);
    if (i.revision !== revision)
      throw new ApiError(409, 'This invoice changed. Refresh before updating its status.');
    const allowed: Record<string, string[]> = {
      DRAFT: ['SENT', 'CANCELLED'],
      SENT: ['PAID', 'CANCELLED'],
      PAID: [],
      CANCELLED: [],
    };
    if (!allowed[i.status].includes(status))
      throw new ApiError(409, 'This status change is not allowed.');
    return present(
      await tx.invoice.update({
        where: { id },
        data: {
          status,
          revision: { increment: 1 },
          ...(status === 'SENT' ? { sentAt: new Date() } : {}),
          ...(status === 'PAID' ? { paidAt: new Date() } : {}),
          events: {
            create: {
              action:
                status === 'SENT'
                  ? 'Marked as sent (manual delivery)'
                  : status === 'PAID'
                    ? 'Payment recorded'
                    : 'Invoice cancelled',
            },
          },
        },
        include,
      }),
    );
  });
}
export async function duplicate(userId: string, id: string) {
  return db.$transaction(async (tx) => {
    await lock(tx, userId);
    const original = await ownInvoice(tx, id, userId);
    if ((await tx.invoice.count({ where: { userId } })) >= 500)
      throw new ApiError(400, 'Your workspace holds up to 500 invoices.');
    const today = new Date().toISOString().slice(0, 10),
      due = new Date(Date.now() + 14 * 86400000);
    return present(
      await tx.invoice.create({
        data: {
          userId,
          clientId: original.clientId,
          number: await number(tx, userId, today),
          issueDate: new Date(today + 'T00:00:00Z'),
          dueDate: due,
          currency: original.currency,
          notes: original.notes,
          sellerSnapshot: original.sellerSnapshot!,
          clientSnapshot: original.clientSnapshot!,
          subtotal: original.subtotal,
          discountTotal: original.discountTotal,
          taxTotal: original.taxTotal,
          total: original.total,
          items: { create: original.items.map(({ id, invoiceId, ...i }) => i) },
          events: { create: { action: 'Duplicated from ' + original.number } },
        },
        include,
      }),
    );
  });
}
