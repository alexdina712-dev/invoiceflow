import { Router } from 'express';
import { db } from '../db.js';
import { serviceSchema } from '../../shared/validation.js';
import { ApiError } from '../errors.js';
import { lock } from '../services/invoices.js';
export const services = Router();
services.get('/', async (req, res) =>
  res.json(
    await db.service.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'desc' } }),
  ),
);
services.post('/', async (req, res) => {
  const data = serviceSchema.parse(req.body);
  const s = await db.$transaction(async (tx) => {
    await lock(tx, req.userId);
    if ((await tx.service.count({ where: { userId: req.userId } })) >= 100)
      throw new ApiError(400, 'Your workspace holds up to 100 service presets.');
    return tx.service.create({ data: { ...data, userId: req.userId } });
  });
  res.status(201).json(s);
});
services.patch('/:id', async (req, res) => {
  const data = serviceSchema.parse(req.body);
  const result = await db.service.updateMany({
    where: { id: String(req.params.id), userId: req.userId },
    data,
  });
  if (!result.count) throw new ApiError(404, 'Service not found.');
  res.json(await db.service.findUnique({ where: { id: String(req.params.id) } }));
});
services.delete('/:id', async (req, res) => {
  const result = await db.service.deleteMany({
    where: { id: String(req.params.id), userId: req.userId },
  });
  if (!result.count) throw new ApiError(404, 'Service not found.');
  res.status(204).end();
});
