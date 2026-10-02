import { useState, type FormEvent } from 'react';
import { api, send } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { loginSchema, registerSchema } from '../../shared/validation';
import type { User } from '../../shared/types';
import { ErrorMessage } from '../components/ui';
export function Auth() {
  const { setUser } = useAuth(),
    [register, setRegister] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const input = Object.fromEntries(new FormData(e.currentTarget));
      const payload = (register ? registerSchema : loginSchema).parse(input);
      setUser(await api<User>('/auth/' + (register ? 'register' : 'login'), send('POST', payload)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function demo() {
    setBusy(true);
    try {
      setUser(
        await api<User>(
          '/auth/login',
          send('POST', { email: 'demo@invoiceflow.app', password: 'InvoiceFlowDemo!2026' }),
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <div className="brand">▧ InvoiceFlow</div>
        <p className="eyebrow">LESS ADMIN. MORE BUSINESS.</p>
        <h1>
          Good work deserves
          <br />a great invoice.
        </h1>
        <p>
          A calmer way to manage clients, send professional invoices, and keep track of what’s paid.
        </p>
        <div className="sample-card">
          <span>PAYMENT RECORDED</span>
          <strong>€2,640.00</strong>
          <p>Website design · Northline Studio</p>
          <div className="sample-line">Clear numbers. Confident next steps.</div>
        </div>
        <small>Built for freelancers and small teams.</small>
      </section>
      <section className="auth-form">
        <div>
          <p className="eyebrow">YOUR BUSINESS, ORGANIZED</p>
          <h2>{register ? 'Start your workspace' : 'Welcome back'}</h2>
          <p>
            {register
              ? 'Create a private account for your business.'
              : 'Sign in to keep your business moving.'}
          </p>
          <form onSubmit={submit}>
            {register && (
              <label>
                Your name
                <input name="name" required minLength={2} maxLength={80} autoComplete="name" />
              </label>
            )}
            <label>
              Email address
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                required
                minLength={register ? 10 : 1}
                maxLength={72}
                autoComplete={register ? 'new-password' : 'current-password'}
              />
            </label>
            <ErrorMessage message={error} />
            <button disabled={busy}>
              {busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
            </button>
          </form>
          <button className="secondary full" disabled={busy} onClick={demo}>
            Explore the demo workspace
          </button>
          <p className="small">
            Demo data is fictional and shared. Use a private account for your own information.
          </p>
          <button
            className="text-button"
            onClick={() => {
              setRegister(!register);
              setError('');
            }}
          >
            {register ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </button>
        </div>
      </section>
    </div>
  );
}
