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
import { DotsSixVertical, CaretRight, GearSix } from "@phosphor-icons/react";
import { usePersons, useSections, useRoles, useMeetings, useMeetingConfig, useDateRecords, useRoster } from "@/lib/hooks";
import { PageHeader } from "@/components/PageHeader";
import { ConfigFechas } from "@/components/ConfigFechas";
import { MeetingDatePicker } from "@/components/MeetingDatePicker";
import { RosterPanel, agoShort } from "@/components/RosterPanel";
import { PlannerPartModal } from "@/components/PlannerPartModal";
import { EditRecordModal } from "@/components/EditRecordModal";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/Confirm";
import { GenderIcon } from "@/components/GenderIcon";
import { useIsAdmin } from "@/components/UserContext";
import { addDaysYMD, arrangeRecords, deleteRecord, ensureInicio, esLectura, fmtShort, nextWeekdayDates, relativeLabel, todayYMD, updateRecord, weekdayLabel, weekdayOf } from "@/lib/client";
import { PersonSelect } from "@/components/PersonSelect";
import { SECCION_TESOROS, SECCION_VIDA, PARTE_PALABRAS_CONCLUSION, esCancion, esEstudio, esParteSinPersona, esRolNombrado, inicioRank, norm, tesorosRank, vidaRank } from "@/lib/sections";
import type { Person, RecordItem } from "@/lib/types";

const SIN_SECCION = "__none__";

// Partes "del medio" de Nuestra vida (reordenables): las que no son fijas
// (ni Canción, ni Oración, ni Estudio, ni Palabras de conclusión).
function esMedioVida(r: RecordItem): boolean {
  return (
    !esCancion(r.asignacion) &&
    !esRolNombrado(r.asignacion) &&
    !esEstudio(r.asignacion) &&
    norm(r.asignacion) !== norm(PARTE_PALABRAS_CONCLUSION)
  );
}

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
  const { config } = useMeetingConfig();
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
  const nombrados = useMemo(() => persons.filter((p) => p.active && p.roles.some((r) => r.nombre === "Nombrados")), [persons]);

  // Al abrir una fecha, asegura las partes fijas de "Inicio" (Canción + Palabras).
  const ensuredRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!fecha || ensuredRef.current.has(fecha)) return;
    ensuredRef.current.add(fecha);
    ensureInicio(fecha)
      .then((res) => {
        if (res.sectionCreated) globalMutate((k) => typeof k === "string" && k.includes("/api/sections"));
        if (res.created > 0) mutateDay();
      })
      .catch(() => ensuredRef.current.delete(fecha));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  const [adding, setAdding] = useState(false);
  const [prefill, setPrefill] = useState<{ asignadoId?: string; sectionId?: string; sala?: string }>({});
  const [editing, setEditing] = useState<RecordItem | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [showConfig, setShowConfig] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const refresh = () =>
    globalMutate((k) => typeof k === "string" && (k.includes("/api/records") || k.includes("/api/roster")));

  // Las partes de Inicio (Presidente/Consejero/Oración) pueden tener a la misma
  // persona, así que no cuentan para la detección de "repetido ese día".
  const sinPersonaIds = useMemo(() => new Set(sections.filter((s) => s.sinPersona).map((s) => s.id)), [sections]);
  const esInicio = (r: RecordItem) => !!r.sectionId && sinPersonaIds.has(r.sectionId);

  const dupIds = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of dayRecords) {
      if (esInicio(r)) continue;
      for (const id of [r.asignadoId, r.ayudanteId]) if (id) count.set(id, (count.get(id) ?? 0) + 1);
    }
    return new Set([...count].filter(([, n]) => n > 1).map(([id]) => id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayRecords, sinPersonaIds]);
  const conflictCount = useMemo(
    () =>
      dayRecords.filter((r) => !esInicio(r) && ((!!r.asignadoId && dupIds.has(r.asignadoId)) || (!!r.ayudanteId && dupIds.has(r.ayudanteId)))).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayRecords, dupIds, sinPersonaIds],
  );

  const groups = useMemo(() => {
    const order = [...sections].sort((a, b) => a.orden - b.orden);
    const g: { id: string; nombre: string; unaPorSala: boolean; soloAdmin: boolean; sinPersona: boolean; items: RecordItem[] }[] = order.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      unaPorSala: s.unaPorSala,
      soloAdmin: s.soloAdmin,
      sinPersona: s.sinPersona,
      items: [],
    }));
    const none: RecordItem[] = [];
    const byId = new Map(g.map((x) => [x.id, x]));
    for (const r of dayRecords) {
      const tgt = r.sectionId ? byId.get(r.sectionId) : null;
      if (tgt) tgt.items.push(r);
      else none.push(r);
    }
    if (none.length) g.push({ id: SIN_SECCION, nombre: "Sin sección", unaPorSala: false, soloAdmin: false, sinPersona: false, items: none });
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
      toast("💾 Orden actualizado", "success");
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

    // Nuestra vida: solo se reordenan las partes del medio (ignora sala).
    const secA = sections.find((s) => s.id === a.sectionId);
    if (secA && norm(secA.nombre) === norm(SECCION_VIDA)) {
      if (!esMedioVida(a) || !esMedioVida(b)) return;
      const grp = dayRecords.filter((r) => r.sectionId === a.sectionId && esMedioVida(r)).sort((x, y) => x.orden - y.orden);
      const oldIndex = grp.findIndex((r) => r.id === a.id);
      const newIndex = grp.findIndex((r) => r.id === b.id);
      applyArrange(arrayMove(grp, oldIndex, newIndex).map((r, i) => ({ id: r.id, orden: i })));
      return;
    }

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

  // Guarda el número de cántico (parte "Canción" de Inicio) con update optimista.
  const saveCantico = async (rec: RecordItem, cantico: number | null) => {
    const next = dayRecords.map((r) => (r.id === rec.id ? { ...r, cantico } : r));
    mutateDay({ items: next, nextCursor: null }, false);
    try {
      await updateRecord(rec.id, {
        asignadoId: null,
        ayudanteId: null,
        fecha: rec.fecha,
        sala: rec.sala,
        asignacion: rec.asignacion,
        sectionId: rec.sectionId,
        minutos: rec.minutos,
        cantico,
      });
      toast("💾 Cántico guardado", "success");
    } catch (e) {
      mutateDay();
      toast("❌ " + (e as Error).message, "error");
    }
  };

  // Asigna/limpia el Nombrado de una parte de Inicio (Presidente, Consejero, Oración).
  // La misma persona puede ocupar los 3 roles.
  const savePersona = async (rec: RecordItem, id: string) => {
    const asignadoId = id || null;
    mutateDay({ items: dayRecords.map((r) => (r.id === rec.id ? { ...r, asignadoId } : r)), nextCursor: null }, false);
    try {
      await updateRecord(rec.id, {
        asignadoId,
        ayudanteId: null,
        fecha: rec.fecha,
        sala: rec.sala,
        asignacion: rec.asignacion,
        sectionId: rec.sectionId,
        minutos: rec.minutos,
        cantico: null,
      });
      refresh();
      toast(asignadoId ? "💾 Asignación guardada" : "💾 Asignación quitada", "success");
    } catch (e) {
      mutateDay();
      toast("❌ " + (e as Error).message, "error");
    }
  };

  // Fechas para elegir: próximos ~3 meses según la regla (días de reunión),
  // más cualquier reunión especial ya guardada dentro de ese rango.
  const planDates = useMemo(() => {
    const today = todayYMD();
    const end = addDaysYMD(today, 91);
    const set = new Set(nextWeekdayDates(config.weekdays, 13)); // 13 semanas ≈ 3 meses
    for (const m of meetings) if (m.fecha >= today && m.fecha <= end) set.add(m.fecha);
    return [...set].sort();
  }, [config.weekdays, meetings]);
  const dow = fecha ? weekdayLabel(weekdayOf(fecha)) : "";
  const activeRec = activeId ? dayRecords.find((r) => r.id === activeId) ?? null : null;

  return (
    <div className="page-inner page-inner-wide fade-up">
      <PageHeader title="Planificar" subtitle="Arma la reunión por fecha" />

      {/* Selector de fecha */}
      <div className="content-card">
        <div className="section-label">Reunión</div>
        <div className="plan-dates">
          {planDates.map((d) => (
            <button key={d} className={`reg-pill${fecha === d ? " active" : ""}`} onClick={() => setFecha(d)}>
              {fmtShort(d)}
            </button>
          ))}
        </div>
        <div className="plan-date-custom">
          <MeetingDatePicker value={fecha} onChange={setFecha} meetingWeekdays={config.weekdays} />
          <span className="plan-date-meta">
            {dow} · {fecha ? relativeLabel(fecha) : ""}
          </span>
        </div>
      </div>

      {/* Configuraciones y fechas (solo administrador) */}
      {isAdmin && (
        <div className="content-card cfg-panel">
          <button
            className={`cfg-toggle${showConfig ? " open" : ""}`}
            onClick={() => setShowConfig((s) => !s)}
            aria-expanded={showConfig}
          >
            <span className="cfg-toggle-main">
              <GearSix size={17} weight="bold" />
              <span>
                <span className="cfg-toggle-title">Configuraciones y fechas</span>
                <span className="cfg-toggle-sub">Secciones, regla automática y fechas de reunión</span>
              </span>
            </span>
            <CaretRight className="cfg-toggle-caret" size={16} weight="bold" />
          </button>
          {showConfig && (
            <div className="cfg-body fade-up">
              <ConfigFechas />
            </div>
          )}
        </div>
      )}

      <div className="plan-grid">
        {/* Panorama de la reunión */}
        <div className="plan-main">
          <div className="content-card">
            <div className="plan-head">
              <div className="section-label" style={{ margin: 0 }}>
                Panorama · {dayRecords.length} parte{dayRecords.length !== 1 ? "s" : ""}
                {conflictCount > 0 && <span className="plan-conflict-pill">⚠ {conflictCount} en conflicto</span>}
              </div>
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

                // Sección "Inicio": partes fijas sin persona y sin título.
                if (g.sinPersona) {
                  if (g.items.length === 0) return null;
                  const ordInicio = [...g.items].sort((a, b) => inicioRank(a.asignacion) - inicioRank(b.asignacion) || a.orden - b.orden);
                  const roles = ordInicio.filter((r) => !esParteSinPersona(r.asignacion)); // Presidente, Consejero, Oración
                  const fijas = ordInicio.filter((r) => esParteSinPersona(r.asignacion)); // Canción, Palabras
                  return (
                    <div className="plan-section plan-inicio" key={g.id}>
                      {roles.length > 0 && (
                        <div className="plan-tg main">
                          {roles.map((r) => (
                            <InicioPersonaRow key={r.id} rec={r} fecha={fecha} nombrados={nombrados} onPersona={(id) => savePersona(r, id)} />
                          ))}
                        </div>
                      )}
                      {fijas.length > 0 && (
                        <div className="plan-tg alt">
                          {fijas.map((r) => (
                            <StartRow key={r.id} rec={r} onCantico={(n) => saveCantico(r, n)} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                const esTesoros = norm(g.nombre) === norm(SECCION_TESOROS);
                const faltaLectura = esTesoros && g.items.length > 0 && !g.items.some((r) => esLectura(r.asignacion));

                // Tesoros: orden fijo (discurso → perlas → lectura). Las partes
                // generales van full-width; la Lectura se divide por sala A/B.
                if (esTesoros) {
                  const ordenadas = [...g.items].sort((a, b) => tesorosRank(a.asignacion) - tesorosRank(b.asignacion) || a.orden - b.orden);
                  const generales = ordenadas.filter((r) => !esLectura(r.asignacion));
                  const lecturas = ordenadas.filter((r) => esLectura(r.asignacion));
                  return (
                    <div className="plan-section" key={g.id}>
                      <div className="plan-section-head">
                        <span className="plan-section-title">{g.nombre}</span>
                        {!bloqueada && (
                          <button className="btn btn-ghost btn-sm plan-add-sec" onClick={() => openAdd({ sectionId: g.id, sala: "Sala A" })}>
                            + parte
                          </button>
                        )}
                      </div>
                      {faltaLectura && <div className="plan-warn-note">⚠ Falta la Lectura de la Biblia</div>}
                      {g.items.length === 0 ? (
                        <div className="plan-empty">— sin partes —</div>
                      ) : (
                        <div className="plan-tesoros">
                          {generales.length > 0 && (
                            <div className="plan-tg main">
                              {generales.map((r) => (
                                <TesorosRow key={r.id} rec={r} personsById={personsById} dupIds={dupIds} onEdit={() => setEditing(r)} onDelete={() => onDelete(r)} />
                              ))}
                            </div>
                          )}
                          {lecturas.length > 0 && (
                            <div className="plan-tesoros-salas">
                              {groupBySala(lecturas).map((sg) => (
                                <div className={`plan-tg ${salaClass(sg.sala)}`} key={sg.sala}>
                                  <span className={`plan-sala-tag ${salaClass(sg.sala)}`}>{sg.sala}</span>
                                  {sg.items.map((r) => (
                                    <TesorosRow key={r.id} rec={r} personsById={personsById} dupIds={dupIds} onEdit={() => setEditing(r)} onDelete={() => onDelete(r)} />
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                // Nuestra vida cristiana: marco fijo (Canción al inicio, Oración +
                // Canción al final) con las partes del usuario en medio, en orden.
                if (norm(g.nombre) === norm(SECCION_VIDA)) {
                  const ordVida = [...g.items].sort((a, b) => vidaRank(a) - vidaRank(b));
                  const canciones = ordVida.filter((r) => esCancion(r.asignacion));
                  const medio = ordVida.filter(esMedioVida); // discursos reordenables
                  const estudioRec = ordVida.find((r) => esEstudio(r.asignacion));
                  const palabrasRec = ordVida.find((r) => norm(r.asignacion) === norm(PARTE_PALABRAS_CONCLUSION));
                  const oracionRec = ordVida.find((r) => esRolNombrado(r.asignacion));
                  return (
                    <div className="plan-section" key={g.id}>
                      <div className="plan-section-head">
                        <span className="plan-section-title">
                          {g.nombre}
                          {g.soloAdmin && <span className="plan-lock-tag" title="Solo el administrador">🔒</span>}
                        </span>
                        {!bloqueada && (
                          <button className="btn btn-ghost btn-sm plan-add-sec" onClick={() => openAdd({ sectionId: g.id })}>
                            + parte
                          </button>
                        )}
                      </div>
                      {g.items.length === 0 ? (
                        <div className="plan-empty">— sin partes —</div>
                      ) : (
                        <div className="plan-tg main">
                          {canciones[0] && <StartRow key={canciones[0].id} rec={canciones[0]} onCantico={(n) => saveCantico(canciones[0], n)} />}
                          {medio.length > 0 && (
                            <div className="plan-vida-medio">
                              <SortableContext items={medio.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                                {medio.map((r) => (
                                  <PartRow key={r.id} rec={r} personsById={personsById} dupIds={dupIds} onEdit={() => setEditing(r)} onDelete={() => onDelete(r)} />
                                ))}
                              </SortableContext>
                            </div>
                          )}
                          {estudioRec && (
                            <EstudioRow key={estudioRec.id} rec={estudioRec} personsById={personsById} onEdit={() => setEditing(estudioRec)} onDelete={() => onDelete(estudioRec)} />
                          )}
                          {palabrasRec && (
                            <TesorosRow key={palabrasRec.id} rec={palabrasRec} personsById={personsById} dupIds={dupIds} onEdit={() => setEditing(palabrasRec)} onDelete={() => onDelete(palabrasRec)} />
                          )}
                          {oracionRec && (
                            <InicioPersonaRow key={oracionRec.id} rec={oracionRec} fecha={fecha} nombrados={nombrados} onPersona={(id) => savePersona(oracionRec, id)} />
                          )}
                          {canciones[1] && <StartRow key={canciones[1].id} rec={canciones[1]} onCantico={(n) => saveCantico(canciones[1], n)} />}
                        </div>
                      )}
                    </div>
                  );
                }

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
                  {faltaLectura && <div className="plan-warn-note">⚠ Falta la Lectura de la Biblia</div>}
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
  const aP = rec.asignadoId ? personsById.get(rec.asignadoId) : undefined;
  const hP = rec.ayudanteId ? personsById.get(rec.ayudanteId) : undefined;
  const conflict = (!!rec.asignadoId && dupIds.has(rec.asignadoId)) || (!!rec.ayudanteId && dupIds.has(rec.ayudanteId));
  return (
    <div className="plan-part-main">
      <div className="plan-part-asig">
        {rec.asignacion}
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
  const conflict = (!!rec.asignadoId && dupIds.has(rec.asignadoId)) || (!!rec.ayudanteId && dupIds.has(rec.ayudanteId));
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

// Fila de parte de Tesoros (orden fijo, sin arrastrar): tarjeta autónoma con
// espaciado por gap (sin los márgenes negativos de .plan-part).
function TesorosRow({
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
  const conflict = (!!rec.asignadoId && dupIds.has(rec.asignadoId)) || (!!rec.ayudanteId && dupIds.has(rec.ayudanteId));
  return (
    <div className={`plan-tesoros-row${conflict ? " conflict" : ""}`}>
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

// Estudio bíblico de congregación: muestra claramente Conductor y Lector,
// cada uno en su línea con su barra.
function EstudioRow({
  rec,
  personsById,
  onEdit,
  onDelete,
}: {
  rec: RecordItem;
  personsById: Map<string, Person>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isAdmin = useIsAdmin();
  const locked = rec.bloqueado && !isAdmin;
  const cond = rec.asignadoId ? personsById.get(rec.asignadoId) : undefined;
  const lect = rec.ayudanteId ? personsById.get(rec.ayudanteId) : undefined;
  return (
    <div className="plan-estudio">
      <div className="plan-estudio-head">
        <span className="plan-part-asig">
          {rec.asignacion}
          {rec.minutos != null && <span className="plan-part-sala">{rec.minutos} min</span>}
        </span>
        {!locked && (
          <div className="plan-part-actions">
            <button className="tl-act" onClick={onEdit} title="Editar" aria-label="Editar">✎</button>
            <button className="tl-act danger" onClick={onDelete} title="Quitar" aria-label="Quitar">✕</button>
          </div>
        )}
      </div>
      <div className="plan-estudio-sub cond">
        <span className="plan-estudio-lbl">Conductor</span>
        {cond && <GenderIcon genero={cond.genero} />}
        <span className="plan-part-name">{rec.asignado}</span>
      </div>
      <div className="plan-estudio-sub lect">
        <span className="plan-estudio-lbl">Lector</span>
        {lect && <GenderIcon genero={lect.genero} />}
        <span className="plan-part-name">{rec.ayudante ?? "— sin lector —"}</span>
      </div>
    </div>
  );
}

// Parte fija de "Inicio" sin persona: Canción (con número de cántico) o
// Palabras de introducción (duración fija). No se arrastra ni se borra.
function StartRow({ rec, onCantico }: { rec: RecordItem; onCantico: (n: number | null) => void }) {
  const cancion = esCancion(rec.asignacion);
  const [val, setVal] = useState(rec.cantico != null ? String(rec.cantico) : "");
  useEffect(() => {
    setVal(rec.cantico != null ? String(rec.cantico) : "");
  }, [rec.cantico]);

  const commit = () => {
    const raw = val.trim();
    const n = raw === "" ? null : Math.max(1, Math.min(999, parseInt(raw, 10) || 0)) || null;
    if ((n ?? null) !== (rec.cantico ?? null)) onCantico(n);
  };

  return (
    <div className="plan-inicio-row">
      <span className="plan-inicio-asig">{rec.asignacion}</span>
      {cancion ? (
        <span className="plan-inicio-cant">
          <span className="plan-inicio-cant-lbl">Cántico</span>
          <input
            type="number"
            min={1}
            max={999}
            inputMode="numeric"
            className="plan-inicio-input"
            placeholder="#"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </span>
      ) : (
        rec.minutos != null && <span className="plan-inicio-min">{rec.minutos} min</span>
      )}
    </div>
  );
}

// Parte fija de "Inicio" con un Nombrado (Presidente, Consejero de la sala
// auxiliar, Oración): selector en línea filtrado a Nombrados, con recencia
// POR ROL ("última vez como Presidente") y chips de "le toca" si está vacío.
function InicioPersonaRow({ rec, fecha, nombrados, onPersona }: { rec: RecordItem; fecha: string; nombrados: Person[]; onPersona: (id: string) => void }) {
  const { roster } = useRoster(fecha || null, undefined, undefined, undefined, rec.asignacion);
  // meta para el selector: la recencia por rol se mapea al slot de "sección".
  const meta = useMemo(
    () =>
      new Map(
        roster.map((r) => [
          r.id,
          { daysSince: r.daysSince, countMonth: r.countMonth, assignedOnTarget: r.assignedOnTarget, daysSinceSection: r.daysSinceAsignacion },
        ]),
      ),
    [roster],
  );
  // Sugeridos "le toca ESTE rol": Nombrados no tomados ese día, por recencia del rol.
  const sugs = useMemo(() => {
    const nomIds = new Set(nombrados.map((p) => p.id));
    return roster
      .filter((r) => nomIds.has(r.id) && !r.assignedOnTarget)
      .sort((a, b) => {
        const da = a.daysSinceAsignacion ?? null;
        const db = b.daysSinceAsignacion ?? null;
        const na = da === null, nb = db === null;
        if (na !== nb) return na ? -1 : 1; // nunca hizo el rol → primero
        if (!na && !nb && da !== db) return db! - da!; // más tiempo sin el rol → primero
        return a.countMonth - b.countMonth || a.nombre.localeCompare(b.nombre);
      })
      .slice(0, 4);
  }, [roster, nombrados]);

  return (
    <div className="plan-inicio-row role">
      <span className="plan-inicio-asig">{rec.asignacion}</span>
      <div className="plan-inicio-sel">
        <PersonSelect persons={nombrados} value={rec.asignadoId ?? ""} onChange={onPersona} placeholder="Asignar nombrado…" meta={meta} sectionLabel={rec.asignacion} />
      </div>
      {!rec.asignadoId && sugs.length > 0 && (
        <div className="sug-row plan-inicio-sugs">
          <span className="sug-tip">Le toca:</span>
          {sugs.map((s) => (
            <button key={s.id} type="button" className="sug-chip" onClick={() => onPersona(s.id)} title={`Como ${rec.asignacion}: ${s.countAsignacion ?? 0} ${(s.countAsignacion ?? 0) === 1 ? "vez" : "veces"}`}>
              {s.nombre.split(" ")[0]} <span className="sug-ago">{agoShort(s.daysSinceAsignacion ?? null)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
