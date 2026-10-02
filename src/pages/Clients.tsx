import { useState, type FormEvent } from 'react';
import { useWorkspace } from '../hooks/useWorkspace';
import { api, send } from '../lib/api';
import { clientSchema } from '../../shared/validation';
import type { Client } from '../../shared/types';
import { Modal, PageHeading, Empty, ErrorMessage } from '../components/ui';
import { Field, TextArea, FormActions, download } from '../components/forms';
export function Clients() {
  const { clients, reload } = useWorkspace(),
    [edit, setEdit] = useState<Client | 'new' | null>(null),
    [query, setQuery] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const value = edit && edit !== 'new' ? edit : null;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = clientSchema.parse(Object.fromEntries(new FormData(e.currentTarget)));
      await api(
        '/workspace/clients' + (value ? '/' + value.id : ''),
        send(value ? 'PATCH' : 'POST', data),
      );
      await reload();
      setEdit(null);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(c: Client) {
    if (!confirm('Delete ' + c.name + '? Historical invoices keep their original client details.'))
      return;
    try {
      await api('/workspace/clients/' + c.id, send('DELETE'));
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const rows = clients.filter((c) =>
    (c.name + ' ' + c.email).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="RELATIONSHIPS"
        title="Clients"
        description="Keep the people behind your business close."
      >
        <button
          onClick={() => {
            setEdit('new');
            setError('');
          }}
        >
          + Add client
        </button>
      </PageHeading>
      <ErrorMessage message={!edit ? error : ''} />
      <div className="toolbar">
        <input
          aria-label="Search clients"
          placeholder="Search by name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="secondary"
          onClick={() =>
            download('export/clients', 'invoiceflow-clients.csv').catch((e) => setError(e.message))
          }
        >
          Export CSV
        </button>
        <span>{clients.length} clients</span>
      </div>
      {rows.length ? (
        <div className="client-grid">
          {rows.map((c) => (
            <article className="card client-card" key={c.id}>
              <div className="client-avatar">{c.name.slice(0, 2).toUpperCase()}</div>
              <span className="badge">{c.kind === 'COMPANY' ? 'Company' : 'Individual'}</span>
              <h3>{c.name}</h3>
              <p>{c.email}</p>
              <p>
                {c.country} · {c.phone || 'No phone added'}
              </p>
              <div className="card-bottom">
                <button
                  className="secondary"
                  onClick={() => {
                    setEdit(c);
                    setError('');
                  }}
                >
                  Edit client
                </button>
                <button className="text-button danger" onClick={() => void remove(c)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="No clients found" description="Add a client or try a different search." />
      )}
      {edit && (
        <Modal title={value ? 'Edit client' : 'Add client'} onClose={() => setEdit(null)}>
          <form onSubmit={submit}>
            <div className="form-grid">
              <Field name="name" label="Client name" value={value?.name} required maxLength={120} />
              <label>
                Client type
                <select name="kind" defaultValue={value?.kind || 'COMPANY'}>
                  <option value="COMPANY">Company</option>
                  <option value="PERSON">Individual</option>
                </select>
              </label>
              <Field name="email" label="Email" value={value?.email} type="email" required />
              <Field name="phone" label="Phone" value={value?.phone} maxLength={40} />
              <Field
                name="country"
                label="Country"
                value={value?.country}
                required
                maxLength={80}
              />
              <Field
                name="taxId"
                label="Tax / VAT identifier"
                value={value?.taxId}
                maxLength={80}
              />
            </div>
            <TextArea name="address" label="Address" value={value?.address} maxLength={400} />
            <TextArea name="notes" label="Private notes" value={value?.notes} />
            <ErrorMessage message={error} />
            <FormActions busy={busy} onClose={() => setEdit(null)}>
              {value ? 'Save client' : 'Create client'}
            </FormActions>
          </form>
        </Modal>
      )}
    </>
  );
}
