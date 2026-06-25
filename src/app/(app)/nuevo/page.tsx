"use client";

import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { usePersons, useMeetings, useRoles, useSuggest, useSections } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/PageHeader";
import { PersonSelect } from "@/components/PersonSelect";
import { SectionSelect } from "@/components/SectionSelect";
import { AsignacionSuggest } from "@/components/AsignacionSuggest";
import { HelperPicker } from "@/components/HelperPicker";
import { DateChips } from "@/components/DateChips";
import { createRecord } from "@/lib/client";

const SALAS = ["Sala A", "Sala B", "Otro"];
type Mode = "asig" | "nombrado";

interface FormState {
  asignadoId: string;
  ayudanteId: string;
  fecha: string;
  sala: string;
  asignacion: string;
  sectionId: string;
  minutos: string;
}
const empty = (): FormState => ({ asignadoId: "", ayudanteId: "", fecha: "", sala: "Sala A", asignacion: "", sectionId: "", minutos: "" });

export default function NuevoPage() {
  const { persons } = usePersons();
  const { meetings } = useMeetings();
  const { roles } = useRoles();
  const { sections } = useSections();
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("asig");
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);

  const activePersons = useMemo(() => persons.filter((p) => p.active), [persons]);
  // En la sub-sección "Nombrados" solo se eligen personas con ese rol.
  const nombradosPersons = useMemo(
    () => activePersons.filter((p) => p.roles.some((r) => r.nombre === "Nombrados")),
    [activePersons],
  );
  const isNombrado = mode === "nombrado";
  const asignadoPersons = isNombrado ? nombradosPersons : activePersons;

  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));
  const switchMode = (m: Mode) => {
    setMode(m);
    setForm(empty());
  };

  // Sugerencias de ayudante solo en modo "Asignación".
  const { candidates } = useSuggest(isNombrado ? "" : form.asignadoId, form.fecha);

  // Secciones marcadas "sin ayudante" (p. ej. Tesoros de la Biblia / Lectura).
  const noHelper = !!sections.find((s) => s.id === form.sectionId)?.sinAyudante;

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
        ayudanteId: isNombrado || noHelper ? null : form.ayudanteId || null,
        fecha: form.fecha,
        sala: form.sala || null,
        asignacion: form.asignacion.trim(),
        tipo: isNombrado ? "NOMBRADO" : "ASIGNACION",
        sectionId: form.sectionId || null,
        minutos: form.minutos ? Number(form.minutos) : null,
      });
      await mutate((k) => typeof k === "string" && k.includes("/api/records"));
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

      {/* Sub-secciones */}
      <div className="view-toggle">
        <button className={`vt-btn${!isNombrado ? " active" : ""}`} onClick={() => switchMode("asig")}>
          Asignación
        </button>
        <button className={`vt-btn${isNombrado ? " active" : ""}`} onClick={() => switchMode("nombrado")}>
          Asignaciones nombrados
        </button>
      </div>

      {/* Barra de progreso */}
      <div className="progress-wrap">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="progress-label">{required}/3</span>
      </div>

      <div className="content-card">
        <div className="form-grid">
          {/* 1 · Asignado / Nombrado */}
          <div className="field-group field-reveal" key={mode}>
            <label className="field-label">
              {isNombrado ? "¿Quién es el nombrado?" : "¿Quién es el asignado?"} <span className="req">*</span>
            </label>
            <PersonSelect
              persons={asignadoPersons}
              value={form.asignadoId}
              excludeId={isNombrado ? undefined : form.ayudanteId}
              onChange={(id) => patch({ asignadoId: id })}
              placeholder={isNombrado ? "Seleccionar nombrado…" : "Seleccionar…"}
            />
          </div>

          {hasAsignado && (
            <>
              {/* 2 · Ayudante + sugerencias (solo en "Asignación" y secciones con ayudante) */}
              {!isNombrado && !noHelper && (
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
              )}

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

              {/* 5 · Sección */}
              {sections.length > 0 && (
                <div className="field-group field-reveal">
                  <label className="field-label">Sección</label>
                  <SectionSelect
                    sections={sections}
                    value={form.sectionId}
                    onChange={(id) =>
                      patch(sections.find((s) => s.id === id)?.sinAyudante ? { sectionId: id, ayudanteId: "" } : { sectionId: id })
                    }
                  />
                </div>
              )}

              {/* 6 · Asignación */}
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
                <AsignacionSuggest
                  sectionId={form.sectionId}
                  value={form.asignacion}
                  onPick={(v, min) => patch(min != null ? { asignacion: v, minutos: String(min) } : { asignacion: v })}
                />
              </div>

              {/* 7 · Duración */}
              <div className="field-group field-reveal">
                <label className="field-label">Duración (min)</label>
                <input
                  type="number"
                  min="1"
                  max="600"
                  value={form.minutos}
                  onChange={(e) => patch({ minutos: e.target.value })}
                  placeholder="—"
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
