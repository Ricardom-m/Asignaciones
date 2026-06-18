"use client";

import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { usePersons, useMeetings, useRoles, useSuggest } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/PageHeader";
import { PersonSelect } from "@/components/PersonSelect";
import { HelperPicker } from "@/components/HelperPicker";
import { DateChips } from "@/components/DateChips";
import { createRecord } from "@/lib/client";

const SALAS = ["Sala A", "Sala B", "Otro"];

interface FormState {
  asignadoId: string;
  ayudanteId: string;
  fecha: string;
  sala: string;
  asignacion: string;
}
const empty = (): FormState => ({ asignadoId: "", ayudanteId: "", fecha: "", sala: "Sala A", asignacion: "" });

export default function NuevoPage() {
  const { persons } = usePersons();
  const { meetings } = useMeetings();
  const { roles } = useRoles();
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);

  const activePersons = useMemo(() => persons.filter((p) => p.active), [persons]);
  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  // Candidatos a ayudante, rankeados en el servidor (compatibles por género).
  const { candidates } = useSuggest(form.asignadoId, form.fecha);

  // Revelado progresivo
  const hasAsignado = !!form.asignadoId;
  const hasFecha = !!form.fecha;
  const required = [form.asignadoId, form.fecha, form.asignacion.trim()].filter(Boolean).length;
  const progress = Math.round((required / 3) * 100);
  const canSave = required === 3;

  const save = async () => {
    if (!canSave) return;
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
      setForm(empty());
      toast("✅ Registro guardado", "success");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-inner fade-up">
      <PageHeader title="Nuevo registro" subtitle="Completa los campos paso a paso" />

      {/* Barra de progreso */}
      <div className="progress-wrap">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="progress-label">{required}/3</span>
      </div>

      <div className="content-card">
        <div className="form-grid">
          {/* 1 · Asignado */}
          <div className="field-group field-reveal">
            <label className="field-label">
              ¿Quién es el asignado? <span className="req">*</span>
            </label>
            <PersonSelect
              persons={activePersons}
              value={form.asignadoId}
              excludeId={form.ayudanteId}
              onChange={(id) => patch({ asignadoId: id })}
            />
          </div>

          {hasAsignado && (
            <>
              {/* 2 · Ayudante + sugerencias */}
              <div className="field-group field-reveal">
                <label className="field-label">Ayudante (opcional)</label>
                <PersonSelect
                  persons={activePersons}
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

              {/* 3 · Fecha + chips */}
              <div className="field-group field-reveal">
                <label className="field-label">
                  ¿Para cuándo? <span className="req">*</span>
                </label>
                <DateChips value={form.fecha} onChange={(ymd) => patch({ fecha: ymd })} meetings={meetings} />
              </div>
            </>
          )}

          {hasAsignado && hasFecha && (
            <>
              {/* 4 · Sala */}
              <div className="field-group field-reveal">
                <label className="field-label">Sala</label>
                <select value={form.sala} onChange={(e) => patch({ sala: e.target.value })}>
                  {SALAS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* 5 · Asignación */}
              <div className="field-group field-reveal">
                <label className="field-label">
                  ¿Qué asignación? <span className="req">*</span>
                </label>
                <input
                  type="text"
                  value={form.asignacion}
                  onChange={(e) => patch({ asignacion: e.target.value })}
                  placeholder="Describe la asignación"
                  autoComplete="off"
                  autoFocus
                />
              </div>

              <div className="divider" />
              <div className="form-actions field-reveal">
                <button className={`btn btn-primary${canSave ? " ready" : ""}`} onClick={save} disabled={!canSave || saving}>
                  {saving ? "Guardando…" : "Guardar registro"}
                </button>
                <button className="btn btn-ghost" onClick={() => setForm(empty())}>
                  Limpiar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
