"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSWRConfig } from "swr";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVertical } from "@phosphor-icons/react";
import { usePersons, useSections, useRoles, useMeetings, useDateRecords } from "@/lib/hooks";
import { PageHeader } from "@/components/PageHeader";
import { RosterPanel } from "@/components/RosterPanel";
import { PlannerPartModal } from "@/components/PlannerPartModal";
import { EditRecordModal } from "@/components/EditRecordModal";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/Confirm";
import { GenderIcon } from "@/components/GenderIcon";
import { useIsAdmin } from "@/components/UserContext";
import { arrangeRecords, deleteRecord, fmtShort, relativeLabel, todayYMD, weekdayLabel, weekdayOf } from "@/lib/client";
import type { Person, RecordItem } from "@/lib/types";

const SIN_SECCION = "__none__";

function salaClass(sala: string): string {
  return sala === "Sala A" ? "a" : sala === "Sala B" ? "b" : "otro";
}
// Agrupa por sala (Sala A, Sala B, luego el resto); cada grupo ordenado por `orden`.
function groupBySala(items: RecordItem[]): { sala: string; items: RecordItem[] }[] {
  const map = new Map<string, RecordItem[]>();
  for (const r of items) {
    const k = r.sala || "Otro";
    const arr = map.get(k);
    if (arr) arr.push(r);
    else map.set(k, [r]);
  }
  const ord = (s: string) => (s === "Sala A" ? 0 : s === "Sala B" ? 1 : 2);
  return [...map.entries()]
    .map(([sala, its]) => ({ sala, items: its.sort((a, b) => a.orden - b.orden) }))
    .sort((a, b) => ord(a.sala) - ord(b.sala) || a.sala.localeCompare(b.sala));
}

export default function PlanificarPage() {
  const { meetings } = useMeetings();
  const { sections } = useSections();
  const { roles } = useRoles();
  const { persons } = usePersons();
  const { mutate: globalMutate } = useSWRConfig();
  const toast = useToast();
  const confirm = useConfirm();
  const isAdmin = useIsAdmin();

  const [fecha, setFecha] = useState(todayYMD());
  const initRef = useRef(false);
  useEffect(() => {
    if (!initRef.current && meetings.length) {
      setFecha(meetings[0].fecha);
      initRef.current = true;
    }
  }, [meetings]);

  const { items: dayRecords, mutate: mutateDay } = useDateRecords(fecha || null);
  const personsById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);

  const [adding, setAdding] = useState(false);
  const [prefill, setPrefill] = useState<{ asignadoId?: string; sectionId?: string; sala?: string }>({});
  const [editing, setEditing] = useState<RecordItem | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const refresh = () =>
    globalMutate((k) => typeof k === "string" && (k.includes("/api/records") || k.includes("/api/roster")));

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

  const groups = useMemo(() => {
    const order = [...sections].sort((a, b) => a.orden - b.orden);
    const g: { id: string; nombre: string; unaPorSala: boolean; soloAdmin: boolean; items: RecordItem[] }[] = order.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      unaPorSala: s.unaPorSala,
      soloAdmin: s.soloAdmin,
      items: [],
    }));
    const none: RecordItem[] = [];
    const byId = new Map(g.map((x) => [x.id, x]));
    for (const r of dayRecords) {
      const tgt = r.sectionId ? byId.get(r.sectionId) : null;
      if (tgt) tgt.items.push(r);
      else none.push(r);
    }
    if (none.length) g.push({ id: SIN_SECCION, nombre: "Sin sección", unaPorSala: false, soloAdmin: false, items: none });
    return g;
  }, [sections, dayRecords]);

  const openAdd = (opts: { asignadoId?: string; sectionId?: string; sala?: string } = {}) => {
    setPrefill(opts);
    setAdding(true);
  };

  // Aplica orden/sala con actualización optimista + persistencia.
  const applyArrange = async (updates: { id: string; orden: number; sala?: string | null }[]) => {
    const m = new Map(updates.map((u) => [u.id, u]));
    const next = dayRecords.map((r) => {
      const u = m.get(r.id);
      if (!u) return r;
      return { ...r, orden: u.orden, ...(u.sala !== undefined ? { sala: u.sala ?? null } : {}) };
    });
    mutateDay({ items: next, nextCursor: null }, false);
    try {
      await arrangeRecords(updates);
      refresh();
    } catch (e) {
      mutateDay();
      toast("❌ " + (e as Error).message, "error");
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const a = dayRecords.find((r) => r.id === String(active.id));
    const b = dayRecords.find((r) => r.id === String(over.id));
    if (!a || !b) return;
    if ((a.sectionId ?? "") !== (b.sectionId ?? "")) return; // solo dentro de la misma sección
    const sa = a.sala ?? "Otro";
    const sb = b.sala ?? "Otro";
    if (sa === sb) {
      // Reordenar dentro de la misma sala
      const grp = dayRecords
        .filter((r) => (r.sectionId ?? "") === (a.sectionId ?? "") && (r.sala ?? "Otro") === sa)
        .sort((x, y) => x.orden - y.orden);
      const oldIndex = grp.findIndex((r) => r.id === a.id);
      const newIndex = grp.findIndex((r) => r.id === b.id);
      applyArrange(arrayMove(grp, oldIndex, newIndex).map((r, i) => ({ id: r.id, orden: i })));
    } else {
      // Intercambiar sala (y posición) entre las dos partes
      applyArrange([
        { id: a.id, orden: b.orden, sala: b.sala },
        { id: b.id, orden: a.orden, sala: a.sala },
      ]);
    }
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
  const activeRec = activeId ? dayRecords.find((r) => r.id === activeId) ?? null : null;

  return (
    <div className="page-inner page-inner-wide fade-up">
      <PageHeader title="Planificar" subtitle="Arma la reunión por fecha" />

      {/* Selector de fecha */}
      <div className="content-card">
        <div className="section-label">Reunión</div>
        <div className="plan-dates">
          {upcoming.map((m) => (
            <button key={m.id} className={`reg-pill${fecha === m.fecha ? " active" : ""}`} onClick={() => setFecha(m.fecha)}>
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
            <div className="plan-hint">Arrastra ⠿ para reordenar; suéltala sobre otra parte para intercambiar de sala.</div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={(e) => setActiveId(String(e.active.id))}
              onDragCancel={() => setActiveId(null)}
              onDragEnd={onDragEnd}
            >
              {groups.map((g) => {
                // En secciones "una por sala", solo se puede agregar a la sala que falte.
                const libres = g.unaPorSala
                  ? ["Sala A", "Sala B"].filter((s) => !g.items.some((r) => (r.sala || "Otro") === s))
                  : [];
                const bloqueada = g.soloAdmin && !isAdmin;
                const puedeAgregar = !bloqueada && (!g.unaPorSala || libres.length > 0);
                return (
                <div className="plan-section" key={g.id}>
                  <div className="plan-section-head">
                    <span className="plan-section-title">
                      {g.nombre}
                      {g.soloAdmin && <span className="plan-lock-tag" title="Solo el administrador">🔒</span>}
                    </span>
                    {g.id !== SIN_SECCION && puedeAgregar && (
                      <button
                        className="btn btn-ghost btn-sm plan-add-sec"
                        onClick={() => openAdd(g.unaPorSala ? { sectionId: g.id, sala: libres[0] } : { sectionId: g.id })}
                      >
                        + parte
                      </button>
                    )}
                  </div>
                  {g.items.length === 0 ? (
                    <div className="plan-empty">— sin partes —</div>
                  ) : (
                    <div className="plan-salas">
                    {groupBySala(g.items).map((sg) => (
                      <div className={`plan-sala-group ${salaClass(sg.sala)}`} key={sg.sala}>
                        <div className="plan-sala-head">
                          <span className={`plan-sala-tag ${salaClass(sg.sala)}`}>{sg.sala}</span>
                          <span className="plan-sala-count">{sg.items.length} parte{sg.items.length !== 1 ? "s" : ""}</span>
                          {g.id !== SIN_SECCION && !g.unaPorSala && !bloqueada && (
                            <button className="plan-sala-add" onClick={() => openAdd({ sectionId: g.id, sala: sg.sala })} title={`Agregar parte en ${sg.sala}`}>
                              +
                            </button>
                          )}
                        </div>
                        <SortableContext items={sg.items.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                          {sg.items.map((r) => (
                            <PartRow key={r.id} rec={r} personsById={personsById} dupIds={dupIds} onEdit={() => setEditing(r)} onDelete={() => onDelete(r)} />
                          ))}
                        </SortableContext>
                      </div>
                    ))}
                    </div>
                  )}
                </div>
                );
              })}

              {mounted &&
                createPortal(
                  <DragOverlay>
                    {activeRec ? (
                      <div className="plan-part plan-part-overlay">
                        <span className="plan-grip"><DotsSixVertical size={16} weight="bold" /></span>
                        <PartInner rec={activeRec} personsById={personsById} dupIds={dupIds} />
                      </div>
                    ) : null}
                  </DragOverlay>,
                  document.body,
                )}
            </DndContext>
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
          defaultSala={prefill.sala}
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

function PartInner({ rec, personsById, dupIds }: { rec: RecordItem; personsById: Map<string, Person>; dupIds: Set<string> }) {
  const aP = personsById.get(rec.asignadoId);
  const hP = rec.ayudanteId ? personsById.get(rec.ayudanteId) : undefined;
  const conflict = dupIds.has(rec.asignadoId) || (!!rec.ayudanteId && dupIds.has(rec.ayudanteId));
  return (
    <div className="plan-part-main">
      <div className="plan-part-asig">
        {rec.asignacion}
        {rec.tipo === "NOMBRADO" && <span className="plan-part-tag">nombrado</span>}
        {rec.minutos != null && <span className="plan-part-sala">{rec.minutos} min</span>}
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
  const isAdmin = useIsAdmin();
  const locked = rec.bloqueado && !isAdmin;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rec.id, disabled: locked });
  const conflict = dupIds.has(rec.asignadoId) || (!!rec.ayudanteId && dupIds.has(rec.ayudanteId));
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={`plan-part${conflict ? " conflict" : ""}${isDragging ? " dragging" : ""}`}>
      {locked ? (
        <span className="plan-grip plan-grip-locked" title="Solo el administrador">🔒</span>
      ) : (
        <button className="plan-grip" {...attributes} {...listeners} aria-label="Mover" title="Mover / cambiar de sala">
          <DotsSixVertical size={16} weight="bold" />
        </button>
      )}
      <PartInner rec={rec} personsById={personsById} dupIds={dupIds} />
      {!locked && (
        <div className="plan-part-actions">
          <button className="tl-act" onClick={onEdit} title="Editar" aria-label="Editar">✎</button>
          <button className="tl-act danger" onClick={onDelete} title="Quitar" aria-label="Quitar">✕</button>
        </div>
      )}
    </div>
  );
}
