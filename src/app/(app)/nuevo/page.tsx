"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { usePersons } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { RecordFields, type RecordFormState } from "@/components/RecordFields";
import { createRecord, todayYMD } from "@/lib/client";

const emptyForm = (): RecordFormState => ({
  asignadoId: "",
  ayudanteId: "",
  fecha: todayYMD(),
  sala: "Sala A",
  asignacion: "",
});

export default function NuevoPage() {
  const { persons } = usePersons();
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const [form, setForm] = useState<RecordFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<RecordFormState>) => setForm((f) => ({ ...f, ...p }));

  const save = async () => {
    if (!form.asignadoId) return toast("⚠️ Selecciona el nombre del asignado", "error");
    if (!form.fecha) return toast("⚠️ La fecha es obligatoria", "error");
    if (!form.asignacion.trim()) return toast("⚠️ La asignación es obligatoria", "error");

    setSaving(true);
    try {
      await createRecord({
        asignadoId: form.asignadoId,
        ayudanteId: form.ayudanteId || null,
        fecha: form.fecha,
        sala: form.sala || null,
        asignacion: form.asignacion.trim(),
      });
      await mutate((k) => typeof k === "string" && k.startsWith("/api/records"));
      setForm(emptyForm());
      toast("✅ Registro guardado", "success");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-inner fade-up">
      <div className="content-card">
        <div className="section-label">Nuevo registro</div>
        <div className="form-grid">
          <RecordFields persons={persons} state={form} onChange={patch} />
          <div className="divider" />
          <div className="form-actions">
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "Guardando…" : "Guardar registro"}
            </button>
            <button className="btn btn-ghost" onClick={() => setForm(emptyForm())}>
              Limpiar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
