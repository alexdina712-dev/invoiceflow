import express from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { ApiError } from '../errors.js';
import { authenticate, issueSession, revokeSession } from '../auth.js';
import { loginSchema, registerSchema } from '../../shared/validation.js';
const person = { id: true, name: true, email: true } as const;
export const authRoutes = express.Router();
const authLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 50,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});
authRoutes.post('/register', authLimit, async (req, res) => {
  const input = registerSchema.parse(req.body);
  const user = await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 12),
      profile: { create: { name: input.name, email: input.email } },
    },
    select: person,
  });
  await issueSession(res, user.id);
  res.status(201).json(user);
});
authRoutes.post('/login', authLimit, async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await db.user.findUnique({ where: { email: input.email } });
  const valid = await bcrypt.compare(
    input.password,
    user?.passwordHash || '$2b$12$Gz1hB8j.vHwyLl0zn.WkEeGNFHAJcdI8C5RsEXaRXyjkRnzGXh9Pe',
  );
  if (!user || !valid) throw new ApiError(401, 'Email or password is incorrect.');
  await revokeSession(req, res);
  await issueSession(res, user.id);
  res.json({ id: user.id, name: user.name, email: user.email });
});
authRoutes.post('/logout', async (req, res) => {
  await revokeSession(req, res);
  res.status(204).end();
});
authRoutes.get('/me', authenticate, async (req, res) => {
  res.json(await db.user.findUnique({ where: { id: req.userId }, select: person }));
});
