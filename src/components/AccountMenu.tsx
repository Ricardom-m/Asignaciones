"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { signOut } from "next-auth/react";
import { apiFetch } from "@/lib/client";
import { useToast } from "@/components/Toast";
import type { Person, RecordItem } from "@/lib/types";

interface Props {
  user: { name: string; email: string; image: string };
  showName?: boolean; // muestra nombre+apellidos junto al avatar (sidebar)
}

export function AccountMenu({ user, showName = false }: Props) {
  const [open, setOpen] = useState(false);
  const [light, setLight] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();
  const { mutate } = useSWRConfig();

  const initials =
    (user.name || user.email || "?")
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const toggleTheme = () => {
    const isLight = document.documentElement.classList.toggle("light");
    localStorage.setItem("asgn_theme", isLight ? "light" : "dark");
    setLight(isLight);
  };

  const handleExport = async () => {
    try {
      const [persons, recordsRes] = await Promise.all([
        apiFetch<Person[]>("/api/persons"),
        apiFetch<{ items: RecordItem[] }>("/api/records?all=1"),
      ]);
      const records = recordsRes.items;
      const payload = JSON.stringify({ records, persons, exportedAt: new Date().toISOString() }, null, 2);
      const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "asignaciones_" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      URL.revokeObjectURL(url);
      toast("💾 Archivo exportado", "success");
      setOpen(false);
    } catch (e) {
      toast("❌ " + (e as Error).message, "error");
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const d = JSON.parse(String(ev.target?.result));
        setBusy(true);
        const res = await apiFetch<{ personsCreated: number; recordsImported: number; skipped: number }>(
          "/api/import",
          { method: "POST", body: JSON.stringify({ persons: d.persons ?? [], records: d.records ?? [] }) },
        );
        await Promise.all([
          mutate((k) => typeof k === "string" && k.includes("/api/records")),
          mutate("/api/persons"),
        ]);
        toast(`📤 ${res.personsCreated} personas, ${res.recordsImported} registros`, "success");
        setOpen(false);
      } catch (err) {
        toast("❌ " + (err as Error).message, "error");
      } finally {
        setBusy(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className={`account-wrap${showName ? " account-wrap-full" : ""}`} ref={wrapRef}>
      <button
        className={`avatar-wrap${showName ? " account-trigger-full" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title="Cuenta"
      >
        {user.image ? (
          <Image className="avatar-img" src={user.image} alt={user.name} width={25} height={25} referrerPolicy="no-referrer" />
        ) : (
          <span className="avatar-default">{initials}</span>
        )}
        {showName && <span className="account-trigger-name">{user.name || user.email}</span>}
      </button>

      {open && (
        <div className="account-menu">
          <div className="account-head">
            {user.image ? (
              <Image className="avatar-img" src={user.image} alt={user.name} width={34} height={34} referrerPolicy="no-referrer" style={{ width: 34, height: 34 }} />
            ) : (
              <span className="avatar-default" style={{ width: 34, height: 34, fontSize: ".8rem" }}>
                {initials}
              </span>
            )}
            <div style={{ minWidth: 0 }}>
              <div className="account-name">{user.name || "Usuario"}</div>
              <div className="account-email">{user.email}</div>
            </div>
          </div>

          <button className="account-item" onClick={toggleTheme}>
            <span className="ico">{light ? "🌙" : "☀️"}</span>
            {light ? "Modo oscuro" : "Modo claro"}
          </button>
          <button className="account-item" onClick={handleExport}>
            <span className="ico">💾</span> Exportar datos
          </button>
          <button className="account-item" onClick={() => fileInput.current?.click()} disabled={busy}>
            <span className="ico">📤</span> {busy ? "Importando…" : "Importar datos"}
          </button>

          <div className="account-divider" />
          <button
            className="account-item"
            onClick={() => {
              setOpen(false);
              router.push("/usuarios");
            }}
          >
            <span className="ico">👥</span> Usuarios
          </button>

          <div className="account-divider" />
          <button className="account-item danger" onClick={() => signOut({ callbackUrl: "/login" })}>
            <span className="ico">⏻</span> Cerrar sesión
          </button>
        </div>
      )}

      <input ref={fileInput} type="file" accept=".json" onChange={handleImportFile} style={{ display: "none" }} />
    </div>
  );
}
