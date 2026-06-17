"use client";

import type { Role } from "@/lib/types";

export function RoleBadge({ role, onRemove }: { role: Role; onRemove?: () => void }) {
  return (
    <span
      className="role-badge"
      style={{ color: role.color, borderColor: role.color, background: role.color + "22" }}
    >
      {role.nombre}
      {onRemove && (
        <span className="role-x" onClick={onRemove} title="Quitar rol">
          ×
        </span>
      )}
    </span>
  );
}

// Selector múltiple de roles (chips clicables).
export function RoleMultiSelect({
  roles,
  selected,
  onChange,
}: {
  roles: Role[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  if (roles.length === 0)
    return <div style={{ fontSize: ".72rem", color: "var(--text3)" }}>No hay roles aún.</div>;

  return (
    <div className="role-chips">
      {roles.map((r) => {
        const on = selected.includes(r.id);
        return (
          <button
            type="button"
            key={r.id}
            className="role-chip"
            onClick={() => toggle(r.id)}
            style={on ? { color: r.color, borderColor: r.color, background: r.color + "22" } : undefined}
          >
            {on ? "✓ " : ""}
            {r.nombre}
          </button>
        );
      })}
    </div>
  );
}
