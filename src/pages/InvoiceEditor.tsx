import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import { api, send } from '../lib/api';
import { currencies, invoiceSchema, type LineInput, type Currency } from '../../shared/validation';
import { calculateInvoice, todayUtc } from '../../shared/calculations';
import type { Invoice } from '../../shared/types';
import { PageHeading, ErrorMessage } from '../components/ui';
import { money, FormActions } from '../components/forms';
const blank = (): LineInput => ({
  description: '',
  unit: 'hour',
  quantity: '1',
  unitPrice: '0',
  discountPercent: '0',
  taxRate: '0',
});
export function InvoiceEditor() {
  const { id } = useParams(),
    { invoices, clients, services, profile, reload } = useWorkspace(),
    navigate = useNavigate(),
    original = invoices.find((i) => i.id === id);
  const [clientId, setClient] = useState(original?.clientId || ''),
    [currency, setCurrency] = useState<Currency>(original?.currency || 'EUR'),
    [issueDate, setIssue] = useState(original?.issueDate.slice(0, 10) || todayUtc()),
    [dueDate, setDue] = useState(
      original?.dueDate.slice(0, 10) ||
        new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    ),
    [items, setItems] = useState<LineInput[]>(
      original?.items.map(
        ({ description, unit, quantity, unitPrice, discountPercent, taxRate }) => ({
          description,
          unit,
          quantity,
          unitPrice,
          discountPercent,
          taxRate,
        }),
      ) || [blank()],
    ),
    [notes, setNotes] = useState(original?.notes || ''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  let totals: ReturnType<typeof calculateInvoice> | null = null;
  try {
    totals = calculateInvoice(items);
  } catch {}
  function update(n: number, key: keyof LineInput, value: string) {
    setItems(items.map((item, index) => (index === n ? { ...item, [key]: value } : item)));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = invoiceSchema.parse({
        clientId,
        currency,
        issueDate,
        dueDate,
        items,
        notes,
        ...(original ? { revision: original.revision } : {}),
      });
      const result = await api<Invoice>(
        '/workspace/invoices' + (original ? '/' + original.id : ''),
        send(original ? 'PATCH' : 'POST', payload),
      );
      await reload();
      navigate('/invoices/' + result.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (id && !original)
    return (
      <div className="empty">
        <h2>Invoice not found</h2>
        <Link to="/invoices">Back to invoices</Link>
      </div>
    );
  if (original?.status && original.status !== 'DRAFT')
    return (
      <div className="empty">
        <h2>Issued invoices cannot be edited</h2>
        <Link to={'/invoices/' + id}>View invoice</Link>
      </div>
    );
  return (
    <>
      <PageHeading
        eyebrow="MAKE YOUR WORK COUNT"
        title={original ? 'Edit draft' : 'Create invoice'}
        description="Clear details. Accurate totals. A professional first impression."
      />
      <form onSubmit={submit}>
        <section className="card editor-section">
          <div className="section-heading">
            <h2>Invoice details</h2>
            <span>{original?.number || 'Number assigned when saved'}</span>
          </div>
          <div className="form-grid four">
            <label>
              Client
              <select
                aria-label="Client"
                required
                value={clientId}
                onChange={(e) => setClient(e.target.value)}
              >
                <option value="">Choose a client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Currency
              <select
                aria-label="Currency"
                value={currency}
                onChange={(e) => {
                  if (
                    items.some((i) => i.unitPrice !== '0') &&
                    !confirm(
                      'Change currency? Amounts stay the same; review every price. No conversion is performed.',
                    )
                  )
                    return;
                  setCurrency(e.target.value as Currency);
                }}
              >
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Issue date
              <input
                type="date"
                required
                aria-label="Issue date"
                value={issueDate}
                onChange={(e) => setIssue(e.target.value)}
              />
            </label>
            <label>
              Due date
              <input
                type="date"
                min={issueDate}
                required
                aria-label="Due date"
                value={dueDate}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
          </div>
          <p className="small">
            Seller: {profile.name} · <Link to="/settings">Business settings</Link>
          </p>
          {(!profile.address || !profile.country) && (
            <p className="error">
              Add your seller address and country in Business settings before saving.
            </p>
          )}
          {!clients.length && (
            <p className="callout">
              Add a client first. <Link to="/clients">Go to clients →</Link>
            </p>
          )}
        </section>
        <section className="card editor-section">
          <div className="section-heading">
            <h2>Line items</h2>
            <select
              aria-label="Add service preset"
              value=""
              onChange={(e) => {
                const s = services.find((s) => s.id === e.target.value);
                if (s)
                  setItems([
                    ...items.filter((i, n) => !(items.length === 1 && n === 0 && !i.description)),
                    {
                      description: s.description,
                      unit: s.unit,
                      quantity: '1',
                      unitPrice: s.unitPrice,
                      discountPercent: '0',
                      taxRate: s.taxRate,
                    },
                  ]);
              }}
              disabled={items.length >= 100}
            >
              <option value="">Add a {currency} service preset</option>
              {services
                .filter((s) => s.currency === currency)
                .map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.description} · {money(s.unitPrice, s.currency)}
                  </option>
                ))}
            </select>
          </div>
          {items.map((item, n) => (
            <div className="line-editor" key={n}>
              <div className="line-title">
                <strong>Item {n + 1}</strong>
                <button
                  type="button"
                  className="text-button danger"
                  disabled={items.length === 1}
                  onClick={() => setItems(items.filter((_, index) => index !== n))}
                >
                  Remove item {n + 1}
                </button>
              </div>
              <label>
                Description
                <input
                  aria-label={'Item ' + (n + 1) + ' description'}
                  value={item.description}
                  required
                  minLength={2}
                  maxLength={500}
                  onChange={(e) => update(n, 'description', e.target.value)}
                />
              </label>
              <div className="form-grid five">
                {(
                  [
                    ['quantity', 'Quantity'],
                    ['unit', 'Unit'],
                    ['unitPrice', 'Unit price'],
                    ['discountPercent', 'Discount %'],
                    ['taxRate', 'Tax %'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      aria-label={'Item ' + (n + 1) + ' ' + label}
                      inputMode={key === 'unit' ? 'text' : 'decimal'}
                      value={item[key]}
                      required
                      maxLength={30}
                      onChange={(e) => update(n, key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={items.length >= 100}
            onClick={() => setItems([...items, blank()])}
          >
            + Add line item
          </button>
        </section>
        <div className="editor-bottom">
          <section className="card editor-section">
            <h2>Notes to your client</h2>
            <label>
              Invoice notes
              <textarea
                aria-label="Invoice notes"
                rows={5}
                maxLength={2000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <p className="small">
              Payment instructions come from your business settings. Drafts can be edited; issued
              invoices are locked.
            </p>
          </section>
          <section className="card editor-section totals">
            {totals ? (
              <>
                <div>
                  <span>Subtotal</span>
                  <strong>{money(totals.subtotal, currency)}</strong>
                </div>
                <div>
                  <span>Discount</span>
                  <strong>−{money(totals.discountTotal, currency)}</strong>
                </div>
                <div>
                  <span>Tax</span>
                  <strong>{money(totals.taxTotal, currency)}</strong>
                </div>
                <div className="grand-total">
                  <span>Total {currency}</span>
                  <strong>{money(totals.total, currency)}</strong>
                </div>
              </>
            ) : (
              <p>Complete valid line items to preview totals.</p>
            )}
            <small>
              Tax is calculated after discounts, rounded per line to two decimal places.
            </small>
          </section>
        </div>
        <ErrorMessage message={error} />
        <div className="form-actions">
          <Link className="button secondary" to={original ? '/invoices/' + id : '/invoices'}>
            Cancel
          </Link>
          <FormActions busy={busy}>Save draft</FormActions>
        </div>
      </form>
    </>
  );
}
