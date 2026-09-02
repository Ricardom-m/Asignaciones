"use client";

import { useCallback, useEffect, useRef } from "react";

interface Props {
  value: string; // "" = sin definir
  onChange: (v: string) => void;
  min?: number;
  max?: number;
}

// Desde vacio, cualquiera de los dos botones arranca aqui.
const START = 5;
const HOLD_DELAY = 380; // ms antes de empezar a repetir
const HOLD_RATE = 80; // ms entre repeticiones

// Campo de minutos con - / + integrados. Se puede seguir tecleando el numero;
// los botones son para ajustar sin abrir el teclado. Mantener pulsado repite.
export function MinutesInput({ value, onChange, min = 1, max = 600 }: Props) {
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref para que el repetido no arrastre un value viejo del render en que empezo.
  const valueRef = useRef(value);
  valueRef.current = value;

  const stop = useCallback(() => {
    if (delay.current) clearTimeout(delay.current);
    if (repeat.current) clearInterval(repeat.current);
    delay.current = null;
    repeat.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const bump = useCallback(
    (dir: 1 | -1) => {
      const n = Number(valueRef.current);
      // Vacio o invalido: ambos botones caen en START.
      const base = valueRef.current === "" || Number.isNaN(n) ? START - dir : n;
      onChange(String(Math.min(max, Math.max(min, base + dir))));
    },
    [max, min, onChange],
  );

  const press = useCallback(
    (dir: 1 | -1) => {
      bump(dir);
      delay.current = setTimeout(() => {
        repeat.current = setInterval(() => bump(dir), HOLD_RATE);
      }, HOLD_DELAY);
    },
    [bump],
  );

  const num = Number(value);
  const vacio = value === "" || Number.isNaN(num);

  const btn = (dir: 1 | -1, label: string, glyph: string, disabled: boolean) => (
    <button
      type="button"
      className="stepper-btn"
      aria-label={label}
      disabled={disabled}
      onPointerDown={() => press(dir)}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      // Enter/Espacio con el foco puesto: no hay onClick, asi que no se duplica.
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          bump(dir);
        }
      }}
    >
      {glyph}
    </button>
  );

  return (
    <div className="stepper">
      {btn(-1, "Un minuto menos", "−", !vacio && num <= min)}
      <input
        className="stepper-input"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
        inputMode="numeric"
      />
      {btn(1, "Un minuto más", "+", !vacio && num >= max)}
    </div>
  );
}
