import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Allowlist por env (respaldo "permanente"). Edge-safe (no toca la base de datos),
// por eso se puede usar en el middleware.
export function getAllowedEmails(): string[] {
  return (process.env.AUTHORIZED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
export function isEmailAllowed(email?: string | null): boolean {
  if (!email) return false;
  return getAllowedEmails().includes(email.toLowerCase());
}

// Config base, sin Prisma → segura para el Edge runtime (middleware).
export const authConfig: NextAuthConfig = {
  providers: [Google],
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // El middleware solo exige que haya sesión válida. Quién PUEDE iniciar sesión
    // se decide en el callback signIn (Node, con base de datos) en lib/auth.ts.
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname === "/login" ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/_next") ||
        pathname === "/favicon.ico";
      if (isPublic) return true;
      return !!auth?.user;
    },
    jwt({ token, profile }) {
      if (profile?.picture) token.picture = profile.picture as string;
      return token;
    },
    session({ session, token }) {
      if (token.picture && session.user) session.user.image = token.picture as string;
      return session;
    },
  },
};
