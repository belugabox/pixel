import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type Toast = { id: number; message: string; type?: 'info' | 'error' };

type ToastContextType = {
  show: (message: string, type?: 'info' | 'error') => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, type: 'info' | 'error' = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic>
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type || 'info'}`}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
