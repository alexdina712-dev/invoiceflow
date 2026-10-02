import { Decimal } from 'decimal.js';
import { lineSchema, type LineInput } from './validation.js';
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const round = (n: Decimal) => n.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
export function calculateInvoice(input: LineInput[]) {
  if (!input.length || input.length > 100)
    throw new RangeError('An invoice needs 1–100 line items.');
  const lines = input.map((raw) => {
    const item = lineSchema.parse(raw);
    const base = round(new D(item.quantity).mul(item.unitPrice));
    const discount = round(base.mul(item.discountPercent).div(100));
    const net = base.minus(discount);
    const tax = round(net.mul(item.taxRate).div(100));
    const total = net.plus(tax);
    if (base.gt('1000000000000') || total.gt('1000000000000'))
      throw new RangeError('Invoice amounts cannot exceed one trillion per currency.');
    return {
      ...item,
      base: base.toFixed(2),
      discount: discount.toFixed(2),
      net: net.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
    };
  });
  const sum = (key: 'base' | 'discount' | 'tax' | 'total') =>
    lines.reduce((total, l) => total.plus(l[key]), new D(0));
  const subtotal = sum('base'),
    total = sum('total');
  if (subtotal.gt('1000000000000') || total.gt('1000000000000'))
    throw new RangeError('Invoice amounts cannot exceed one trillion per currency.');
  return {
    items: lines,
    subtotal: subtotal.toFixed(2),
    discountTotal: sum('discount').toFixed(2),
    taxTotal: sum('tax').toFixed(2),
    total: total.toFixed(2),
  };
}
export const todayUtc = () => new Date().toISOString().slice(0, 10);
export function effectiveStatus(
  invoice: { status: string; dueDate: string | Date },
  today = todayUtc(),
) {
  const due =
    typeof invoice.dueDate === 'string'
      ? invoice.dueDate.slice(0, 10)
      : invoice.dueDate.toISOString().slice(0, 10);
  return invoice.status === 'SENT' && due < today ? 'OVERDUE' : invoice.status;
}
export function sumMoney(values: string[]) {
  return values.reduce((n, v) => n.plus(v), new D(0)).toFixed(2);
}
export function csv(rows: (string | number)[][]) {
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((raw) => {
            let value = String(raw);
            if (/^[\s]*[=+\-@\t\r]/.test(value)) value = "'" + value;
            return '"' + value.replaceAll('"', '""') + '"';
          })
          .join(','),
      )
      .join('\r\n')
  );
}
