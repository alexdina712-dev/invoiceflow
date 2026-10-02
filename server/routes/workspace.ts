import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db.js';
import { ApiError } from '../errors.js';
import { revokeSession } from '../auth.js';
import { profileSchema, loginSchema } from '../../shared/validation.js';
import { clients } from './clients.js';
import { services } from './services.js';
import { invoices, filtered } from './invoices.js';
import { csv } from '../../shared/calculations.js';
export const workspaceRoutes = Router();
workspaceRoutes.use('/clients', clients);
workspaceRoutes.use('/services', services);
workspaceRoutes.use('/invoices', invoices);
workspaceRoutes.get('/profile', async (req, res) =>
  res.json(await db.businessProfile.findUnique({ where: { userId: req.userId } })),
);
workspaceRoutes.put('/profile', async (req, res) => {
  const data = profileSchema.parse(req.body);
  res.json(
    await db.businessProfile.upsert({
      where: { userId: req.userId },
      create: { ...data, userId: req.userId },
      update: data,
    }),
  );
});
workspaceRoutes.get('/export/clients', async (req, res) => {
  const c = await db.client.findMany({ where: { userId: req.userId }, orderBy: { name: 'asc' } });
  res
    .set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="invoiceflow-clients.csv"',
    })
    .send(
      csv([
        ['Name', 'Type', 'Address', 'Country', 'Email', 'Phone', 'Tax ID', 'Notes'],
        ...c.map((c) => [c.name, c.kind, c.address, c.country, c.email, c.phone, c.taxId, c.notes]),
      ]),
    );
});
workspaceRoutes.get('/export/invoices', async (req, res) => {
  const rows = await filtered(req.userId, req.query);
  res
    .set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="invoiceflow-invoices.csv"',
    })
    .send(
      csv([
        [
          'Number',
          'Issue date',
          'Due date',
          'Client',
          'Currency',
          'Status',
          'Subtotal',
          'Discount',
          'Tax',
          'Total',
          'Paid at',
        ],
        ...rows.map((i) => [
          i.number,
          i.issueDate.toISOString().slice(0, 10),
          i.dueDate.toISOString().slice(0, 10),
          (i.clientSnapshot as any).name,
          i.currency,
          i.effectiveStatus,
          i.subtotal.toFixed(2),
          i.discountTotal.toFixed(2),
          i.taxTotal.toFixed(2),
          i.total.toFixed(2),
          i.paidAt?.toISOString() || '',
        ]),
      ]),
    );
});
workspaceRoutes.delete('/account', async (req, res) => {
  const { password } = z.object({ password: loginSchema.shape.password }).parse(req.body);
  const user = await db.user.findUnique({ where: { id: req.userId } });
  if (user?.email === 'demo@invoiceflow.app')
    throw new ApiError(403, 'The fictional demo account cannot be deleted.');
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    throw new ApiError(400, 'Password is incorrect.');
  await db.user.delete({ where: { id: req.userId } });
  await revokeSession(req, res);
  res.status(204).end();
});
