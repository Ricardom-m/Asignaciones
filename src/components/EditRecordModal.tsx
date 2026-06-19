"use client";

import { useMemo, useState } from "react";
import { useMeetings, useRoles, useSuggest } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { PersonSelect } from "@/components/PersonSelect";
import { HelperPicker } from "@/components/HelperPicker";
import { DateChips } from "@/components/DateChips";
import { updateRecord } from "@/lib/client";
import type { Person, RecordItem } from "@/lib/types";

const SALAS = ["Sala A", "Sala B", "Otro"];

interface Props {
  rec: RecordItem;
  persons: Person[];
  onClose: () => void;
  onSaved: () => void; // refresca la lista (mutate propio del infinite) y cierra
}

interface FormState {
  asignadoId: string;
  ayudanteId: string;
  fecha: string;
  sala: string;
  asignacion: string;
}

export function EditRecordModal({ rec, persons, onClose, onSaved }: Props) {
  const { meetings } = useMeetings();
  const { roles } = useRoles();
  const toast = useToast();
  const [form, setForm] = useState<FormState>({
    asignadoId: rec.asignadoId,
    ayudanteId: rec.ayudanteId ?? "",
    fecha: rec.fecha,
    sala: rec.sala ?? "Sala A",
    asignacion: rec.asignacion,
  });
  const [saving, setSaving] = useState(false);

  // Solo personas activas, conservando las ya referidas en este registro.
  const formPersons = useMemo(
    () => persons.filter((p) => p.active || p.id === rec.asignadoId || p.id === rec.ayudanteId),
    [persons, rec.asignadoId, rec.ayudanteId],
  );
  const { candidates } = useSuggest(form.asignadoId, form.fecha);
  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  const save = async () => {
    if (!form.asignadoId) return toast("⚠️ Selecciona el nombre del asignado", "error");
    if (!form.fecha) return toast("⚠️ La fecha es obligatoria", "error");
    if (!form.asignacion.trim()) return toast("⚠️ La asignación es obligatoria", "error");

    setSaving(true);
    try {
      await updateRecord(rec.id, {
        asignadoId: form.asignadoId,
        ayudanteId: form.ayudanteId || null,
        fecha: form.fecha,
        sala: form.sala || null,
        asignacion: form.asignacion.trim(),
      });
      toast("✏️ Registro actualizado", "success");
      onSaved();
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Editar registro" onClose={onClose}>
      <div className="form-grid">
        <div className="field-group">
          <label className="field-label">
            Nombre del asignado <span className="req">*</span>
          </label>
          <PersonSelect
            persons={formPersons}
            value={form.asignadoId}
            excludeId={form.ayudanteId}
            onChange={(id) => patch({ asignadoId: id })}
          />
        </div>

        <div className="field-group">
          <label className="field-label">Ayudante del asignado</label>
          <PersonSelect
            persons={formPersons}
            value={form.ayudanteId}
            excludeId={form.asignadoId}
            onChange={(id) => patch({ ayudanteId: id })}
          />
          <HelperPicker
            candidates={candidates}
            roles={roles}
            value={form.ayudanteId}
            onChange={(id) => patch({ ayudanteId: id })}
          />
        </div>

        <div className="field-group">
          <label className="field-label">
            Fecha <span className="req">*</span>
          </label>
          <DateChips value={form.fecha} onChange={(ymd) => patch({ fecha: ymd })} meetings={meetings} />
        </div>

        <div className="field-group">
          <label className="field-label">Sala</label>
          <select value={form.sala} onChange={(e) => patch({ sala: e.target.value })}>
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
            value={form.asignacion}
            onChange={(e) => patch({ asignacion: e.target.value })}
            placeholder="Describe la asignación"
            autoComplete="off"
          />
        </div>

        <div className="divider" />
        <div className="form-actions">
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}
