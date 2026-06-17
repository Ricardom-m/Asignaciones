"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastType = "" | "success" | "error";
interface ToastState {
  msg: string;
  type: ToastType;
  show: boolean;
}

const ToastContext = createContext<(msg: string, type?: ToastType) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ToastState>({ msg: "", type: "", show: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: ToastType = "") => {
    if (timer.current) clearTimeout(timer.current);
    setState({ msg, type, show: true });
    timer.current = setTimeout(() => setState((s) => ({ ...s, show: false })), 2600);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className={`toast ${state.type} ${state.show ? "show" : ""}`}>{state.msg}</div>
    </ToastContext.Provider>
  );
}
