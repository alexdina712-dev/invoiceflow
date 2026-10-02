import { useState, type FormEvent } from 'react';
import { useWorkspace } from '../hooks/useWorkspace';
import { useAuth } from '../hooks/useAuth';
import { api, send } from '../lib/api';
import { profileSchema } from '../../shared/validation';
import { Field, TextArea, FormActions } from '../components/forms';
import { PageHeading, ErrorMessage } from '../components/ui';
export function SettingsPage() {
  const { profile, reload } = useWorkspace(),
    { user, setUser } = useAuth(),
    [error, setError] = useState(''),
    [success, setSuccess] = useState(''),
    [busy, setBusy] = useState(false),
    [password, setPassword] = useState('');
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const payload = profileSchema.parse(Object.fromEntries(new FormData(e.currentTarget)));
      await api('/workspace/profile', send('PUT', payload));
      await reload();
      setSuccess('Business details saved. Issued invoices keep their original details.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(e: FormEvent) {
    e.preventDefault();
    if (
      !confirm(
        'Permanently delete your account, clients, services, invoices, and all saved snapshots? This cannot be undone.',
      )
    )
      return;
    setBusy(true);
    try {
      await api('/workspace/account', send('DELETE', { password }));
      setUser(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="THE DETAILS THAT MATTER"
        title="Business settings"
        description="Your seller details and payment instructions, in one place."
      />
      <section className="card editor-section settings-card">
        <h2>Seller profile</h2>
        <form onSubmit={save}>
          <div className="form-grid">
            <Field
              name="name"
              label="Business / seller name"
              value={profile.name}
              required
              maxLength={120}
            />
            <Field
              name="email"
              label="Business email"
              value={profile.email}
              type="email"
              required
            />
            <Field name="country" label="Country" value={profile.country} required maxLength={80} />
            <Field name="phone" label="Phone" value={profile.phone} maxLength={40} />
            <Field name="taxId" label="Tax / VAT identifier" value={profile.taxId} maxLength={80} />
          </div>
          <TextArea
            name="address"
            label="Business address"
            value={profile.address}
            maxLength={400}
          />
          <TextArea
            name="paymentDetails"
            label="Payment instructions"
            value={profile.paymentDetails}
            maxLength={1000}
          />
          <p className="small">
            Choose tax rates yourself according to your business requirements. No tax filing,
            currency conversion, or payment processing is provided.
          </p>
          <ErrorMessage message={error} />
          {success && (
            <p role="status" className="success">
              {success}
            </p>
          )}
          <FormActions busy={busy}>Save business settings</FormActions>
        </form>
      </section>
      <section className="card editor-section settings-card">
        <h2>Privacy & account</h2>
        <p>
          Data belongs to your signed-in workspace. Deleting a client preserves the snapshots in
          historical invoices. Deleting your account removes all associated data from the
          application database.
        </p>
        {user?.email === 'demo@invoiceflow.app' ? (
          <p className="callout">The shared fictional demo account cannot be deleted.</p>
        ) : (
          <form onSubmit={remove}>
            <label>
              Confirm your password
              <input
                aria-label="Confirm your password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="danger-button" disabled={busy}>
              Delete account and all data
            </button>
          </form>
        )}
      </section>
    </>
  );
}
