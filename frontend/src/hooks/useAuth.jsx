import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getToken, setToken, registerUnauthorizedHandler } from '../api/client';

const USER_KEY = 'savo_user';
const AuthContext = createContext(null);

function loadStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadStoredUser());
  const [token, setTokenState] = useState(getToken());

  const login = useCallback((tok, userObj) => {
    setToken(tok);
    setTokenState(tok);
    setUser(userObj);
    localStorage.setItem(USER_KEY, JSON.stringify(userObj));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setUser(null);
    localStorage.removeItem(USER_KEY);
  }, []);

  const updateUser = useCallback((partial) => {
    setUser((prev) => {
      const next = { ...(prev || {}), ...partial };
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      setTokenState(null);
      setUser(null);
      localStorage.removeItem(USER_KEY);
    });
  }, []);

  const value = useMemo(
    () => ({ user, token, isAuthenticated: !!token && !!user, login, logout, updateUser }),
    [user, token, login, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
