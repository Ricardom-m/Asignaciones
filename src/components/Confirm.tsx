"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  icon?: string;
}
type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (opts) => new Promise<boolean>((resolve) => setState({ opts, resolve })),
    [],
  );

  const finish = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && <ConfirmDialog opts={state.opts} onConfirm={() => finish(true)} onCancel={() => finish(false)} />}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({
  opts,
  onConfirm,
  onCancel,
}: {
  opts: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      else if (e.key === "Enter") onConfirm();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onConfirm, onCancel]);

  return createPortal(
    <div className="confirm-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="confirm-box">
        <div className={`confirm-icon${opts.danger ? " danger" : ""}`}>
          {opts.icon ?? (opts.danger ? "🗑️" : "❓")}
        </div>
        {opts.title && <div className="confirm-title">{opts.title}</div>}
        <div className="confirm-msg">{opts.message}</div>
        <div className="confirm-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            {opts.cancelText ?? "Cancelar"}
          </button>
          <button
            className={`btn ${opts.danger ? "btn-danger-solid" : "btn-primary"}`}
            onClick={onConfirm}
            autoFocus
          >
            {opts.confirmText ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
