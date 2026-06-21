// Middleware en el Edge: usa SOLO la config base (sin Prisma). El callback
// `authorized` (lib/auth.config.ts) exige sesión válida; el control de quién
// puede iniciar sesión vive en el callback signIn (Node) de lib/auth.ts.
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};
