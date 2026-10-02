import { Decimal } from 'decimal.js';
import { describe, it, expect } from 'vitest';
import { calculateInvoice, csv, effectiveStatus } from '../shared/calculations.js';
import { dateSchema } from '../shared/validation.js';
const line = {
  description: 'Consulting',
  unit: 'hour',
  quantity: '2',
  unitPrice: '100',
  discountPercent: '10',
  taxRate: '20',
};
describe('Invoice calculation contract', () => {
  it('rounds half-cent discounts upward', () =>
    expect(
      calculateInvoice([
        { ...line, quantity: '1', unitPrice: '0.05', discountPercent: '10', taxRate: '0' },
      ]),
    ).toMatchObject({ discountTotal: '0.01', total: '0.04' }));
  it('sums mixed tax rates without a blanket invoice rate', () =>
    expect(
      calculateInvoice(
        ['20', '0', '5'].map((taxRate) => ({
          ...line,
          quantity: '1',
          unitPrice: '100',
          discountPercent: '0',
          taxRate,
        })),
      ),
    ).toMatchObject({ subtotal: '300.00', taxTotal: '25.00', total: '325.00' }));
  it('maintains the monetary identity across many fractional lines', () => {
    const t = calculateInvoice(
      Array.from({ length: 75 }, (_, n) => ({
        ...line,
        quantity: '1.333',
        unitPrice: String(n + 1) + '.17',
        discountPercent: '12.5',
        taxRate: '19',
      })),
    );
    expect(
      new Decimal(t.total).plus(t.discountTotal).equals(new Decimal(t.subtotal).plus(t.taxTotal)),
    ).toBe(true);
  });

  it('discounts before tax with exact decimal totals', () =>
    expect(calculateInvoice([line])).toMatchObject({
      subtotal: '200.00',
      discountTotal: '20.00',
      taxTotal: '36.00',
      total: '216.00',
    }));
  it('avoids floating point drift', () =>
    expect(
      calculateInvoice([
        { ...line, quantity: '3', unitPrice: '0.10', discountPercent: '0', taxRate: '0' },
      ]).total,
    ).toBe('0.30'));
  it('rounds each line half up', () =>
    expect(
      calculateInvoice(
        Array(2).fill({ ...line, quantity: '0.333', unitPrice: '1', discountPercent: '0' }),
      ),
    ).toMatchObject({ subtotal: '0.66', taxTotal: '0.14', total: '0.80' }));
  it('supports full discounts', () =>
    expect(calculateInvoice([{ ...line, discountPercent: '100' }]).total).toBe('0.00'));
  it.each(['-1', 'NaN', '1e3', '1,20', '1.001'])('rejects invalid prices %s', (unitPrice) =>
    expect(() => calculateInvoice([{ ...line, unitPrice }])).toThrow(),
  );
  it('rejects zero quantities and excessive percentages', () => {
    expect(() => calculateInvoice([{ ...line, quantity: '0' }])).toThrow();
    expect(() => calculateInvoice([{ ...line, taxRate: '101' }])).toThrow();
  });
  it('bounds item count and amounts', () => {
    expect(() => calculateInvoice([])).toThrow();
    expect(() => calculateInvoice(Array(101).fill(line))).toThrow();
    expect(() =>
      calculateInvoice([{ ...line, quantity: '999999', unitPrice: '999999999' }]),
    ).toThrow();
  });
  it('derives overdue only from unpaid sent invoices', () => {
    expect(effectiveStatus({ status: 'SENT', dueDate: '2026-01-01' }, '2026-01-02')).toBe(
      'OVERDUE',
    );
    expect(effectiveStatus({ status: 'PAID', dueDate: '2026-01-01' }, '2026-01-02')).toBe('PAID');
    expect(effectiveStatus({ status: 'SENT', dueDate: '2026-01-02' }, '2026-01-02')).toBe('SENT');
  });
  it('rejects impossible calendar dates', () => {
    expect(dateSchema.safeParse('2026-02-30').success).toBe(false);
    expect(dateSchema.safeParse('2024-02-29').success).toBe(true);
  });
  it('quotes CSV and neutralizes spreadsheet formulas', () => {
    const result = csv([['Ștefan, Studio', '=SUM(A1)', 'a"b']]);
    expect(result.startsWith('\uFEFF')).toBe(true);
    expect(result).toContain("'=SUM(A1)");
    expect(result).toContain('a""b');
  });
});

// Independent integer-cent oracle exercises fractional quantities and percentages.
it('matches an integer arithmetic oracle for 500 generated invoice lines', () => {
  let seed = 20261002;
  const next = (max: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % max;
  };
  const format = (value: bigint) => `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
  const roundRatio = (n: bigint, d: bigint) => (n * 2n + d) / (d * 2n);
  for (let i = 0; i < 500; i++) {
    const quantityHundredths = BigInt(next(100000) + 1);
    const priceCents = BigInt(next(1000000));
    const discountHundredths = BigInt(next(10001));
    const taxHundredths = BigInt(next(10001));
    const base = roundRatio(quantityHundredths * priceCents, 100n);
    const discount = roundRatio(base * discountHundredths, 10000n);
    const tax = roundRatio((base - discount) * taxHundredths, 10000n);
    const result = calculateInvoice([
      {
        ...line,
        quantity: format(quantityHundredths),
        unitPrice: format(priceCents),
        discountPercent: format(discountHundredths),
        taxRate: format(taxHundredths),
      },
    ]);
    expect(result).toMatchObject({
      subtotal: format(base),
      discountTotal: format(discount),
      taxTotal: format(tax),
      total: format(base - discount + tax),
    });
  }
});
