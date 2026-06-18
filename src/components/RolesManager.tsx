"use client";

import { useState } from "react";
import { useRoles } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { createRole, updateRole, deleteRole } from "@/lib/client";
import type { Role } from "@/lib/types";

export function RolesManager({ onClose }: { onClose: () => void }) {
  const { roles, mutate } = useRoles();
  const toast = useToast();
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("#4f8ef7");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!nombre.trim()) return toast("⚠️ Escribe el nombre del rol", "error");
    setBusy(true);
    try {
      await createRole({ nombre: nombre.trim(), color });
      await mutate();
      setNombre("");
      toast("✅ Rol creado", "success");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Gestionar roles" onClose={onClose}>
      <div className="form-grid">
        <div className="section-label">Nuevo rol</div>
        <div className="role-manage-row">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            title="Color del distintivo"
          />
          <input
            className="role-name-input"
            type="text"
            placeholder="Nombre del rol (ej. Acomodadores)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            autoComplete="off"
          />
          <button className="btn btn-primary btn-sm" onClick={add} disabled={busy}>
            Agregar
          </button>
        </div>

        <div className="divider" />
        <div className="section-label">Roles existentes</div>
        {roles.length === 0 ? (
          <div style={{ fontSize: ".75rem", color: "var(--text3)" }}>Aún no hay roles.</div>
        ) : (
          roles.map((r) => <RoleRow key={r.id} role={r} onChanged={mutate} />)
        )}
      </div>
    </Modal>
  );
}

function RoleRow({ role, onChanged }: { role: Role; onChanged: () => void }) {
  const toast = useToast();
  const [nombre, setNombre] = useState(role.nombre);
  const [color, setColor] = useState(role.color);
  const dirty = nombre !== role.nombre || color !== role.color;

  const save = async () => {
    try {
      await updateRole(role.id, { nombre: nombre.trim(), color });
      await onChanged();
      toast("✏️ Rol actualizado", "success");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    }
  };

  const toggleActive = async () => {
    try {
      await updateRole(role.id, { active: !role.active });
      await onChanged();
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    }
  };

  const remove = async () => {
    if (!confirm(`¿Borrar el rol "${role.nombre}"? Las personas no se borran, solo pierden este rol.`))
      return;
    try {
      await deleteRole(role.id);
      await onChanged();
      toast("🗑️ Rol eliminado");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    }
  };

  return (
    <div className="role-manage-row" style={{ opacity: role.active ? 1 : 0.55 }}>
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
      <input
        className="role-name-input"
        type="text"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        autoComplete="off"
      />
      {dirty ? (
        <button className="btn btn-primary btn-sm" onClick={save}>
          Guardar
        </button>
      ) : (
        <button className="btn btn-ghost btn-sm" onClick={toggleActive} title="Activar/desactivar">
          {role.active ? "Activo" : "Inactivo"}
        </button>
      )}
      <button className="btn btn-danger btn-sm" onClick={remove}>
        Borrar
      </button>
    </div>
  );
}
