"use client";

import { useState } from "react";
import { useUsers } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/Confirm";
import { PageHeader } from "@/components/PageHeader";
import { createUser, deleteUser, fmtDT } from "@/lib/client";
import type { AllowedUser } from "@/lib/types";

export function UsuariosClient() {
  const { users, bootstrap, mutate } = useUsers();
  const toast = useToast();
  const confirm = useConfirm();

  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!email.trim()) return toast("⚠️ Escribe un correo", "error");
    setSaving(true);
    try {
      await createUser({ email: email.trim(), nombre: nombre.trim() || undefined });
      await mutate();
      setEmail("");
      setNombre("");
      toast("✅ Usuario autorizado", "success");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u: AllowedUser) => {
    const ok = await confirm({
      title: "Revocar acceso",
      message: `¿Quitar el acceso de ${u.email}? No podrá iniciar sesión.`,
      confirmText: "Revocar",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteUser(u.id);
      await mutate();
      toast("🗑️ Acceso revocado");
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    }
  };

  const total = users.length + bootstrap.length;

  return (
    <div className="page-inner fade-up">
      <PageHeader title="Usuarios" subtitle={`${total} con acceso a la aplicación`} />

      <div className="content-card">
        <div className="section-label">Autorizar nuevo correo</div>
        <div className="form-grid">
          <div className="row-2">
            <div className="field-group">
              <label className="field-label">
                Correo de Google <span className="req">*</span>
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="persona@gmail.com"
                autoComplete="off"
                inputMode="email"
              />
            </div>
            <div className="field-group">
              <label className="field-label">Nombre (opcional)</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Juan Pérez"
                autoComplete="off"
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
            </div>
          </div>
          <button className="btn btn-primary" onClick={add} disabled={saving}>
            {saving ? "Autorizando…" : "Autorizar acceso"}
          </button>
        </div>
        <div className="field-hint" style={{ marginTop: 10 }}>
          Podrá entrar iniciando sesión con ese correo de Google. No requiere redeploy.
        </div>
      </div>

      <div className="section-label">Con acceso</div>
      <div className="persons-list">
        {bootstrap.map((b) => (
          <div className="person-row" key={"b-" + b}>
            <div className="person-main">
              <span className="person-name">{b}</span>
            </div>
            <span className="person-badge-inactive" style={{ marginLeft: 0 }} title="Definido en variables de entorno (no se borra desde aquí)">
              🔒 permanente
            </span>
          </div>
        ))}
        {users.map((u) => (
          <div className="person-row anim-slide" key={u.id}>
            <div className="person-main">
              <span className="person-name">{u.nombre || u.email}</span>
              {u.nombre && <div className="user-email">{u.email}</div>}
              <div className="user-email" style={{ opacity: 0.7 }}>Autorizado {fmtDT(u.createdAt)}</div>
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => remove(u)}>
              Quitar
            </button>
          </div>
        ))}
      </div>

      {total === 0 && (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <h3>Sin usuarios</h3>
          <p>Autoriza un correo para dar acceso.</p>
        </div>
      )}
    </div>
  );
}
