import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import { api, send } from '../lib/api';
import type { Invoice, Party } from '../../shared/types';
import { PageHeading, Badge, statusLabel, date, ErrorMessage } from '../components/ui';
import { money, download } from '../components/forms';
function Address({ party }: { party: Party }) {
  return (
    <div>
      <strong>{party.name}</strong>
      <p className="address">{party.address}</p>
      <p>{party.country}</p>
      <p>{party.email}</p>
      {party.phone && <p>{party.phone}</p>}
      {party.taxId && <p>Tax / VAT ID: {party.taxId}</p>}
    </div>
  );
}
export function InvoiceDetail() {
  const { id } = useParams(),
    { invoices, reload } = useWorkspace(),
    navigate = useNavigate(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const i = invoices.find((i) => i.id === id);
  if (!i)
    return (
      <div className="empty">
        <h2>Invoice not found</h2>
        <Link to="/invoices">Back to invoices</Link>
      </div>
    );
  async function action(kind: string) {
    setBusy(true);
    setError('');
    try {
      if (kind === 'pdf') await download('invoices/' + i!.id + '/pdf', i!.number + '.pdf');
      else if (kind === 'duplicate') {
        const copy = await api<Invoice>(
          '/workspace/invoices/' + i!.id + '/duplicate',
          send('POST'),
        );
        await reload();
        navigate('/invoices/' + copy.id);
      } else if (kind === 'delete') {
        if (!confirm('Permanently delete this draft? Its number will not be reused.')) return;
        await api('/workspace/invoices/' + i!.id, send('DELETE'));
        await reload();
        navigate('/invoices');
      } else {
        if (kind === 'CANCELLED' && !confirm('Cancel this invoice? This cannot be undone.')) return;
        if (
          kind === 'SENT' &&
          !confirm(
            'Have you delivered the invoice to your client? This records manual delivery and locks its contents.',
          )
        )
          return;
        await api(
          '/workspace/invoices/' + i!.id + '/status',
          send('PATCH', { status: kind, revision: i!.revision }),
        );
        await reload();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="INVOICE DETAILS"
        title={i.number}
        description={'Created for ' + i.clientSnapshot.name}
      >
        <Badge tone={i.effectiveStatus.toLowerCase()}>{statusLabel(i.effectiveStatus)}</Badge>
      </PageHeading>
      <div className="toolbar">
        <button disabled={busy} onClick={() => void action('pdf')}>
          Download PDF
        </button>
        <button disabled={busy} className="secondary" onClick={() => void action('duplicate')}>
          Duplicate invoice
        </button>
        {i.status === 'DRAFT' && (
          <>
            <Link className="button secondary" to={'/invoices/' + i.id + '/edit'}>
              Edit draft
            </Link>
            <button disabled={busy} onClick={() => void action('SENT')}>
              Mark as sent
            </button>
            <button
              className="text-button danger"
              disabled={busy}
              onClick={() => void action('delete')}
            >
              Delete draft
            </button>
          </>
        )}
        {i.status === 'SENT' && (
          <button disabled={busy} onClick={() => void action('PAID')}>
            Mark as paid
          </button>
        )}
        {['DRAFT', 'SENT'].includes(i.status) && (
          <button
            className="text-button danger"
            disabled={busy}
            onClick={() => void action('CANCELLED')}
          >
            Cancel invoice
          </button>
        )}
      </div>
      <ErrorMessage message={error} />
      {i.status === 'DRAFT' && (
        <p className="callout">
          This is a draft. Download and deliver it yourself, then mark it as sent. InvoiceFlow does
          not send email or collect payments.
        </p>
      )}
      <article className="invoice-paper">
        <div className="paper-header">
          <h2>{i.sellerSnapshot.name}</h2>
          <div>
            <h2>INVOICE</h2>
            <p>{i.number}</p>
            <Badge tone={i.effectiveStatus.toLowerCase()}>{statusLabel(i.effectiveStatus)}</Badge>
          </div>
        </div>
        <div className="paper-parties">
          <section>
            <h3>FROM</h3>
            <Address party={i.sellerSnapshot} />
          </section>
          <section>
            <h3>BILL TO</h3>
            <Address party={i.clientSnapshot} />
          </section>
          <section>
            <h3>DETAILS</h3>
            <p>Issued {date(i.issueDate)}</p>
            <p>Due {date(i.dueDate)}</p>
            <p>Currency {i.currency}</p>
            {i.paidAt && <p>Paid {date(i.paidAt)}</p>}
          </section>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty / unit</th>
                <th>Unit price</th>
                <th>Discount</th>
                <th>Tax</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {i.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td>
                    {item.quantity} {item.unit}
                  </td>
                  <td>{money(item.unitPrice, i.currency)}</td>
                  <td>{item.discountPercent}%</td>
                  <td>{item.taxRate}%</td>
                  <td>{money(item.total, i.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="paper-totals totals">
          <div>
            <span>Subtotal</span>
            <strong>{money(i.subtotal, i.currency)}</strong>
          </div>
          <div>
            <span>Discount</span>
            <strong>−{money(i.discountTotal, i.currency)}</strong>
          </div>
          <div>
            <span>Tax</span>
            <strong>{money(i.taxTotal, i.currency)}</strong>
          </div>
          <div className="grand-total">
            <span>Total {i.currency}</span>
            <strong>{money(i.total, i.currency)}</strong>
          </div>
        </div>
        {i.sellerSnapshot.paymentDetails && (
          <section className="paper-note">
            <h3>Payment details</h3>
            <p className="address">{i.sellerSnapshot.paymentDetails}</p>
          </section>
        )}
        {i.notes && (
          <section className="paper-note">
            <h3>Notes</h3>
            <p className="address">{i.notes}</p>
          </section>
        )}
        <footer>Thank you for your business.</footer>
      </article>
      <section className="card history">
        <h2>Invoice history</h2>
        {i.events.map((e) => (
          <div key={e.id}>
            <span className="history-dot" />
            <strong>{e.action}</strong>
            <span>{new Date(e.createdAt).toLocaleString('en-GB')}</span>
          </div>
        ))}
      </section>
    </>
  );
}
