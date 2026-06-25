"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { usePersons, useSections, useRoles, useMeetings, useDateRecords } from "@/lib/hooks";
import { PageHeader } from "@/components/PageHeader";
import { RosterPanel } from "@/components/RosterPanel";
import { PlannerPartModal } from "@/components/PlannerPartModal";
import { EditRecordModal } from "@/components/EditRecordModal";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/Confirm";
import { GenderIcon } from "@/components/GenderIcon";
import { deleteRecord, fmtShort, relativeLabel, todayYMD, weekdayLabel, weekdayOf } from "@/lib/client";
import type { Person, RecordItem } from "@/lib/types";

const SIN_SECCION = "__none__";

export default function PlanificarPage() {
  const { meetings } = useMeetings();
  const { sections } = useSections();
  const { roles } = useRoles();
  const { persons } = usePersons();
  const { mutate: globalMutate } = useSWRConfig();
  const toast = useToast();
  const confirm = useConfirm();

  const [fecha, setFecha] = useState(todayYMD());
  const initRef = useRef(false);
  useEffect(() => {
    if (!initRef.current && meetings.length) {
      setFecha(meetings[0].fecha);
      initRef.current = true;
    }
  }, [meetings]);

  const { items: dayRecords } = useDateRecords(fecha || null);
  const personsById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);

  const [adding, setAdding] = useState(false);
  const [prefill, setPrefill] = useState<{ asignadoId?: string; sectionId?: string }>({});
  const [editing, setEditing] = useState<RecordItem | null>(null);

  const refresh = () =>
    globalMutate((k) => typeof k === "string" && (k.includes("/api/records") || k.includes("/api/roster")));

  // Conflictos: personas (asignado o ayudante) que aparecen más de una vez ese día.
  const dupIds = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of dayRecords) {
      for (const id of [r.asignadoId, r.ayudanteId]) if (id) count.set(id, (count.get(id) ?? 0) + 1);
    }
    return new Set([...count].filter(([, n]) => n > 1).map(([id]) => id));
  }, [dayRecords]);
  const conflictCount = useMemo(
    () => dayRecords.filter((r) => dupIds.has(r.asignadoId) || (r.ayudanteId && dupIds.has(r.ayudanteId))).length,
    [dayRecords, dupIds],
  );

  // Agrupar por sección (en orden), incluyendo "sin sección".
  const groups = useMemo(() => {
    const order = [...sections].sort((a, b) => a.orden - b.orden);
    const g: { id: string; nombre: string; items: RecordItem[] }[] = order.map((s) => ({ id: s.id, nombre: s.nombre, items: [] }));
    const none: RecordItem[] = [];
    const byId = new Map(g.map((x) => [x.id, x]));
    for (const r of dayRecords) {
      const tgt = r.sectionId ? byId.get(r.sectionId) : null;
      if (tgt) tgt.items.push(r);
      else none.push(r);
    }
    for (const grp of g) grp.items.sort((a, b) => (a.sala ?? "").localeCompare(b.sala ?? ""));
    if (none.length) g.push({ id: SIN_SECCION, nombre: "Sin sección", items: none });
    return g;
  }, [sections, dayRecords]);

  const openAdd = (opts: { asignadoId?: string; sectionId?: string } = {}) => {
    setPrefill(opts);
    setAdding(true);
  };

  const onDelete = async (rec: RecordItem) => {
    const ok = await confirm({
      title: "Quitar parte",
      message: `¿Quitar "${rec.asignacion}" de ${rec.asignado}?`,
      confirmText: "Quitar",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteRecord(rec.id);
      refresh();
      toast("🗑️ Parte quitada");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    }
  };

  const upcoming = meetings.slice(0, 6);
  const dow = fecha ? weekdayLabel(weekdayOf(fecha)) : "";

  return (
    <div className="page-inner fade-up">
      <PageHeader title="Planificar" subtitle="Arma la reunión por fecha" />

      {/* Selector de fecha */}
      <div className="content-card">
        <div className="section-label">Reunión</div>
        <div className="plan-dates">
          {upcoming.map((m) => (
            <button
              key={m.id}
              className={`reg-pill${fecha === m.fecha ? " active" : ""}`}
              onClick={() => setFecha(m.fecha)}
            >
              {fmtShort(m.fecha)}
            </button>
          ))}
        </div>
        <div className="plan-date-custom">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <span className="plan-date-meta">
            {dow} · {fecha ? relativeLabel(fecha) : ""}
          </span>
        </div>
      </div>

      <div className="plan-grid">
        {/* Panorama de la reunión */}
        <div className="plan-main">
          <div className="content-card">
            <div className="plan-head">
              <div className="section-label" style={{ margin: 0 }}>
                Panorama · {dayRecords.length} parte{dayRecords.length !== 1 ? "s" : ""}
                {conflictCount > 0 && <span className="plan-conflict-pill">⚠ {conflictCount} en conflicto</span>}
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => openAdd()}>
                + Parte
              </button>
            </div>

            {groups.map((g) => (
              <div className="plan-section" key={g.id}>
                <div className="plan-section-head">
                  <span className="plan-section-title">{g.nombre}</span>
                  {g.id !== SIN_SECCION && (
                    <button className="btn btn-ghost btn-sm plan-add-sec" onClick={() => openAdd({ sectionId: g.id })}>
                      + parte
                    </button>
                  )}
                </div>
                {g.items.length === 0 ? (
                  <div className="plan-empty">— sin partes —</div>
                ) : (
                  g.items.map((r) => (
                    <PartRow key={r.id} rec={r} personsById={personsById} dupIds={dupIds} onEdit={() => setEditing(r)} onDelete={() => onDelete(r)} />
                  ))
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Roster de equidad */}
        <aside className="plan-aside">
          {fecha && <RosterPanel fecha={fecha} roles={roles} onPick={(id) => openAdd({ asignadoId: id })} />}
        </aside>
      </div>

      {adding && fecha && (
        <PlannerPartModal
          fecha={fecha}
          sections={sections}
          persons={persons}
          defaultAsignadoId={prefill.asignadoId}
          defaultSectionId={prefill.sectionId}
          onClose={() => setAdding(false)}
          onSaved={() => { refresh(); setAdding(false); }}
        />
      )}
      {editing && (
        <EditRecordModal
          rec={editing}
          persons={persons}
          onClose={() => setEditing(null)}
          onSaved={() => { refresh(); setEditing(null); }}
        />
      )}
    </div>
  );
}

function PartRow({
  rec,
  personsById,
  dupIds,
  onEdit,
  onDelete,
}: {
  rec: RecordItem;
  personsById: Map<string, Person>;
  dupIds: Set<string>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const aP = personsById.get(rec.asignadoId);
  const hP = rec.ayudanteId ? personsById.get(rec.ayudanteId) : undefined;
  const conflict = dupIds.has(rec.asignadoId) || (!!rec.ayudanteId && dupIds.has(rec.ayudanteId));

  return (
    <div className={`plan-part${conflict ? " conflict" : ""}`}>
      <div className="plan-part-main">
        <div className="plan-part-asig">
          {rec.asignacion}
          {rec.sala && <span className="plan-part-sala">{rec.sala}</span>}
          {conflict && <span className="plan-part-warn" title="Esta persona ya tiene otra parte ese día">⚠ repetido</span>}
        </div>
        <div className="plan-part-people">
          {aP && <GenderIcon genero={aP.genero} />}
          <span className="plan-part-name">{rec.asignado}</span>
          {rec.ayudante && (
            <>
              <span className="plan-part-con">con</span>
              {hP && <GenderIcon genero={hP.genero} />}
              <span className="plan-part-name">{rec.ayudante}</span>
            </>
          )}
        </div>
      </div>
      <div className="plan-part-actions">
        <button className="tl-act" onClick={onEdit} title="Editar" aria-label="Editar">✎</button>
        <button className="tl-act danger" onClick={onDelete} title="Quitar" aria-label="Quitar">✕</button>
      </div>
    </div>
  );
}
