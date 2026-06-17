"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useRecords } from "@/lib/hooks";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ImportExport } from "@/components/ImportExport";

interface Props {
  user: { name: string; email: string; image: string };
  children: React.ReactNode;
}

const NAV = [
  { href: "/nuevo", label: "Nuevo", icon: IconEdit },
  { href: "/registros", label: "Registros", icon: IconList },
  { href: "/personas", label: "Personas", icon: IconPeople },
];

export function AppShell({ user, children }: Props) {
  const pathname = usePathname();
  const { records } = useRecords();

  const initials =
    (user.name || user.email || "?")
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  const handleSignOut = () => {
    if (confirm("¿Cerrar sesión?")) signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="app-shell">
      <header>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div className="header-icon">📋</div>
          <div>
            <div className="header-title">Asignaciones</div>
            <div className="header-sub">Registro de actividades</div>
          </div>
        </div>
        <div className="header-right">
          <ThemeToggle />
          <ImportExport />
          <button
            className="avatar-wrap"
            onClick={handleSignOut}
            title={`${user.email} · cerrar sesión`}
          >
            {user.image ? (
              <Image
                className="avatar-img"
                src={user.image}
                alt={user.name}
                width={26}
                height={26}
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="avatar-default">{initials}</span>
            )}
            <span className="avatar-info">
              <span className="avatar-name">{(user.name || "").split(" ")[0]}</span>
              <span className="avatar-email">{user.email}</span>
            </span>
          </button>
          <div className="total-badge">{records.length}</div>
        </div>
      </header>

      <div className="scroll-area">{children}</div>

      <nav className="bottom">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className={`nav-btn${active ? " active" : ""}`}>
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
function IconList() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}
function IconPeople() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}
