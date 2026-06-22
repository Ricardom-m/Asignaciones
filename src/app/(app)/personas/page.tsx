"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePersons, useRoles } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { createPerson, updatePerson, deletePerson } from "@/lib/client";
import { RoleBadge, RoleMultiSelect } from "@/components/RoleBadge";
import { RolesManager } from "@/components/RolesManager";
import { PageHeader } from "@/components/PageHeader";
import { Reveal } from "@/components/Reveal";
import { Modal } from "@/components/Modal";
import { useConfirm } from "@/components/Confirm";
import type { Person } from "@/lib/types";

const PAGE = 30;

export default function PersonasPage() {
  const { persons, mutate } = usePersons();
  const { roles } = useRoles();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();

  // Abrir el detalle "Por persona" de alguien (en Registros).
  const openDetail = (id: string) => {
    sessionStorage.setItem("asgn_spotlight", id);
    router.push("/registros");
  };

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [manageRoles, setManageRoles] = useState(false);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return persons
      .slice()
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .filter((p) => (showInactive ? true : p.active))
      .filter((p) => (roleFilter ? p.roles.some((r) => r.id === roleFilter) : true))
      .filter((p) => (q ? `${p.nombre} ${p.apellido}`.toLowerCase().includes(q) : true));
  }, [persons, query, roleFilter, showInactive]);

  const visible = filtered.slice(0, limit);
  const roleCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of persons) for (const r of p.roles) m[r.id] = (m[r.id] ?? 0) + 1;
    return m;
  }, [persons]);
  const activeCount = persons.filter((p) => p.active).length;

  // Activar/desactivar al instante (optimista) desde la tarjeta.
  const toggleActive = async (p: Person) => {
    const next = !p.active;
    mutate(persons.map((x) => (x.id === p.id ? { ...x, active: next } : x)), false);
    try {
      await updatePerson(p.id, { nombre: p.nombre, apellido: p.apellido, active: next });
      await mutate();
      toast(next ? "✅ Persona activada" : "🚫 Persona desactivada");
    } catch (e) {
      await mutate();
      toast("❌ " + (e as Error).message, "error");
    }
  };

  const remove = async (p: Person) => {
    const ok = await confirm({
      title: "Eliminar persona",
      message: `¿Eliminar a ${p.nombre} ${p.apellido}? Si solo quieres ocultarla, mejor desactívala.`,
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      await deletePerson(p.id);
      await mutate();
      toast("🗑️ Persona eliminada");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    }
  };

  return (
    <div className="page-inner fade-up">
      <PageHeader
        title="Personas"
        subtitle={`${activeCount} activas · ${persons.length} en total`}
        right={
          <>
            <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
              + Nueva
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setManageRoles(true)}>
              🏷️ Roles
            </button>
          </>
        }
      />

      {/* Filtros por rol */}
      <div className="role-filter-bar">
        <button
          className="role-chip"
          onClick={() => setRoleFilter("")}
          style={!roleFilter ? { color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-dim)" } : undefined}
        >
          Todos
        </button>
        {roles.map((r) => (
          <button
            key={r.id}
            className="role-chip"
            onClick={() => setRoleFilter(roleFilter === r.id ? "" : r.id)}
            style={roleFilter === r.id ? { color: r.color, borderColor: r.color, background: r.color + "22" } : undefined}
          >
            {r.nombre} <span style={{ opacity: 0.6, fontFamily: "var(--mono)" }}>{roleCounts[r.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="persons-search-wrap">
        <span className="persons-search-ico">⌕</span>
        <input
          className="persons-search-input"
          type="text"
          placeholder="Buscar persona…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
          autoComplete="off"
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className="persons-count" style={{ margin: 0 }}>
          {filtered.length} persona{filtered.length !== 1 ? "s" : ""}
        </div>
        <label className="switch">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          <span className="track" />
          Mostrar inactivos
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👤</div>
          <h3>Sin coincidencias</h3>
          <p>Ajusta el filtro o agrega personas.</p>
        </div>
      ) : (
        <div className="persons-list">
          {visible.map((p, i) => (
            <Reveal key={p.id} delay={Math.min(i, 8) * 45}>
            <div className={`person-row${p.active ? "" : " inactive"}`}>
              <div className="person-main">
                <span className="person-name">
                  <button className="person-link" onClick={() => openDetail(p.id)}>
                    {p.nombre} {p.apellido}
                  </button>
                  {!p.active && <span className="person-badge-inactive">inactivo</span>}
                </span>
                {p.roles.length > 0 && (
                  <div className="person-roles">
                    {p.roles.map((r) => (
                      <RoleBadge key={r.id} role={r} />
                    ))}
                  </div>
                )}
              </div>
              <div className="person-actions">
                <button
                  className={`btn btn-sm btn-toggle ${p.active ? "is-on" : "is-off"}`}
                  onClick={() => toggleActive(p)}
                  title={p.active ? "Desactivar" : "Activar"}
                  aria-label={p.active ? "Desactivar persona" : "Activar persona"}
                  aria-pressed={p.active}
                >
                  <PowerIcon />
                </button>
                <button className="btn btn-edit btn-sm" onClick={() => setEditing(p)}>
                  Editar
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>
                  Borrar
                </button>
              </div>
            </div>
            </Reveal>
          ))}
        </div>
      )}

      {limit < filtered.length && (
        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <button className="btn btn-ghost" style={{ width: "auto", padding: "8px 24px", fontSize: ".78rem" }} onClick={() => setLimit((l) => l + PAGE)}>
            Cargar más ↓
          </button>
        </div>
      )}

      {adding && <PersonModal roles={roles} onClose={() => setAdding(false)} onSaved={() => { mutate(); setAdding(false); }} />}
      {editing && (
        <PersonModal
          person={editing}
          roles={roles}
          onClose={() => setEditing(null)}
          onSaved={() => { mutate(); setEditing(null); }}
        />
      )}
      {manageRoles && <RolesManager onClose={() => setManageRoles(false)} />}
    </div>
  );
}

// Modal de alta/edición de persona (mismo formulario para ambos).
function PersonModal({
  person,
  roles,
  onClose,
  onSaved,
}: {
  person?: Person;
  roles: { id: string; nombre: string; color: string; active: boolean }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = !!person;
  const [nombre, setNombre] = useState(person?.nombre ?? "");
  const [apellido, setApellido] = useState(person?.apellido ?? "");
  const [genero, setGenero] = useState<"H" | "M">(person?.genero ?? "H");
  const [roleIds, setRoleIds] = useState<string[]>(person?.roles.map((r) => r.id) ?? []);
  const [active, setActive] = useState(person?.active ?? true);
  const [saving, setSaving] = useState(false);

  // Revelado gradual al crear: género/roles/acciones aparecen al completar el nombre.
  const revealRest = isEdit || (!!nombre.trim() && !!apellido.trim());

  const save = async () => {
    if (!nombre.trim()) return toast("⚠️ El nombre es obligatorio", "error");
    if (!apellido.trim()) return toast("⚠️ El apellido es obligatorio", "error");
    setSaving(true);
    try {
      if (isEdit) {
        await updatePerson(person!.id, { nombre: nombre.trim(), apellido: apellido.trim(), genero, roleIds, active });
        toast("✏️ Persona actualizada", "success");
      } else {
        await createPerson({ nombre: nombre.trim(), apellido: apellido.trim(), genero, roleIds });
        toast("✅ Persona agregada", "success");
      }
      onSaved();
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Editar persona" : "Nueva persona"} onClose={onClose}>
      <div className="form-grid">
        <div className="row-2">
          <div className="field-group">
            <label className="field-label">
              Nombre <span className="req">*</span>
            </label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Juan" autoComplete="off" autoFocus />
          </div>
          <div className="field-group">
            <label className="field-label">
              Apellido <span className="req">*</span>
            </label>
            <input
              type="text"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              placeholder="Ej. Pérez"
              autoComplete="off"
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
          </div>
        </div>
        {revealRest && (
          <>
            <div className="field-group field-reveal">
              <label className="field-label">Género</label>
              <GeneroToggle value={genero} onChange={setGenero} />
            </div>
            <div className="field-group field-reveal">
              <label className="field-label">Roles</label>
              <RoleMultiSelect roles={roles} selected={roleIds} onChange={setRoleIds} />
            </div>
            {isEdit && (
              <div className="field-group field-reveal">
                <label className="switch" style={{ fontSize: ".8rem" }}>
                  <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                  <span className="track" />
                  {active ? "Activa (visible y asignable)" : "Inactiva (oculta, sin borrar)"}
                </label>
              </div>
            )}
            <div className="divider" />
            <div className="form-actions field-reveal">
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Agregar persona"}
              </button>
              <button className="btn btn-ghost" onClick={onClose}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function PowerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="3" x2="12" y2="12" />
      <path d="M6.5 7.5a8 8 0 1011 0" />
    </svg>
  );
}

function GeneroToggle({ value, onChange }: { value: "H" | "M"; onChange: (g: "H" | "M") => void }) {
  const opts: { v: "H" | "M"; label: string }[] = [
    { v: "H", label: "Hombre" },
    { v: "M", label: "Mujer" },
  ];
  return (
    <div className="role-chips">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          className="role-chip"
          onClick={() => onChange(o.v)}
          style={value === o.v ? { color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-dim)" } : undefined}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
