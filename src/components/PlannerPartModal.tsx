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
import { createRecord, esLectura, eligibleLectura, fmtShort } from "@/lib/client";
import { SECCION_TESOROS, esEstudio, norm } from "@/lib/sections";
import type { Person, Section } from "@/lib/types";

const soloNombrados = (ps: Person[]) => ps.filter((p) => p.roles.some((r) => r.nombre === "Nombrados"));
const soloAsignados = (ps: Person[]) => ps.filter((p) => p.roles.some((r) => r.nombre === "Asignados"));

const SALAS = ["Sala A", "Sala B", "Otro"];

interface Props {
  fecha: string;
  sections: Section[];
  persons: Person[];
  defaultAsignadoId?: string;
  defaultSectionId?: string;
  defaultSala?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function PlannerPartModal({ fecha, sections, persons, defaultAsignadoId, defaultSectionId, defaultSala, onClose, onSaved }: Props) {
  const toast = useToast();
  const { roles } = useRoles();
  const [sectionId, setSectionId] = useState(defaultSectionId ?? "");
  const [sala, setSala] = useState(defaultSala ?? "Sala A");
  const [asignacion, setAsignacion] = useState("");
  const [minutos, setMinutos] = useState("");
  const [asignadoId, setAsignadoId] = useState(defaultAsignadoId ?? "");
  const [ayudanteId, setAyudanteId] = useState("");
  const [tipo, setTipo] = useState<"ASIGNACION" | "NOMBRADO">("ASIGNACION");
  const [saving, setSaving] = useState(false);

  const nombrado = tipo === "NOMBRADO";
  const activePersons = useMemo(() => persons.filter((p) => p.active), [persons]);
  const { candidates } = useSuggest(nombrado ? "" : asignadoId, fecha);
  // Estudio bíblico de congregación: asignado = Conductor (Nombrados), ayudante = Lector (Asignados).
  const estudio = esEstudio(asignacion);
  // Recencia por rol/asignación en el Estudio; por sección en lo demás.
  const { roster } = useRoster(fecha, undefined, undefined, estudio ? undefined : sectionId || undefined, estudio ? asignacion : undefined);
  // Sin ayudante: en nombrados o en secciones marcadas así (pero el Estudio sí lleva Lector).
  const noHelper = !estudio && (nombrado || !!sections.find((s) => s.id === sectionId)?.sinAyudante);

  // Filtro del asignado según el caso.
  const lectura = esLectura(asignacion);
  const esTesoros = norm(sections.find((s) => s.id === sectionId)?.nombre ?? "") === norm(SECCION_TESOROS);
  const asignadoPool = useMemo(() => {
    if (estudio) return soloNombrados(activePersons); // Conductor
    if (nombrado) return soloNombrados(activePersons);
    if (lectura) return eligibleLectura(activePersons);
    if (esTesoros) return soloNombrados(activePersons); // Discurso y Busquemos perlas → solo Nombrados
    return activePersons;
  }, [estudio, nombrado, lectura, esTesoros, activePersons]);
  const ayudantePool = useMemo(() => (estudio ? soloAsignados(activePersons) : activePersons), [estudio, activePersons]);
  const poolIds = useMemo(() => new Set(asignadoPool.map((p) => p.id)), [asignadoPool]);

  // Sugerencias de asignado: los más atrasados que NO estén ya ese día (y elegibles).
  const asignadoSugs = useMemo(
    () => roster.filter((r) => !r.assignedOnTarget && r.id !== ayudanteId && poolIds.has(r.id)).slice(0, 6),
    [roster, ayudanteId, poolIds],
  );

  // Datos de decisión por persona para enriquecer el selector de asignado.
  const rosterMeta = useMemo(
    () =>
      new Map(
        roster.map((r) => [
          r.id,
          { daysSince: r.daysSince, countMonth: r.countMonth, assignedOnTarget: r.assignedOnTarget, daysSinceSection: estudio ? r.daysSinceAsignacion : r.daysSinceSection },
        ]),
      ),
    [roster, estudio],
  );
  const sectionLabel = useMemo(() => sections.find((s) => s.id === sectionId)?.nombre.split(" ")[0], [sections, sectionId]);

  const save = async () => {
    if (!asignadoId) return toast("⚠️ Selecciona el asignado", "error");
    if (!asignacion.trim()) return toast("⚠️ Escribe la asignación", "error");
    setSaving(true);
    try {
      await createRecord({
        asignadoId,
        ayudanteId: noHelper ? null : ayudanteId || null,
        fecha,
        sala: sala || null,
        asignacion: asignacion.trim(),
        tipo,
        sectionId: sectionId || null,
        minutos: minutos ? Number(minutos) : null,
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
        <div className="view-toggle">
          <button className={`vt-btn${!nombrado ? " active" : ""}`} onClick={() => setTipo("ASIGNACION")}>
            Asignación
          </button>
          <button
            className={`vt-btn${nombrado ? " active" : ""}`}
            onClick={() => { setTipo("NOMBRADO"); setAyudanteId(""); }}
          >
            Nombrado
          </button>
        </div>

        {sections.length > 0 && (
          <div className="field-group">
            <label className="field-label">Sección</label>
            <SectionSelect
              sections={sections.filter((s) => !s.sinPersona)}
              value={sectionId}
              onChange={(id) => {
                setSectionId(id);
                if (sections.find((s) => s.id === id)?.sinAyudante) setAyudanteId("");
              }}
            />
          </div>
        )}

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
          <AsignacionSuggest
            sectionId={sectionId}
            value={asignacion}
            onPick={(v, min) => {
              setAsignacion(v);
              if (min != null) setMinutos(String(min));
            }}
          />
        </div>
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
            <label className="field-label">Duración (min)</label>
            <input type="number" min="1" max="600" value={minutos} onChange={(e) => setMinutos(e.target.value)} placeholder="—" />
          </div>
        </div>

        <div className="field-group">
          <label className="field-label">
            {estudio ? "Conductor" : nombrado ? "Nombrado" : "Asignado"} <span className="req">*</span>
          </label>
          <PersonSelect
            persons={asignadoPool}
            value={asignadoId}
            excludeId={ayudanteId}
            onChange={setAsignadoId}
            placeholder="Seleccionar…"
            meta={rosterMeta}
            sectionLabel={estudio ? asignacion : sectionId ? sectionLabel : undefined}
          />
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

        {!noHelper && (
          <div className="field-group">
            <label className="field-label">{estudio ? "Lector" : "Ayudante (opcional)"}</label>
            <PersonSelect
              persons={ayudantePool}
              value={ayudanteId}
              excludeId={asignadoId}
              onChange={setAyudanteId}
              meta={rosterMeta}
              sectionLabel={estudio ? asignacion : sectionId ? sectionLabel : undefined}
            />
            {!estudio && <HelperPicker candidates={candidates} roles={roles} value={ayudanteId} onChange={setAyudanteId} />}
          </div>
        )}

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
