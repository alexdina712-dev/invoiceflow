import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import { currencies, statusLabels } from '../../shared/validation';
import { PageHeading, Empty, Badge, statusLabel, date, ErrorMessage } from '../components/ui';
import { download, money } from '../components/forms';
import type { Invoice } from '../../shared/types';
export function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  return (
    <div className="table-wrap card">
      <table>
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Client</th>
            <th>Status</th>
            <th>Issued / due</th>
            <th>Amount</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((i) => (
            <tr key={i.id}>
              <td>
                <Link className="invoice-link" to={'/invoices/' + i.id}>
                  {i.number}
                </Link>
              </td>
              <td>{i.clientSnapshot.name}</td>
              <td>
                <Badge tone={i.effectiveStatus.toLowerCase()}>
                  {statusLabel(i.effectiveStatus)}
                </Badge>
              </td>
              <td>
                {date(i.issueDate)}
                <small>Due {date(i.dueDate)}</small>
              </td>
              <td className="amount">{money(i.total, i.currency)}</td>
              <td>
                <Link to={'/invoices/' + i.id}>View →</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Invoices() {
  const { invoices, clients } = useWorkspace(),
    [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [clientId, setClient] = useState(''),
    [currency, setCurrency] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [error, setError] = useState('');
  const rows = invoices.filter(
    (i) =>
      (!q || (i.number + ' ' + i.clientSnapshot.name).toLowerCase().includes(q.toLowerCase())) &&
      (!status || i.effectiveStatus === status) &&
      (!clientId || i.clientId === clientId) &&
      (!currency || i.currency === currency) &&
      (!from || i.issueDate.slice(0, 10) >= from) &&
      (!to || i.issueDate.slice(0, 10) <= to),
  );
  async function exportCsv() {
    try {
      if (from && to && from > to) throw new Error('Start date must be before end date.');
      const params = new URLSearchParams(
        Object.entries({ q, status, clientId, currency, from, to }).filter(([, v]) => v),
      );
      await download('export/invoices?' + params, 'invoiceflow-invoices.csv');
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="BILLING, WITHOUT THE BUSYWORK"
        title="Invoices"
        description="Every invoice, every payment. A clear picture of your business."
      >
        <Link className="button" to="/invoices/new">
          + Create invoice
        </Link>
      </PageHeading>
      <div className="toolbar filters">
        <input
          aria-label="Search invoices"
          placeholder="Search invoice or client"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Filter status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {statusLabels.map((s) => (
            <option value={s} key={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter client"
          value={clientId}
          onChange={(e) => setClient(e.target.value)}
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          <option value="">All currencies</option>
          {currencies.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button className="secondary" onClick={() => void exportCsv()}>
          Export CSV
        </button>
      </div>
      <ErrorMessage message={error} />
      <div className="section-heading">
        <span>{rows.length} invoices</span>
        {(q || status || clientId || currency || from || to) && (
          <button
            className="text-button"
            onClick={() => {
              setQ('');
              setStatus('');
              setClient('');
              setCurrency('');
              setFrom('');
              setTo('');
            }}
          >
            Clear filters
          </button>
        )}
      </div>
      {rows.length ? (
        <InvoiceTable invoices={rows} />
      ) : (
        <Empty
          title="No invoices here yet"
          description="Create your first invoice or adjust your filters."
        >
          <Link className="button" to="/invoices/new">
            Create invoice
          </Link>
        </Empty>
      )}
    </>
  );
}
