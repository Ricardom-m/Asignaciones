"use client";

import { useMemo, useState } from "react";
import { useMeetings } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/PageHeader";
import {
  createMeetings,
  updateMeeting,
  deleteMeeting,
  nextWeekdayDates,
  weekdayOf,
  weekdayLabel,
  fmtShort,
  todayYMD,
} from "@/lib/client";

const WEEKDAYS = [
  { n: 1, label: "Lun" },
  { n: 2, label: "Mar" },
  { n: 3, label: "Mié" },
  { n: 4, label: "Jue" },
  { n: 5, label: "Vie" },
  { n: 6, label: "Sáb" },
  { n: 0, label: "Dom" },
];

export default function ReunionesPage() {
  const { meetings, mutate } = useMeetings();
  const toast = useToast();
  const [days, setDays] = useState<Set<number>>(new Set([4, 6])); // Jue + Sáb
  const [weeks, setWeeks] = useState(4);
  const [newDate, setNewDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPast, setShowPast] = useState(false);

  const today = todayYMD();
  const upcoming = useMemo(() => meetings.filter((m) => m.fecha >= today), [meetings, today]);
  const past = useMemo(
    () => meetings.filter((m) => m.fecha < today).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [meetings, today],
  );

  const toggleDay = (n: number) =>
    setDays((s) => {
      const next = new Set(s);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });

  const generate = async () => {
    if (days.size === 0) return toast("⚠️ Elige al menos un día", "error");
    const fechas = nextWeekdayDates([...days], weeks);
    if (fechas.length === 0) return toast("Sin fechas para generar", "error");
    setBusy(true);
    try {
      await createMeetings(fechas);
      await mutate();
      toast(`📅 Generadas ${fechas.length} fechas`, "success");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const addOne = async () => {
    if (!newDate) return toast("⚠️ Elige una fecha", "error");
    setBusy(true);
    try {
      await createMeetings([newDate]);
      await mutate();
      setNewDate("");
      toast("✅ Reunión agregada", "success");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const editDate = async (id: string, fecha: string) => {
    if (!fecha) return;
    try {
      await updateMeeting(id, { fecha });
      await mutate();
      toast("✏️ Fecha actualizada", "success");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteMeeting(id);
      await mutate();
      toast("🗑️ Reunión eliminada");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    }
  };

  return (
    <div className="page-inner fade-up">
      <PageHeader
        title="Reuniones"
        subtitle={`${upcoming.length} próxima${upcoming.length !== 1 ? "s" : ""}`}
      />

      {/* Generador */}
      <div className="content-card">
        <div className="section-label">Generar próximas reuniones</div>
        <div className="form-grid">
          <div className="field-group">
            <label className="field-label">Días de reunión</label>
            <div className="role-chips">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.n}
                  type="button"
                  className="role-chip"
                  onClick={() => toggleDay(d.n)}
                  style={days.has(d.n) ? { color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-dim)" } : undefined}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="row-2">
            <div className="field-group">
              <label className="field-label">Semanas a generar</label>
              <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
                {[1, 2, 4, 6, 8, 12].map((w) => (
                  <option key={w} value={w}>{w} semana{w !== 1 ? "s" : ""}</option>
                ))}
              </select>
            </div>
            <div className="field-group" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-primary" onClick={generate} disabled={busy}>
                {busy ? "Generando…" : "Generar próximas"}
              </button>
            </div>
          </div>
        </div>

        <div className="divider" />
        <div className="section-label">Agregar una fecha</div>
        <div className="row-2">
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <button className="btn btn-ghost" onClick={addOne} disabled={busy}>
            Agregar fecha
          </button>
        </div>
      </div>

      {/* Próximas */}
      <div className="content-card">
        <div className="section-label">Próximas reuniones</div>
        {upcoming.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <h3>Sin reuniones próximas</h3>
            <p>Usa "Generar próximas" para crear los jueves y sábados.</p>
          </div>
        ) : (
          <div className="persons-list">
            {upcoming.map((m) => (
              <div className="meeting-row" key={m.id}>
                <span className="meeting-day">{weekdayLabel(weekdayOf(m.fecha))}</span>
                <input
                  type="date"
                  className="meeting-date"
                  value={m.fecha}
                  onChange={(e) => editDate(m.id, e.target.value)}
                />
                <button className="btn btn-danger btn-sm" onClick={() => remove(m.id)}>
                  Borrar
                </button>
              </div>
            ))}
          </div>
        )}

        {past.length > 0 && (
          <>
            <div className="divider" />
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPast((s) => !s)}>
              {showPast ? "Ocultar" : "Ver"} anteriores ({past.length})
            </button>
            {showPast && (
              <div className="persons-list" style={{ marginTop: 10, opacity: 0.6 }}>
                {past.map((m) => (
                  <div className="meeting-row" key={m.id}>
                    <span className="meeting-day">{fmtShort(m.fecha)}</span>
                    <button className="btn btn-danger btn-sm" style={{ marginLeft: "auto" }} onClick={() => remove(m.id)}>
                      Borrar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
