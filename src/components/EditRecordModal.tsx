"use client";

import { useMemo, useState } from "react";
import { useMeetings, useRoles, useSuggest, useSections, useRoster } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { PersonSelect } from "@/components/PersonSelect";
import { SectionSelect } from "@/components/SectionSelect";
import { AsignacionSuggest } from "@/components/AsignacionSuggest";
import { HelperPicker } from "@/components/HelperPicker";
import { DateChips } from "@/components/DateChips";
import { updateRecord, esLectura, eligibleLectura } from "@/lib/client";
import { SECCION_TESOROS, SECCION_VIDA, esEstudio, esNecesidades, norm } from "@/lib/sections";
import type { Person, RecordItem } from "@/lib/types";

const soloNombrados = (ps: Person[]) => ps.filter((p) => p.roles.some((r) => r.nombre === "Nombrados"));
// Lector del Estudio bíblico: Asignados o Nombrados.
const lectorEstudio = (ps: Person[]) => ps.filter((p) => p.roles.some((r) => r.nombre === "Asignados" || r.nombre === "Nombrados"));

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
  sectionId: string;
  minutos: string;
}

export function EditRecordModal({ rec, persons, onClose, onSaved }: Props) {
  const { meetings } = useMeetings();
  const { roles } = useRoles();
  const { sections } = useSections();
  const toast = useToast();
  const [form, setForm] = useState<FormState>({
    asignadoId: rec.asignadoId ?? "",
    ayudanteId: rec.ayudanteId ?? "",
    fecha: rec.fecha,
    sala: rec.sala ?? "Sala A",
    asignacion: rec.asignacion,
    sectionId: rec.sectionId ?? "",
    minutos: rec.minutos != null ? String(rec.minutos) : "",
  });
  const [saving, setSaving] = useState(false);

  const isNombrado = rec.tipo === "NOMBRADO";
  // Estudio = Conductor (Nombrados) + Lector (Asignados). Necesidades = Nombrados, sin ayudante.
  const estudio = esEstudio(form.asignacion);
  const necesidades = esNecesidades(form.asignacion);
  const porAsignacion = estudio || necesidades;
  const lectura = esLectura(form.asignacion);
  const secNombre = norm(sections.find((s) => s.id === form.sectionId)?.nombre ?? "");
  const esTesoros = secNombre === norm(SECCION_TESOROS);
  const esVida = secNombre === norm(SECCION_VIDA);
  // "Asignación de nombrados": toda Nuestra vida + discurso/perlas de Tesoros.
  const forzarNombrado = esVida || (esTesoros && !lectura);
  const esNombradoFinal = forzarNombrado || isNombrado || estudio || necesidades;
  const noHelper = !estudio && (esNombradoFinal || !!sections.find((s) => s.id === form.sectionId)?.sinAyudante);

  // Solo personas activas, conservando las ya referidas en este registro.
  const formPersons = useMemo(
    () => persons.filter((p) => p.active || p.id === rec.asignadoId || p.id === rec.ayudanteId),
    [persons, rec.asignadoId, rec.ayudanteId],
  );
  const conActual = (elig: Person[], keepId: string | null) =>
    elig.some((p) => p.id === keepId) ? elig : [...elig, ...formPersons.filter((p) => p.id === keepId)];
  const asignadoPersons = useMemo(() => {
    if (lectura) return conActual(eligibleLectura(formPersons), rec.asignadoId);
    if (esNombradoFinal) return conActual(soloNombrados(formPersons), rec.asignadoId);
    return formPersons;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectura, esNombradoFinal, formPersons, rec.asignadoId]);
  const ayudantePersons = useMemo(
    () => (estudio ? conActual(lectorEstudio(formPersons), rec.ayudanteId) : formPersons),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [estudio, formPersons, rec.ayudanteId],
  );
  const { candidates } = useSuggest(isNombrado ? "" : form.asignadoId, form.fecha);

  // Datos de decisión por persona. En el Estudio la recencia es por rol/asignación
  // ("última vez en el Estudio"); en lo demás, por sección.
  const { roster } = useRoster(
    form.fecha || null,
    undefined,
    undefined,
    porAsignacion ? undefined : form.sectionId || undefined,
    porAsignacion ? form.asignacion : undefined,
  );
  const rosterMeta = useMemo(
    () =>
      new Map(
        roster.map((r) => [
          r.id,
          { daysSince: r.daysSince, countMonth: r.countMonth, assignedOnTarget: r.assignedOnTarget, daysSinceSection: porAsignacion ? r.daysSinceAsignacion : r.daysSinceSection },
        ]),
      ),
    [roster, porAsignacion],
  );
  const sectionLabel = useMemo(() => sections.find((s) => s.id === form.sectionId)?.nombre.split(" ")[0], [sections, form.sectionId]);

  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  const save = async () => {
    if (!form.asignadoId) return toast("⚠️ Selecciona el nombre del asignado", "error");
    if (!form.fecha) return toast("⚠️ La fecha es obligatoria", "error");
    if (!form.asignacion.trim()) return toast("⚠️ La asignación es obligatoria", "error");

    setSaving(true);
    try {
      await updateRecord(rec.id, {
        asignadoId: form.asignadoId,
        ayudanteId: noHelper ? null : form.ayudanteId || null,
        fecha: form.fecha,
        sala: form.sala || null,
        asignacion: form.asignacion.trim(),
        tipo: esNombradoFinal ? "NOMBRADO" : "ASIGNACION",
        sectionId: form.sectionId || null,
        minutos: form.minutos ? Number(form.minutos) : null,
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
    <Modal title={isNombrado ? "Editar nombrado" : "Editar registro"} onClose={onClose}>
      <div className="form-grid">
        <div className="field-group">
          <label className="field-label">
            {estudio ? "Conductor" : esNombradoFinal ? "Nombre del nombrado" : "Nombre del asignado"} <span className="req">*</span>
          </label>
          <PersonSelect
            persons={asignadoPersons}
            value={form.asignadoId}
            excludeId={noHelper ? undefined : form.ayudanteId}
            onChange={(id) => patch({ asignadoId: id })}
            meta={rosterMeta}
            sectionLabel={porAsignacion ? form.asignacion : form.sectionId ? sectionLabel : undefined}
          />
        </div>

        {!noHelper && (
          <div className="field-group">
            <label className="field-label">{estudio ? "Lector" : "Ayudante del asignado"}</label>
            <PersonSelect
              persons={ayudantePersons}
              value={form.ayudanteId}
              excludeId={form.asignadoId}
              onChange={(id) => patch({ ayudanteId: id })}
              meta={rosterMeta}
              sectionLabel={estudio ? form.asignacion : form.sectionId ? sectionLabel : undefined}
            />
            {!estudio && (
              <HelperPicker
                candidates={candidates}
                roles={roles}
                value={form.ayudanteId}
                onChange={(id) => patch({ ayudanteId: id })}
              />
            )}
          </div>
        )}

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

        {sections.length > 0 && (
          <div className="field-group">
            <label className="field-label">Sección</label>
            <SectionSelect
              sections={sections.filter((s) => !s.sinPersona)}
              value={form.sectionId}
              onChange={(id) =>
                patch(sections.find((s) => s.id === id)?.sinAyudante ? { sectionId: id, ayudanteId: "" } : { sectionId: id })
              }
            />
          </div>
        )}

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
          <AsignacionSuggest
            sectionId={form.sectionId}
            value={form.asignacion}
            onPick={(v, min) => patch(min != null ? { asignacion: v, minutos: String(min) } : { asignacion: v })}
          />
        </div>

        <div className="field-group">
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
