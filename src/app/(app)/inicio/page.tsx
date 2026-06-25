"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePersons, useRoles, useRecordsStats, useRecordsPage } from "@/lib/hooks";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, BarRow } from "@/components/Stat";
import { Reveal } from "@/components/Reveal";
import { fmtDate } from "@/lib/client";

export default function InicioPage() {
  const { persons } = usePersons();
  const { roles } = useRoles();
  const { stats } = useRecordsStats();
  const { items: proximas } = useRecordsPage("scope=prox&take=5");
  const { items: recientes } = useRecordsPage("sort=createdAt&take=5");

  const activas = persons.filter((p) => p.active).length;
  const porRol = useMemo(() => {
    const list = roles
      .map((rol) => ({ rol, count: persons.filter((p) => p.roles.some((r) => r.id === rol.id)).length }))
      .sort((a, b) => b.count - a.count);
    const max = Math.max(1, ...list.map((x) => x.count));
    return { list, max };
  }, [roles, persons]);

  const hoyLabel = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="page-inner fade-up">
      <PageHeader title="Inicio" subtitle={hoyLabel.charAt(0).toUpperCase() + hoyLabel.slice(1)} />

      <div className="stat-grid">
        <StatCard value={activas} label="Personas activas" hint={`${persons.length} en total`} />
        <StatCard value={stats.total} label="Registros totales" />
        <StatCard value={stats.esteMes} label="Registros este mes" gradient />
        <StatCard value={roles.length} label="Roles" />
      </div>

      {porRol.list.length > 0 && (
        <Reveal className="dash-section">
          <div className="dash-section-title">Personas por rol</div>
          <div className="bar-list">
            {porRol.list.map(({ rol, count }) => (
              <BarRow key={rol.id} label={rol.nombre} value={count} max={porRol.max} color={rol.color} />
            ))}
          </div>
        </Reveal>
      )}

      <Reveal className="dash-section">
        <div className="dash-section-title">Próximas asignaciones</div>
        {proximas.length === 0 ? (
          <div className="spotlight-empty">No hay asignaciones futuras.</div>
        ) : (
          proximas.map((r) => (
            <div className="mini-row" key={r.id}>
              <div className="mini-row-main">
                <div className="mini-row-title">{r.asignado}</div>
                <div className="mini-row-sub">
                  {r.sala ? r.sala + " · " : ""}
                  {r.asignacion}
                </div>
              </div>
              <div className="mini-row-date">{fmtDate(r.fecha)}</div>
            </div>
          ))
        )}
      </Reveal>

      <Reveal className="dash-section">
        <div className="dash-section-title">Actividad reciente</div>
        {recientes.length === 0 ? (
          <div className="spotlight-empty">
            Aún no hay registros. <Link href="/planificar" style={{ color: "var(--accent)" }}>Planifica la reunión →</Link>
          </div>
        ) : (
          recientes.map((r) => (
            <div className="mini-row" key={r.id}>
              <div className="mini-row-main">
                <div className="mini-row-title">{r.asignacion}</div>
                <div className="mini-row-sub">
                  {r.asignado}
                  {r.ayudante ? " · " + r.ayudante : ""}
                </div>
              </div>
              <div className="mini-row-date">{fmtDate(r.fecha)}</div>
            </div>
          ))
        )}
      </Reveal>
    </div>
  );
}
