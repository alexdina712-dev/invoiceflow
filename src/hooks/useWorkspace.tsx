import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { Client, Service, Invoice, Profile } from '../../shared/types';
interface Data {
  clients: Client[];
  services: Service[];
  invoices: Invoice[];
  profile: Profile;
}
const Context = createContext<
  Data & { reload: () => Promise<void>; loading: boolean; error: string }
>(null!);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>({
      clients: [],
      services: [],
      invoices: [],
      profile: {
        name: '',
        address: '',
        country: '',
        email: '',
        phone: '',
        taxId: '',
        paymentDetails: '',
      },
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  async function reload() {
    try {
      const [clients, services, invoices, profile] = await Promise.all([
        api<Client[]>('/workspace/clients'),
        api<Service[]>('/workspace/services'),
        api<Invoice[]>('/workspace/invoices'),
        api<Profile>('/workspace/profile'),
      ]);
      setData({ clients, services, invoices, profile });
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
  }, []);
  return (
    <Context.Provider value={{ ...data, reload, loading, error }}>{children}</Context.Provider>
  );
}
export const useWorkspace = () => useContext(Context);
