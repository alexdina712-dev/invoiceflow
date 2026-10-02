import type { ReactNode } from 'react';
export function Field({
  name,
  label,
  value = '',
  type = 'text',
  required = false,
  maxLength = 400,
}: {
  name: string;
  label: string;
  value?: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label>
      {label}
      <input
        aria-label={label}
        name={name}
        defaultValue={value}
        type={type}
        required={required}
        maxLength={maxLength}
      />
    </label>
  );
}
export function TextArea({
  name,
  label,
  value = '',
  maxLength = 2000,
}: {
  name: string;
  label: string;
  value?: string;
  maxLength?: number;
}) {
  return (
    <label>
      {label}
      <textarea
        aria-label={label}
        name={name}
        defaultValue={value}
        maxLength={maxLength}
        rows={3}
      />
    </label>
  );
}
export function FormActions({
  busy,
  onClose,
  children,
}: {
  busy: boolean;
  onClose?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="form-actions">
      {onClose && (
        <button type="button" className="secondary" onClick={onClose}>
          Cancel
        </button>
      )}
      <button disabled={busy}>{busy ? 'Saving…' : children || 'Save changes'}</button>
    </div>
  );
}
export function money(value: string, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value));
}
export async function download(path: string, filename: string) {
  const response = await fetch('/api/workspace/' + path, { credentials: 'include' });
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Download failed.' }));
    throw new Error(data.error);
  }
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
