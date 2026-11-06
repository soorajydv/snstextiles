'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type Toast = { id: number; message: string; tone: 'ok' | 'error' };
const ToastContext = createContext<(message: string, tone?: 'ok' | 'error') => void>(() => undefined);

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const activeToastKeys = useRef(new Set<string>());
  const push = useCallback((message: string, tone: 'ok' | 'error' = 'ok') => {
    const key = `${tone}:${message}`;
    if (activeToastKeys.current.has(key)) return;
    activeToastKeys.current.add(key);
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => {
      activeToastKeys.current.delete(key);
      setToasts((t) => t.filter((x) => x.id !== id));
    }, tone === 'error' ? 6000 : 3500);
  }, []);
  useEffect(() => {
    const onApiError = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      if (message) push(message, 'error');
    };
    window.addEventListener('app-api-error', onApiError);
    return () => window.removeEventListener('app-api-error', onApiError);
  }, [push]);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone === 'error' ? 'error' : ''}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
