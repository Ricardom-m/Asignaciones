// Protege toda la app con la sesión de Auth.js. El callback `authorized`
// (src/lib/auth.ts) decide qué rutas son públicas y verifica la allowlist.
// Al usar sesiones JWT, esto corre en el edge sin tocar la base de datos.
export { auth as middleware } from "@/lib/auth";

export const config = {
  // Aplica a todo excepto archivos estáticos. Las excepciones públicas
  // (/login, /api/auth) se manejan dentro del callback authorized.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};
