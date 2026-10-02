import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, send } from '../lib/api';
import type { User } from '../lib/types';
interface Auth {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
}
const Context = createContext<Auth>(null!);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    api<User>('/auth/me')
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  async function logout() {
    await api('/auth/logout', send('POST'));
    setUser(null);
  }
  return <Context.Provider value={{ user, loading, setUser, logout }}>{children}</Context.Provider>;
}
export const useAuth = () => useContext(Context);
