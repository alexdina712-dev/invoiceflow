import PDFDocument from 'pdfkit';
import { resolve } from 'node:path';
import { Decimal } from 'decimal.js';
export function invoicePdf(invoice: any): Promise<Buffer> {
  return new Promise((resolveBuffer, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 44,
      bufferPages: true,
      info: { Title: invoice.number, Author: invoice.sellerSnapshot.name },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolveBuffer(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('Regular', resolve('assets/fonts/NotoSans-Regular.ttf'));
    doc.registerFont('Bold', resolve('assets/fonts/NotoSans-Bold.ttf'));
    const money = (v: any) => new Decimal(String(v)).toFixed(2);
    let y = 44;
    const text = (v: string, x: number, top: number, width: number, size = 10, bold = false) => {
      doc
        .font(bold ? 'Bold' : 'Regular')
        .fontSize(size)
        .fillColor('#173d38')
        .text(v, x, top, { width });
    };
    const ensure = (height: number) => {
      if (y + height > 740) {
        doc.addPage();
        y = 44;
        text(invoice.number, 44, y, 500, 12, true);
        y += 35;
      }
    };
    text('InvoiceFlow', 44, y, 300, 22, true);
    text('INVOICE', 400, y, 150, 18, true);
    y += 42;
    text(invoice.number + ' · ' + invoice.effectiveStatus, 44, y, 500, 13, true);
    y += 28;
    text(
      'Issued ' +
        new Date(invoice.issueDate).toISOString().slice(0, 10) +
        '    Due ' +
        new Date(invoice.dueDate).toISOString().slice(0, 10),
      44,
      y,
      500,
    );
    y += 35;
    const party = (p: any) =>
      [p.name, p.address, p.country, p.email, p.phone, p.taxId ? 'Tax / VAT ID: ' + p.taxId : '']
        .filter(Boolean)
        .join('\n');
    text('FROM', 44, y, 235, 9, true);
    text('BILL TO', 315, y, 235, 9, true);
    y += 20;
    const seller = party(invoice.sellerSnapshot),
      client = party(invoice.clientSnapshot);
    doc.font('Regular').fontSize(10);
    const height = Math.max(
      doc.heightOfString(seller, { width: 235 }),
      doc.heightOfString(client, { width: 235 }),
    );
    text(seller, 44, y, 235);
    text(client, 315, y, 235);
    y += height + 30;
    const header = () => {
      text('DESCRIPTION', 44, y, 210, 9, true);
      text('QTY', 263, y, 45, 9, true);
      text('PRICE', 310, y, 75, 9, true);
      text('TAX', 390, y, 45, 9, true);
      text('TOTAL', 455, y, 95, 9, true);
      y += 25;
    };
    header();
    for (const item of invoice.items) {
      const label =
        item.description +
        '\n' +
        item.unit +
        (new Decimal(String(item.discountPercent)).gt(0)
          ? ' · ' + item.discountPercent + '% discount'
          : '');
      doc.font('Regular').fontSize(10);
      const h = Math.max(46, doc.heightOfString(label, { width: 205 }) + 15);
      if (y + h > 740) {
        ensure(h);
        header();
      }
      text(label, 44, y, 205);
      text(String(item.quantity), 263, y, 45);
      text(money(item.unitPrice), 310, y, 75);
      text(String(item.taxRate) + '%', 390, y, 60);
      text(money(item.total), 455, y, 95, 10, true);
      y += h;
      doc
        .strokeColor('#dde5e1')
        .moveTo(44, y - 8)
        .lineTo(550, y - 8)
        .stroke();
    }
    ensure(150);
    y += 12;
    for (const [label, value] of [
      ['Subtotal', invoice.subtotal],
      ['Discount', invoice.discountTotal],
      ['Tax', invoice.taxTotal],
    ]) {
      text(String(label), 315, y, 120);
      text(money(value), 455, y, 95);
      y += 25;
    }
    text('TOTAL ' + invoice.currency, 315, y, 140, 12, true);
    text(money(invoice.total), 455, y, 95, 12, true);
    y += 45;
    for (const [label, value] of [
      ['Payment details', invoice.sellerSnapshot.paymentDetails],
      ['Notes', invoice.notes],
    ]) {
      if (!value) continue;
      doc.font('Regular').fontSize(10);
      const h = doc.heightOfString(String(value), { width: 500 });
      ensure(h + 45);
      text(label, 44, y, 500, 10, true);
      y += 20;
      text(String(value), 44, y, 500);
      y += h + 25;
    }
    const pages = doc.bufferedPageRange();
    for (let n = 0; n < pages.count; n++) {
      doc.switchToPage(n);
      text(
        invoice.status === 'DRAFT' ? 'DRAFT — not issued' : 'Thank you for your business.',
        44,
        778,
        400,
        8,
      );
      text(n + 1 + ' / ' + pages.count, 485, 778, 65, 8);
    }
    doc.end();
  });
}
