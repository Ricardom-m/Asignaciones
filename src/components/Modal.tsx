"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

// Modal renderizado en un portal a <body> con position:fixed, inmune a
// contenedores con transform/overflow. Cierra con clic afuera o Esc.
export function Modal({ title, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
