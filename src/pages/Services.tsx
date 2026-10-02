import { useState, type FormEvent } from 'react';
import { useWorkspace } from '../hooks/useWorkspace';
import { api, send } from '../lib/api';
import { currencies, serviceSchema } from '../../shared/validation';
import type { Service } from '../../shared/types';
import { Modal, PageHeading, Empty, ErrorMessage } from '../components/ui';
import { Field, FormActions, money } from '../components/forms';
export function Services() {
  const { services, reload } = useWorkspace(),
    [edit, setEdit] = useState<Service | 'new' | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const value = edit && edit !== 'new' ? edit : null;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = serviceSchema.parse(Object.fromEntries(new FormData(e.currentTarget)));
      await api(
        '/workspace/services' + (value ? '/' + value.id : ''),
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
  async function remove(s: Service) {
    if (!confirm('Delete this service preset? Existing invoice lines stay unchanged.')) return;
    try {
      await api('/workspace/services/' + s.id, send('DELETE'));
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="YOUR EXPERTISE"
        title="Services"
        description="Save your usual rates. Spend less time filling in invoices."
      >
        <button
          onClick={() => {
            setEdit('new');
            setError('');
          }}
        >
          + Add service
        </button>
      </PageHeading>
      <ErrorMessage message={!edit ? error : ''} />
      <p className="callout">
        Rates belong to a currency. Changing an invoice currency never converts amounts.
      </p>
      {services.length ? (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Unit</th>
                <th>Default rate</th>
                <th>Tax</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.description}</strong>
                  </td>
                  <td>{s.unit}</td>
                  <td>{money(s.unitPrice, s.currency)}</td>
                  <td>{s.taxRate}%</td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => {
                        setEdit(s);
                        setError('');
                      }}
                    >
                      Edit
                    </button>
                    <button className="text-button danger" onClick={() => void remove(s)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="Your service library starts here"
          description="Create a reusable service with your rate and tax settings."
        />
      )}
      {edit && (
        <Modal title={value ? 'Edit service' : 'Add service'} onClose={() => setEdit(null)}>
          <form onSubmit={submit}>
            <Field
              name="description"
              label="Description"
              value={value?.description}
              required
              maxLength={500}
            />
            <div className="form-grid">
              <Field
                name="unit"
                label="Unit"
                value={value?.unit || 'hour'}
                required
                maxLength={30}
              />
              <Field name="unitPrice" label="Unit price" value={value?.unitPrice || '0'} required />
              <Field name="taxRate" label="Tax percentage" value={value?.taxRate || '0'} required />
              <label>
                Currency
                <select name="currency" defaultValue={value?.currency || 'EUR'}>
                  {currencies.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <ErrorMessage message={error} />
            <FormActions busy={busy} onClose={() => setEdit(null)}>
              {value ? 'Save service' : 'Create service'}
            </FormActions>
          </form>
        </Modal>
      )}
    </>
  );
}
