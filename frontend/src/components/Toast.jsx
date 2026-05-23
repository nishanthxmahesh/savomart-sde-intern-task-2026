import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { registerUnexpectedErrorHandler } from '../api/client';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message, { kind = 'info', timeoutMs = 3000 } = {}) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, kind }]);
      if (timeoutMs > 0) setTimeout(() => dismiss(id), timeoutMs);
      return id;
    },
    [dismiss],
  );

  // Wire the axios "loud failure" interceptor to surface a toast.
  // Debounce identical messages within 5s so a hung backend doesn't spam.
  useEffect(() => {
    let lastMsg = null;
    let lastAt = 0;
    registerUnexpectedErrorHandler((msg) => {
      const now = Date.now();
      if (msg === lastMsg && now - lastAt < 5000) return;
      lastMsg = msg;
      lastAt = now;
      show(msg, { kind: 'error', timeoutMs: 3000 });
    });
  }, [show]);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-savo-glow font-medium text-sm animate-slide-up ${
              t.kind === 'error'
                ? 'bg-red-600 text-white'
                : t.kind === 'success'
                  ? 'bg-savo-purple text-savo-yellow'
                  : 'bg-white text-savo-ink border border-savo-purple-100'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
