import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, Layers, Settings, LogOut } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { WorkspaceProvider, useWorkspace } from './hooks/useWorkspace';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Clients } from './pages/Clients';
import { Services } from './pages/Services';
import { Invoices } from './pages/Invoices';
import { InvoiceEditor } from './pages/InvoiceEditor';
import { InvoiceDetail } from './pages/InvoiceDetail';
import { SettingsPage } from './pages/Settings';
import { useState } from 'react';
export function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Opening your workspace…</div>;
  if (!user) return <Auth />;
  return (
    <WorkspaceProvider>
      <Shell />
    </WorkspaceProvider>
  );
}
function Shell() {
  const { user, logout } = useAuth(),
    { loading, error, reload } = useWorkspace(),
    [authError, setAuthError] = useState('');
  const links = [
    ['/', 'Overview', LayoutDashboard],
    ['/invoices', 'Invoices', FileText],
    ['/clients', 'Clients', Users],
    ['/services', 'Services', Layers],
    ['/settings', 'Business settings', Settings],
  ] as const;
  return (
    <div className="layout">
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          ▧ InvoiceFlow
        </NavLink>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {links.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="avatar">{user!.name.slice(0, 1)}</div>
          <div>
            <strong>{user!.name}</strong>
            <small>{user!.email}</small>
          </div>
          <button
            className="icon-button"
            aria-label="Log out"
            onClick={() => logout().catch((e) => setAuthError(e.message))}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span>Business workspace</span>
          <button
            className="icon-button mobile-logout"
            aria-label="Log out"
            onClick={() => logout().catch((e) => setAuthError(e.message))}
          >
            <LogOut size={18} />
          </button>
          <span className="workspace-pill">
            {user!.email === 'demo@invoiceflow.app' ? 'Demo · fictional data' : 'Private workspace'}
          </span>
        </header>
        {authError && (
          <p role="alert" className="error">
            {authError}
          </p>
        )}
        {loading ? (
          <div className="loading">Loading your business…</div>
        ) : error ? (
          <div className="empty">
            <p role="alert">{error}</p>
            <button onClick={() => void reload()}>Try again</button>
          </div>
        ) : (
          <main>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/services" element={<Services />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoices/new" element={<InvoiceEditor />} />
              <Route path="/invoices/:id/edit" element={<InvoiceEditor />} />
              <Route path="/invoices/:id" element={<InvoiceDetail />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        )}
      </div>
    </div>
  );
}
