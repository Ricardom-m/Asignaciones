"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePersons, useRecords, useRoles } from "@/lib/hooks";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, BarRow } from "@/components/Stat";
import { fmtDate, todayYMD } from "@/lib/client";

export default function InicioPage() {
  const { persons } = usePersons();
  const { records } = useRecords(); // createdAt desc por defecto
  const { roles } = useRoles();

  const stats = useMemo(() => {
    const ym = new Date().toISOString().slice(0, 7); // YYYY-MM
    const hoy = todayYMD();

    const activas = persons.filter((p) => p.active).length;
    const esteMes = records.filter((r) => (r.fecha || "").startsWith(ym)).length;

    const porRol = roles
      .map((rol) => ({
        rol,
        count: persons.filter((p) => p.roles.some((r) => r.id === rol.id)).length,
      }))
      .sort((a, b) => b.count - a.count);
    const maxRol = Math.max(1, ...porRol.map((x) => x.count));

    const proximas = records
      .filter((r) => (r.fecha || "") >= hoy)
      .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""))
      .slice(0, 5);

    const recientes = records.slice(0, 5); // ya viene ordenado por createdAt desc

    return { activas, total: persons.length, esteMes, porRol, maxRol, proximas, recientes };
  }, [persons, records, roles]);

  const hoyLabel = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="page-inner fade-up">
      <PageHeader title="Inicio" subtitle={hoyLabel.charAt(0).toUpperCase() + hoyLabel.slice(1)} />

      {/* Tarjetas */}
      <div className="stat-grid">
        <StatCard value={stats.activas} label="Personas activas" hint={`${stats.total} en total`} />
        <StatCard value={records.length} label="Registros totales" />
        <StatCard value={stats.esteMes} label="Registros este mes" accent="var(--accent)" />
        <StatCard value={roles.length} label="Roles" />
      </div>

      {/* Personas por rol */}
      {stats.porRol.length > 0 && (
        <div className="dash-section">
          <div className="dash-section-title">Personas por rol</div>
          <div className="bar-list">
            {stats.porRol.map(({ rol, count }) => (
              <BarRow key={rol.id} label={rol.nombre} value={count} max={stats.maxRol} color={rol.color} />
            ))}
          </div>
        </div>
      )}

      {/* Próximas asignaciones */}
      <div className="dash-section">
        <div className="dash-section-title">Próximas asignaciones</div>
        {stats.proximas.length === 0 ? (
          <div className="spotlight-empty">No hay asignaciones futuras.</div>
        ) : (
          stats.proximas.map((r) => (
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
      </div>

      {/* Actividad reciente */}
      <div className="dash-section">
        <div className="dash-section-title">Actividad reciente</div>
        {stats.recientes.length === 0 ? (
          <div className="spotlight-empty">
            Aún no hay registros. <Link href="/nuevo" style={{ color: "var(--accent)" }}>Crea el primero →</Link>
          </div>
        ) : (
          stats.recientes.map((r) => (
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
      </div>
    </div>
  );
}
