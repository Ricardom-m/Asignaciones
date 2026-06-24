"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

// Como useState pero recuerda el valor en localStorage (por `key`).
// Carga el valor guardado tras el montaje (evita desajustes de hidratación SSR).
export function usePersistedState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(initial);
  const hydrated = useRef(false);

  // Lee el valor guardado una vez, ya en el cliente.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) setState(JSON.parse(raw) as T);
    } catch {
      /* ignora JSON inválido o storage no disponible */
    }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Persiste en cada cambio (solo después de haber leído lo guardado).
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* storage lleno o no disponible */
    }
  }, [key, state]);

  return [state, setState];
}
