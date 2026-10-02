import { z } from 'zod';
import { Decimal } from 'decimal.js';
export const currencies = ['EUR', 'RON', 'USD', 'GBP'] as const;
export const statusLabels = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'] as const;
const optionalText = (max: number) => z.string().trim().max(max).default('');
const decimal = (digits: number, places: number) =>
  z
    .string()
    .regex(
      new RegExp(`^\\d{1,${digits}}(?:\\.\\d{1,${places}})?$`),
      'Use a non-negative decimal, with no commas or exponent.',
    );
export const moneySchema = decimal(9, 2);
export const percentSchema = decimal(3, 2).refine(
  (s) => new Decimal(s).lte(100),
  'Percentage must be between 0 and 100.',
);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + 'T00:00:00Z');
    return (
      Number.isFinite(d.getTime()) &&
      d.toISOString().slice(0, 10) === s &&
      s >= '1970-01-01' &&
      s <= '2100-12-31'
    );
  }, 'Enter a valid date between 1970 and 2100.');
const password = z
  .string()
  .min(10)
  .max(72)
  .refine(
    (s) => new TextEncoder().encode(s).length <= 72,
    'Password must be at most 72 UTF-8 bytes.',
  );
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(1).max(72),
});
export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(80),
  password,
});
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(5).max(400),
  country: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  phone: optionalText(40),
  taxId: optionalText(80),
  paymentDetails: optionalText(1000),
});
export const clientSchema = profileSchema
  .omit({ paymentDetails: true })
  .extend({ kind: z.enum(['COMPANY', 'PERSON']).default('COMPANY'), notes: optionalText(2000) });
export const serviceSchema = z.object({
  description: z.string().trim().min(2).max(500),
  unit: z.string().trim().min(1).max(30),
  unitPrice: moneySchema,
  taxRate: percentSchema,
  currency: z.enum(currencies),
});
export const lineSchema = serviceSchema
  .omit({ currency: true })
  .extend({
    quantity: decimal(6, 3).refine(
      (s) => new Decimal(s).gt(0),
      'Quantity must be greater than zero.',
    ),
    discountPercent: percentSchema,
  });
export const invoiceSchema = z
  .object({
    clientId: z.string().min(1).max(100),
    issueDate: dateSchema,
    dueDate: dateSchema,
    currency: z.enum(currencies),
    notes: optionalText(2000),
    items: z.array(lineSchema).min(1).max(100),
    revision: z.number().int().positive().optional(),
  })
  .refine((v) => v.dueDate >= v.issueDate, {
    message: 'Due date cannot be before the issue date.',
    path: ['dueDate'],
  });
export const transitionSchema = z.object({
  status: z.enum(['SENT', 'PAID', 'CANCELLED']),
  revision: z.number().int().positive(),
});
export const querySchema = z
  .object({
    q: z.string().max(120).optional(),
    clientId: z.string().max(100).optional(),
    status: z.enum(statusLabels).optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    currency: z.enum(currencies).optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, 'Date range must start before it ends.');
export type LineInput = z.infer<typeof lineSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type Currency = (typeof currencies)[number];
