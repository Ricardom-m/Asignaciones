"use client";

import { useMemo, useState } from "react";
import { useRoles, useRoster, useSuggest } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { PersonSelect } from "@/components/PersonSelect";
import { SectionSelect } from "@/components/SectionSelect";
import { AsignacionSuggest } from "@/components/AsignacionSuggest";
import { HelperPicker } from "@/components/HelperPicker";
import { agoShort } from "@/components/RosterPanel";
import { createRecord, fmtShort } from "@/lib/client";
import type { Person, Section } from "@/lib/types";

const SALAS = ["Sala A", "Sala B", "Otro"];

interface Props {
  fecha: string;
  sections: Section[];
  persons: Person[];
  defaultAsignadoId?: string;
  defaultSectionId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function PlannerPartModal({ fecha, sections, persons, defaultAsignadoId, defaultSectionId, onClose, onSaved }: Props) {
  const toast = useToast();
  const { roles } = useRoles();
  const { roster } = useRoster(fecha);
  const [sectionId, setSectionId] = useState(defaultSectionId ?? "");
  const [sala, setSala] = useState("Sala A");
  const [asignacion, setAsignacion] = useState("");
  const [asignadoId, setAsignadoId] = useState(defaultAsignadoId ?? "");
  const [ayudanteId, setAyudanteId] = useState("");
  const [saving, setSaving] = useState(false);

  const activePersons = useMemo(() => persons.filter((p) => p.active), [persons]);
  const { candidates } = useSuggest(asignadoId, fecha);

  // Sugerencias de asignado: los más atrasados que NO estén ya ese día.
  const asignadoSugs = useMemo(
    () => roster.filter((r) => !r.assignedOnTarget && r.id !== ayudanteId).slice(0, 6),
    [roster, ayudanteId],
  );

  const save = async () => {
    if (!asignadoId) return toast("⚠️ Selecciona el asignado", "error");
    if (!asignacion.trim()) return toast("⚠️ Escribe la asignación", "error");
    setSaving(true);
    try {
      await createRecord({
        asignadoId,
        ayudanteId: ayudanteId || null,
        fecha,
        sala: sala || null,
        asignacion: asignacion.trim(),
        tipo: "ASIGNACION",
        sectionId: sectionId || null,
      });
      toast("✅ Parte agregada", "success");
      onSaved();
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Agregar parte · ${fmtShort(fecha)}`} onClose={onClose}>
      <div className="form-grid">
        {sections.length > 0 && (
          <div className="field-group">
            <label className="field-label">Sección</label>
            <SectionSelect sections={sections} value={sectionId} onChange={setSectionId} />
          </div>
        )}

        <div className="row-2">
          <div className="field-group">
            <label className="field-label">Sala</label>
            <select value={sala} onChange={(e) => setSala(e.target.value)}>
              {SALAS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label className="field-label">
              Asignación <span className="req">*</span>
            </label>
            <input
              type="text"
              value={asignacion}
              onChange={(e) => setAsignacion(e.target.value)}
              placeholder="Ej. Lectura de la Biblia"
              autoComplete="off"
            />
          </div>
        </div>
        <AsignacionSuggest sectionId={sectionId} value={asignacion} onPick={setAsignacion} />

        <div className="field-group">
          <label className="field-label">
            Asignado <span className="req">*</span>
          </label>
          <PersonSelect persons={activePersons} value={asignadoId} excludeId={ayudanteId} onChange={setAsignadoId} placeholder="Seleccionar…" />
          {asignadoSugs.length > 0 && (
            <div className="sug-row">
              <span className="sug-tip">Le toca:</span>
              {asignadoSugs.map((s) => (
                <button key={s.id} type="button" className="sug-chip" onClick={() => setAsignadoId(s.id)} title={`${s.countMonth} este mes`}>
                  {s.nombre.split(" ")[0]} <span className="sug-ago">{agoShort(s.daysSince)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="field-group">
          <label className="field-label">Ayudante (opcional)</label>
          <PersonSelect persons={activePersons} value={ayudanteId} excludeId={asignadoId} onChange={setAyudanteId} />
          <HelperPicker candidates={candidates} roles={roles} value={ayudanteId} onChange={setAyudanteId} />
        </div>

        <div className="divider" />
        <div className="form-actions">
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Agregar parte"}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}
