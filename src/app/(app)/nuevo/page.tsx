"use client";

import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { usePersons, useRecords } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/PageHeader";
import { PersonSelect } from "@/components/PersonSelect";
import { RoleBadge } from "@/components/RoleBadge";
import { createRecord, fmtDate, todayYMD } from "@/lib/client";
import { suggestHelpers } from "@/lib/suggest";

const SALAS = ["Sala A", "Sala B", "Otro"];

interface FormState {
  asignadoId: string;
  ayudanteId: string;
  fecha: string;
  sala: string;
  asignacion: string;
}
const empty = (): FormState => ({ asignadoId: "", ayudanteId: "", fecha: "", sala: "Sala A", asignacion: "" });

// Suma días a una fecha YYYY-MM-DD (en UTC, consistente con todayYMD()).
function addDaysYMD(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function NuevoPage() {
  const { persons } = usePersons();
  const { records } = useRecords();
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);

  const activePersons = useMemo(() => persons.filter((p) => p.active), [persons]);
  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  // Chips rápidos de fecha
  const today = todayYMD();
  const day = new Date(today + "T00:00:00Z").getUTCDay();
  const nextSunday = addDaysYMD(today, (7 - day) % 7);
  const dateChips = [
    { label: "Hoy", ymd: today },
    { label: "Mañana", ymd: addDaysYMD(today, 1) },
    { label: "Domingo", ymd: nextSunday },
  ];

  // Sugerencias de ayudante (personas con quienes casi no ha trabajado)
  const suggestions = useMemo(
    () =>
      form.asignadoId
        ? suggestHelpers({ asignadoId: form.asignadoId, persons: activePersons, records, fecha: form.fecha, max: 3 })
        : [],
    [form.asignadoId, form.fecha, activePersons, records],
  );

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
                {suggestions.length > 0 && (
                  <div className="suggest-block">
                    <div className="suggest-tip">💡 Sugerencias de ayudante</div>
                    <div className="suggest-list">
                      {suggestions.map((s) => (
                        <button
                          key={s.person.id}
                          type="button"
                          className={`suggest-item${form.ayudanteId === s.person.id ? " on" : ""}`}
                          onClick={() => patch({ ayudanteId: s.person.id })}
                        >
                          <div className="suggest-item-main">
                            <div className="suggest-item-name">
                              {s.person.nombre} {s.person.apellido}
                              {s.person.roles[0] && <RoleBadge role={s.person.roles[0]} />}
                            </div>
                            <div className="suggest-item-reason">{s.reason}</div>
                          </div>
                          {form.ayudanteId === s.person.id && <span className="suggest-check">✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 3 · Fecha + chips */}
              <div className="field-group field-reveal">
                <label className="field-label">
                  ¿Para cuándo? <span className="req">*</span>
                </label>
                <div className="date-chips">
                  {dateChips.map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      className={`date-chip${form.fecha === c.ymd ? " on" : ""}`}
                      onClick={() => patch({ fecha: c.ymd })}
                    >
                      {c.label}
                    </button>
                  ))}
                  <input type="date" value={form.fecha} onChange={(e) => patch({ fecha: e.target.value })} style={{ flex: 1, minWidth: 130 }} />
                </div>
                {form.fecha && <div className="field-hint">📅 {fmtDate(form.fecha)}</div>}
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
