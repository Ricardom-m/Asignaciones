"use client";

import { useEffect, useState } from "react";

// Botón rápido para alternar tema claro/oscuro sin abrir el menú.
export function ThemeToggleButton() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  const toggle = () => {
    const isLight = document.documentElement.classList.toggle("light");
    localStorage.setItem("asgn_theme", isLight ? "light" : "dark");
    setLight(isLight);
  };

  return (
    <button
      className="hbtn theme-quick"
      onClick={toggle}
      title={light ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      aria-label="Cambiar tema"
      suppressHydrationWarning
    >
      {light ? "🌙" : "☀️"}
    </button>
  );
}
