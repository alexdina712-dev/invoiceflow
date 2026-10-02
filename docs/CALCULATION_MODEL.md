# Calculation contract

All domain inputs are decimal strings. Exponent notation, commas, negatives, NaN, and excess decimal places are rejected. `decimal.js` uses 40 digits of working precision and explicit `ROUND_HALF_UP`.

For every line:

```text
base     = round2(quantity × unitPrice)
discount = round2(base × discountPercent / 100)
net      = base − discount
tax      = round2(net × taxRate / 100)
total    = net + tax
```

Invoice subtotal, discount, tax, and total are sums of the corresponding rounded line amounts. Example: 2 × 100, 10% discount, 20% tax = 200.00 base − 20.00 discount + 36.00 tax = 216.00 total.

Two lines of 0.333 × 1 at 20% tax each produce 0.33 base and 0.07 tax, for invoice subtotal 0.66, tax 0.14, total 0.80. This intentionally differs from taxing an unrounded aggregate.

Quantity: positive, maximum six integer and three fractional digits. Unit price: non-negative, maximum nine integer and two fractional digits. Discount/tax: 0–100%, two fractional digits. 1–100 lines; line base/total and invoice subtotal/total cannot exceed 1,000,000,000,000. Amount limits fit the persisted decimal columns.

The API strips unrecognized submitted fields and recomputes totals. Prisma decimals serialize as strings, sometimes without trailing zeros; display and CSV format them to two decimals. Browser number conversion is limited to presentation and chart height, never persisted calculations.

Revenue is the gross total of invoices marked Paid, including tax, grouped by payment timestamp. It does not subtract expenses or calculate accounting profit. Awaiting payment includes Sent and derived Overdue only; Draft and Cancelled are excluded. Each currency is reported separately. Changing currency relabels the invoice and requires reviewing all prices; service presets are filtered to the selected currency.

Dates are valid UTC calendar dates in 1970–2100. Overdue means Sent and due date earlier than the current UTC date. Due today is not overdue. Numbering is `IF-<issue year>-<user sequence padded to five digits>`; sequence is never reset or reused.
