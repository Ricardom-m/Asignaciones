import type { Genero } from "@/lib/types";

// Ícono de usuario (hombre): cabeza + hombros.
function IconMan() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a8 8 0 0 1 16 0v1" />
    </svg>
  );
}
// Ícono de usuaria (mujer): cabeza + vestido en A.
function IconWoman() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="6.5" r="3.5" />
      <path d="M12 10 7.5 20h9L12 10z" />
      <path d="M9.5 16.5h5" />
    </svg>
  );
}

export function GenderIcon({ genero }: { genero: Genero | null }) {
  if (!genero) return null;
  return (
    <span className={`gender-ico ${genero === "H" ? "h" : "m"}`} title={genero === "H" ? "Hombre" : "Mujer"}>
      {genero === "H" ? <IconMan /> : <IconWoman />}
    </span>
  );
}
