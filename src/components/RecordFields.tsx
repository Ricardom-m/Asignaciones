"use client";

import { PersonSelect } from "@/components/PersonSelect";
import type { Person } from "@/lib/types";

export interface RecordFormState {
  asignadoId: string;
  ayudanteId: string;
  fecha: string;
  sala: string;
  asignacion: string;
}

interface Props {
  persons: Person[];
  state: RecordFormState;
  onChange: (patch: Partial<RecordFormState>) => void;
}

const SALAS = ["Sala A", "Sala B", "Otro"];

export function RecordFields({ persons, state, onChange }: Props) {
  return (
    <>
      <div className="row-2">
        <div className="field-group">
          <label className="field-label">
            Nombre del asignado <span className="req">*</span>
          </label>
          <PersonSelect
            persons={persons}
            value={state.asignadoId}
            excludeId={state.ayudanteId}
            onChange={(id) => onChange({ asignadoId: id })}
          />
        </div>
        <div className="field-group">
          <label className="field-label">Ayudante del asignado</label>
          <PersonSelect
            persons={persons}
            value={state.ayudanteId}
            excludeId={state.asignadoId}
            onChange={(id) => onChange({ ayudanteId: id })}
          />
        </div>
      </div>

      <div className="row-2">
        <div className="field-group">
          <label className="field-label">
            Fecha <span className="req">*</span>
          </label>
          <input
            type="date"
            value={state.fecha}
            onChange={(e) => onChange({ fecha: e.target.value })}
          />
        </div>
        <div className="field-group">
          <label className="field-label">Sala</label>
          <select value={state.sala} onChange={(e) => onChange({ sala: e.target.value })}>
            {SALAS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field-group">
        <label className="field-label">
          Asignación <span className="req">*</span>
        </label>
        <input
          type="text"
          value={state.asignacion}
          onChange={(e) => onChange({ asignacion: e.target.value })}
          placeholder="Describe la asignación"
          autoComplete="off"
        />
      </div>
    </>
  );
}
