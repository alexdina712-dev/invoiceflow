import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import { currencies } from '../../shared/validation';
import { sumMoney } from '../../shared/calculations';
import { PageHeading, date } from '../components/ui';
import { money } from '../components/forms';
import { InvoiceTable } from './Invoices';
export function Dashboard() {
  const { invoices, clients, profile } = useWorkspace(),
    [currency, setCurrency] = useState('EUR');
  const selected = invoices.filter((i) => i.currency === currency),
    paid = selected.filter((i) => i.status === 'PAID'),
    unpaid = selected.filter((i) => ['SENT', 'OVERDUE'].includes(i.effectiveStatus)),
    overdue = unpaid.filter((i) => i.effectiveStatus === 'OVERDUE');
  const months = Array.from({ length: 6 }, (_, n) => {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - 5 + n);
    const key = d.toISOString().slice(0, 7);
    return {
      label: d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
      total: sumMoney(paid.filter((i) => i.paidAt?.slice(0, 7) === key).map((i) => i.total)),
    };
  });
  const max = Math.max(1, ...months.map((m) => Number(m.total)));
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE CLARITY GOES A LONG WAY"
        title="Business overview"
        description="Your work is valuable. Keep track of what it brings in."
      >
        <Link className="button" to="/invoices/new">
          + Create invoice
        </Link>
      </PageHeading>
      {(!profile.address || !profile.country) && (
        <div className="callout">
          Complete your seller details before creating an invoice.{' '}
          <Link to="/settings">Set up your business →</Link>
        </div>
      )}
      <div className="section-heading">
        <h2>Your numbers</h2>
        <label className="inline-label">
          Currency
          <select
            aria-label="Dashboard currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="stats">
        <article className="stat">
          <p>Revenue received</p>
          <strong>{money(sumMoney(paid.map((i) => i.total)), currency)}</strong>
          <small>{paid.length} paid invoices · all time</small>
        </article>
        <article className="stat">
          <p>Awaiting payment</p>
          <strong>{money(sumMoney(unpaid.map((i) => i.total)), currency)}</strong>
          <small>{unpaid.length} issued invoices</small>
        </article>
        <article className="stat">
          <p>Overdue</p>
          <strong>{money(sumMoney(overdue.map((i) => i.total)), currency)}</strong>
          <small>{overdue.length} invoices past due</small>
        </article>
        <article className="stat">
          <p>Client relationships</p>
          <strong>{clients.length}</strong>
          <small>Across all currencies</small>
        </article>
      </div>
      <div className="dashboard-grid">
        <section className="card chart-card">
          <div className="section-heading">
            <h2>Monthly revenue</h2>
            <span className="small">Payments received · {currency}</span>
          </div>
          <div
            className="chart"
            role="img"
            aria-label={
              'Monthly received revenue in ' +
              currency +
              ': ' +
              months.map((m) => m.label + ' ' + m.total).join(', ')
            }
          >
            {months.map((m) => (
              <div className="chart-column" key={m.label}>
                <span>{money(m.total, currency)}</span>
                <div className="bar-space">
                  <div
                    className="bar"
                    style={{ height: Math.max(2, (Number(m.total) / max) * 100) + '%' }}
                  />
                </div>
                <small>{m.label}</small>
              </div>
            ))}
          </div>
          <p className="small">
            Currencies are shown separately. No exchange rates or conversions.
          </p>
        </section>
        <section className="card recent-clients">
          <div className="section-heading">
            <h2>Recent clients</h2>
            <Link to="/clients">View all →</Link>
          </div>
          {clients.slice(0, 4).map((c) => (
            <Link className="recent-client" to="/clients" key={c.id}>
              <span className="client-avatar">{c.name.slice(0, 1)}</span>
              <div>
                <strong>{c.name}</strong>
                <small>
                  {c.country} · Added {date(c.createdAt)}
                </small>
              </div>
            </Link>
          ))}
          {!clients.length && <p>Add your first client to start invoicing.</p>}
        </section>
      </div>
      <div className="section-heading">
        <h2>Recent invoices</h2>
        <Link to="/invoices">View all invoices →</Link>
      </div>
      {invoices.length ? (
        <InvoiceTable invoices={invoices.slice(0, 5)} />
      ) : (
        <div className="card empty">
          <h3>Your next chapter starts with an invoice.</h3>
          <Link to="/invoices/new">Create your first invoice →</Link>
        </div>
      )}
    </>
  );
}
