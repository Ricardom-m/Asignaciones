"use client";

import { useState } from "react";
import { useMeetings, usePastMeetings, useMeetingConfig } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/Confirm";
import { PageHeader } from "@/components/PageHeader";
import {
  createMeetings,
  updateMeeting,
  deleteMeeting,
  updateMeetingConfig,
  purgeMeetings,
  nextWeekdayDates,
  weekdayOf,
  weekdayLabel,
  fmtShort,
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
const WEEKS_OPTS = [1, 2, 4, 6, 8, 12];

export default function ReunionesPage() {
  const { meetings, mutate } = useMeetings(); // solo próximas
  const { config, mutate: mutateConfig } = useMeetingConfig();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [showPast, setShowPast] = useState(false);
  const { past, mutate: mutatePast } = usePastMeetings(showPast);

  const ruleDays = config.weekdays.length
    ? [...config.weekdays].sort().map(weekdayLabel).join(", ")
    : "ningún día";

  const saveConfig = (weekdays: number[], weeks: number) =>
    mutateConfig(updateMeetingConfig({ weekdays, weeks }), { optimisticData: { weekdays, weeks }, revalidate: false });

  const toggleDay = async (n: number) => {
    const has = config.weekdays.includes(n);
    const weekdays = has ? config.weekdays.filter((d) => d !== n) : [...config.weekdays, n].sort();
    if (has) {
      const futureIds = meetings.filter((m) => weekdayOf(m.fecha) === n).map((m) => m.id);
      if (futureIds.length) {
        const ok = await confirm({
          title: `Quitar ${weekdayLabel(n)}`,
          message: `Hay ${futureIds.length} reunión(es) futura(s) de los ${weekdayLabel(n)}. ¿Borrarlas también?`,
          confirmText: "Borrar futuras",
          cancelText: "Solo quitar de la regla",
          danger: true,
        });
        if (ok) {
          await purgeMeetings({ ids: futureIds });
          await mutate();
          toast(`🗑️ ${futureIds.length} eliminadas`);
        }
      }
    }
    await saveConfig(weekdays, config.weeks);
  };

  const generate = async () => {
    if (config.weekdays.length === 0) return toast("⚠️ Elige al menos un día en la regla", "error");
    const fechas = nextWeekdayDates(config.weekdays, config.weeks);
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

  const remove = async (id: string, fromPast = false) => {
    const ok = await confirm({ title: "Eliminar reunión", message: "¿Eliminar esta fecha de reunión?", confirmText: "Eliminar", danger: true });
    if (!ok) return;
    try {
      await deleteMeeting(id);
      await (fromPast ? mutatePast() : mutate());
      toast("🗑️ Reunión eliminada");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    }
  };

  const purgePast = async () => {
    const ok = await confirm({
      title: "Borrar reuniones pasadas",
      message: "¿Borrar TODAS las reuniones cuya fecha ya pasó? No afecta a las próximas.",
      confirmText: "Borrar pasadas",
      danger: true,
    });
    if (!ok) return;
    try {
      const { deleted } = await purgeMeetings({ past: true });
      await mutatePast();
      toast(`🗑️ ${deleted} pasadas eliminadas`);
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    }
  };

  return (
    <div className="page-inner fade-up">
      <PageHeader title="Reuniones" subtitle={`${meetings.length} próxima${meetings.length !== 1 ? "s" : ""}`} />

      {/* Regla + generador */}
      <div className="content-card">
        <div className="section-label">Regla para generar</div>
        <div className="field-hint" style={{ marginTop: 0, marginBottom: 12 }}>
          Hoy la regla es: <strong style={{ color: "var(--text)" }}>{ruleDays}</strong>, próximas{" "}
          <strong style={{ color: "var(--text)" }}>{config.weeks}</strong> semana{config.weeks !== 1 ? "s" : ""}. Se guarda
          automáticamente.
        </div>
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
                  style={config.weekdays.includes(d.n) ? { color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-dim)" } : undefined}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="row-2">
            <div className="field-group">
              <label className="field-label">Semanas a generar</label>
              <select value={config.weeks} onChange={(e) => saveConfig(config.weekdays, Number(e.target.value))}>
                {WEEKS_OPTS.map((w) => (
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
        <div className="field-hint" style={{ marginTop: 0, marginBottom: 8 }}>Para reuniones especiales fuera de la regla.</div>
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
        {meetings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <h3>Sin reuniones próximas</h3>
            <p>Usa "Generar próximas" para crear las fechas según la regla.</p>
          </div>
        ) : (
          <div className="persons-list">
            {meetings.map((m) => (
              <div className="meeting-row" key={m.id}>
                <span className="meeting-day">{weekdayLabel(weekdayOf(m.fecha))}</span>
                <input type="date" className="meeting-date" value={m.fecha} onChange={(e) => editDate(m.id, e.target.value)} />
                <button className="btn btn-danger btn-sm" onClick={() => remove(m.id)}>
                  Borrar
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="divider" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowPast((s) => !s)}>
            {showPast ? "Ocultar anteriores" : "Ver anteriores"}
          </button>
          {showPast && past.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={purgePast}>
              Borrar pasadas
            </button>
          )}
        </div>
        {showPast && (
          <div className="persons-list" style={{ marginTop: 10, opacity: 0.7 }}>
            {past.length === 0 ? (
              <div className="spotlight-empty">Sin reuniones pasadas.</div>
            ) : (
              past.map((m) => (
                <div className="meeting-row" key={m.id}>
                  <span className="meeting-day">{fmtShort(m.fecha)}</span>
                  <button className="btn btn-danger btn-sm" style={{ marginLeft: "auto" }} onClick={() => remove(m.id, true)}>
                    Borrar
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
