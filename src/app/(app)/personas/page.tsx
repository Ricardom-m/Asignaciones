"use client";

import { useMemo, useState } from "react";
import { usePersons, useRoles } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { createPerson, updatePerson, deletePerson } from "@/lib/client";
import { RoleBadge, RoleMultiSelect } from "@/components/RoleBadge";
import { RolesManager } from "@/components/RolesManager";
import type { Person } from "@/lib/types";

const PAGE = 30;

export default function PersonasPage() {
  const { persons, mutate } = usePersons();
  const { roles } = useRoles();
  const toast = useToast();

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [newRoles, setNewRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>(""); // "" = todos
  const [showInactive, setShowInactive] = useState(false);
  const [limit, setLimit] = useState(PAGE);

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

  const add = async () => {
    if (!nombre.trim()) return toast("⚠️ El nombre es obligatorio", "error");
    if (!apellido.trim()) return toast("⚠️ El apellido es obligatorio", "error");
    setSaving(true);
    try {
      await createPerson({ nombre: nombre.trim(), apellido: apellido.trim(), roleIds: newRoles });
      await mutate();
      setNombre("");
      setApellido("");
      setNewRoles([]);
      toast("✅ Persona agregada", "success");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Person) => {
    if (!confirm(`¿Eliminar a ${p.nombre} ${p.apellido}? (Si solo quieres ocultarla, mejor desactívala.)`))
      return;
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
      <div className="content-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="section-label" style={{ margin: 0 }}>
            Nueva persona
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setManageRoles(true)}>
            🏷️ Roles
          </button>
        </div>

        <div className="form-grid" style={{ marginTop: 10 }}>
          <div className="row-2">
            <div className="field-group">
              <label className="field-label">
                Nombre <span className="req">*</span>
              </label>
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Juan" autoComplete="off" />
            </div>
            <div className="field-group">
              <label className="field-label">
                Apellido <span className="req">*</span>
              </label>
              <input type="text" value={apellido} onChange={(e) => setApellido(e.target.value)} placeholder="Ej. Pérez" autoComplete="off" onKeyDown={(e) => e.key === "Enter" && add()} />
            </div>
          </div>
          <div className="field-group">
            <label className="field-label">Roles</label>
            <RoleMultiSelect roles={roles} selected={newRoles} onChange={setNewRoles} />
          </div>
          <button className="btn btn-primary" onClick={add} disabled={saving}>
            {saving ? "Agregando…" : "Agregar persona"}
          </button>
        </div>

        <div className="divider" />
        <div className="section-label">Personas registradas</div>

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
              {r.nombre}
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

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
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
            {visible.map((p) => (
              <div className={`person-row anim-slide${p.active ? "" : " inactive"}`} key={p.id}>
                <div className="person-main">
                  <span className="person-name">
                    {p.nombre} {p.apellido}
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
                  <button className="btn btn-edit btn-sm" onClick={() => setEditing(p)}>
                    Editar
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>
                    Borrar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {limit < filtered.length && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <button className="btn btn-ghost" style={{ width: "auto", padding: "8px 24px", fontSize: ".78rem" }} onClick={() => setLimit((l) => l + PAGE)}>
              Cargar más ↓
            </button>
          </div>
        )}
      </div>

      {editing && (
        <EditPersonModal
          person={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            mutate();
            setEditing(null);
          }}
        />
      )}
      {manageRoles && <RolesManager onClose={() => setManageRoles(false)} />}
    </div>
  );
}

function EditPersonModal({
  person,
  onClose,
  onSaved,
}: {
  person: Person;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const { roles } = useRoles();
  const [nombre, setNombre] = useState(person.nombre);
  const [apellido, setApellido] = useState(person.apellido);
  const [roleIds, setRoleIds] = useState<string[]>(person.roles.map((r) => r.id));
  const [active, setActive] = useState(person.active);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!nombre.trim()) return toast("⚠️ El nombre es obligatorio", "error");
    if (!apellido.trim()) return toast("⚠️ El apellido es obligatorio", "error");
    setSaving(true);
    try {
      await updatePerson(person.id, { nombre: nombre.trim(), apellido: apellido.trim(), roleIds, active });
      toast("✏️ Persona actualizada", "success");
      onSaved();
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Editar persona</span>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="form-grid">
          <div className="row-2">
            <div className="field-group">
              <label className="field-label">
                Nombre <span className="req">*</span>
              </label>
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" />
            </div>
            <div className="field-group">
              <label className="field-label">
                Apellido <span className="req">*</span>
              </label>
              <input type="text" value={apellido} onChange={(e) => setApellido(e.target.value)} autoComplete="off" />
            </div>
          </div>
          <div className="field-group">
            <label className="field-label">Roles</label>
            <RoleMultiSelect roles={roles} selected={roleIds} onChange={setRoleIds} />
          </div>
          <div className="field-group">
            <label className="switch" style={{ fontSize: ".8rem" }}>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              <span className="track" />
              {active ? "Activa (visible y asignable)" : "Inactiva (oculta, sin borrar)"}
            </label>
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
      </div>
    </div>
  );
}
