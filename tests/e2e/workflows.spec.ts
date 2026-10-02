import { test, expect, type Page } from '@playwright/test';
const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page), 'Uncaught browser exceptions').toEqual([]);
});
const password = 'BrowserTest!2026';
let email = '';
async function api(page: Page, path: string, method = 'GET', data?: unknown) {
  const response = await page.request.fetch('/api' + path, {
    method,
    data,
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.status() === 204 ? null : response.json();
}
async function visit(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('main')).toBeVisible();
}
test.beforeEach(async ({ page }, info) => {
  email = 'browser-' + Date.now() + '-' + info.project.name + '@example.com';
  await page.goto('/');
  await api(page, '/auth/register', 'POST', { name: 'Browser Studio', email, password });
  await api(page, '/workspace/profile', 'PUT', {
    name: 'Browser Studio',
    email: 'billing@example.com',
    address: '12 Test Avenue, Bucharest',
    country: 'Romania',
    phone: '',
    taxId: 'DEMO-123',
    paymentDetails: 'Reference the invoice number.',
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Business overview' })).toBeVisible();
});
test.afterEach(async ({ page }) => {
  await page.request.delete('/api/workspace/account', {
    data: { password },
    headers: { Origin: new URL(page.url()).origin },
  });
});
async function client(page: Page) {
  return api(page, '/workspace/clients', 'POST', {
    name: 'Evergreen Test',
    kind: 'COMPANY',
    address: '23 Client Street, Berlin',
    country: 'Germany',
    email: 'client@example.com',
    phone: '',
    taxId: 'DEMO-456',
    notes: 'Fictional test',
  });
}
async function invoice(page: Page) {
  const c = await client(page);
  return api(page, '/workspace/invoices', 'POST', {
    clientId: c.id,
    issueDate: '2026-01-01',
    dueDate: '2026-01-14',
    currency: 'EUR',
    notes: 'Test invoice',
    items: [
      {
        description: 'Consulting session',
        unit: 'hour',
        quantity: '2',
        unitPrice: '100',
        discountPercent: '10',
        taxRate: '20',
      },
    ],
  });
}
test('authentication persists, logout works, and login restores the workspace', async ({
  page,
}) => {
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Business overview' })).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Business overview' })).toBeVisible();
});
test('client CRUD and CSV download work', async ({ page }) => {
  await visit(page, '/clients');
  await page.getByRole('button', { name: '+ Add client', exact: true }).click();
  await page.getByLabel('Client name', { exact: true }).fill('Ștefan Test Studio');
  await page.getByLabel('Email', { exact: true }).fill('client@example.com');
  await page.getByLabel('Country', { exact: true }).fill('Romania');
  await page.getByLabel('Address', { exact: true }).fill('19 Linden Street');
  await page.getByRole('button', { name: 'Create client', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ștefan Test Studio' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit client', exact: true }).click();
  await page.getByLabel('Phone', { exact: true }).fill('+40 700 123 456');
  await page.getByRole('button', { name: 'Save client', exact: true }).click();
  await expect(page.getByText('Romania · +40 700 123 456', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('invoiceflow-clients.csv');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No clients found' })).toBeVisible();
});
test('service presets can be created, changed, and deleted', async ({ page }) => {
  await visit(page, '/services');
  await page.getByRole('button', { name: '+ Add service', exact: true }).click();
  await page.getByLabel('Description', { exact: true }).fill('UX workshop');
  await page.getByLabel('Unit price', { exact: true }).fill('650');
  await page.getByLabel('Tax percentage', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Create service', exact: true }).click();
  await expect(page.getByText('UX workshop', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Unit price', { exact: true }).fill('700');
  await page.getByRole('button', { name: 'Save service', exact: true }).click();
  await expect(page.getByRole('cell', { name: '€700.00', exact: true })).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Your service library starts here' }),
  ).toBeVisible();
});
test('invoice editor calculates totals, saves, edits, and downloads PDF', async ({ page }) => {
  const c = await client(page);
  await visit(page, '/invoices/new');
  await page.getByLabel('Client', { exact: true }).selectOption(c.id);
  await page.getByLabel('Item 1 description', { exact: true }).fill('Design consulting');
  await page.getByLabel('Item 1 Quantity', { exact: true }).fill('2');
  await page.getByLabel('Item 1 Unit price', { exact: true }).fill('100');
  await page.getByLabel('Item 1 Discount %', { exact: true }).fill('10');
  await page.getByLabel('Item 1 Tax %', { exact: true }).fill('20');
  await expect(page.locator('.grand-total')).toContainText('€216.00');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.locator('.invoice-paper')).toContainText('€216.00');
  await page.getByRole('link', { name: 'Edit draft', exact: true }).click();
  await page.getByLabel('Invoice notes', { exact: true }).fill('Updated client note.');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.locator('.invoice-paper')).toContainText('Updated client note.');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
  expect((await downloading).suggestedFilename()).toMatch(/^IF-.*\.pdf$/);
});
test('invoice statuses, immutability, duplication, and filtered exports work', async ({ page }) => {
  const i = await invoice(page);
  await visit(page, '/invoices/' + i.id);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Mark as sent', exact: true }).click();
  await expect(page.locator('.page-heading')).toContainText('Overdue');
  await expect(page.getByRole('link', { name: 'Edit draft', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Mark as paid', exact: true }).click();
  await expect(page.locator('.page-heading')).toContainText('Paid');
  await page.getByRole('button', { name: 'Duplicate invoice', exact: true }).click();
  await expect(page.locator('.page-heading')).toContainText('Draft');
  await visit(page, '/invoices');
  await page.getByLabel('Filter status').selectOption('PAID');
  await expect(page.getByRole('link', { name: i.number, exact: true })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByLabel('Filter currency').selectOption('USD');
  await expect(page.getByRole('heading', { name: 'No invoices here yet' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
});
test('business settings save, responsive navigation works, and account deletion clears data', async ({
  page,
}) => {
  await visit(page, '/settings');
  await page.getByLabel('Business / seller name', { exact: true }).fill('Studio North Updated');
  await page.getByRole('button', { name: 'Save business settings', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Business details saved');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByLabel('Confirm your password', { exact: true }).fill(password);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete account and all data', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
