import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getAdminToken,
  getStoredAdmin,
  registerAdminUnauthorizedHandler,
  setAdminToken,
  setStoredAdmin,
} from '../api/admin';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdminState] = useState(getStoredAdmin());
  const [token, setTokenState] = useState(getAdminToken());

  const login = useCallback((tok, adminObj) => {
    setAdminToken(tok);
    setTokenState(tok);
    setAdminState(adminObj);
    setStoredAdmin(adminObj);
  }, []);

  const logout = useCallback(() => {
    setAdminToken(null);
    setStoredAdmin(null);
    setTokenState(null);
    setAdminState(null);
  }, []);

  useEffect(() => {
    registerAdminUnauthorizedHandler(() => {
      setTokenState(null);
      setAdminState(null);
    });
  }, []);

  const value = useMemo(
    () => ({
      admin,
      token,
      isAuthenticated: !!token && !!admin,
      isSuperadmin: admin?.role === 'superadmin',
      login,
      logout,
    }),
    [admin, token, login, logout],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return ctx;
}
