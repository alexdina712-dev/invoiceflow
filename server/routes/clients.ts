import { Router } from 'express';
import { db } from '../db.js';
import { clientSchema } from '../../shared/validation.js';
import { ApiError } from '../errors.js';
import { lock } from '../services/invoices.js';
export const clients = Router();
clients.get('/', async (req, res) =>
  res.json(
    await db.client.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'desc' } }),
  ),
);
clients.post('/', async (req, res) => {
  const data = clientSchema.parse(req.body);
  const c = await db.$transaction(async (tx) => {
    await lock(tx, req.userId);
    if ((await tx.client.count({ where: { userId: req.userId } })) >= 200)
      throw new ApiError(400, 'Your workspace holds up to 200 clients.');
    return tx.client.create({ data: { ...data, userId: req.userId } });
  });
  res.status(201).json(c);
});
clients.patch('/:id', async (req, res) => {
  const data = clientSchema.parse(req.body);
  const result = await db.client.updateMany({
    where: { id: String(req.params.id), userId: req.userId },
    data,
  });
  if (!result.count) throw new ApiError(404, 'Client not found.');
  res.json(await db.client.findUnique({ where: { id: String(req.params.id) } }));
});
clients.delete('/:id', async (req, res) => {
  const result = await db.client.deleteMany({
    where: { id: String(req.params.id), userId: req.userId },
  });
  if (!result.count) throw new ApiError(404, 'Client not found.');
  res.status(204).end();
});
