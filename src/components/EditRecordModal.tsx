"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { RecordFields, type RecordFormState } from "@/components/RecordFields";
import { useToast } from "@/components/Toast";
import { updateRecord } from "@/lib/client";
import type { Person, RecordItem } from "@/lib/types";

interface Props {
  rec: RecordItem;
  persons: Person[];
  onClose: () => void;
}

export function EditRecordModal({ rec, persons, onClose }: Props) {
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const [form, setForm] = useState<RecordFormState>({
    asignadoId: rec.asignadoId,
    ayudanteId: rec.ayudanteId ?? "",
    fecha: rec.fecha,
    sala: rec.sala ?? "Sala A",
    asignacion: rec.asignacion,
  });
  const [saving, setSaving] = useState(false);

  // Solo personas activas, pero conservando las ya referidas en este registro.
  const formPersons = persons.filter(
    (p) => p.active || p.id === rec.asignadoId || p.id === rec.ayudanteId,
  );
  const patch = (p: Partial<RecordFormState>) => setForm((f) => ({ ...f, ...p }));

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
      await mutate((k) => typeof k === "string" && k.startsWith("/api/records"));
      toast("✏️ Registro actualizado", "success");
      onClose();
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Editar registro</span>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="form-grid">
          <RecordFields persons={formPersons} state={form} onChange={patch} />
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
      </div>
    </div>
  );
}
