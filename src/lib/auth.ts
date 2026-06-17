import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Lista blanca de correos autorizados (env AUTHORIZED_EMAILS, separada por comas).
 * Es el control central contra intrusos: solo estos correos obtienen sesión.
 * Comparación en minúsculas y sin espacios.
 */
function getAllowedEmails(): string[] {
  return (process.env.AUTHORIZED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email?: string | null): boolean {
  if (!email) return false;
  const allowed = getAllowedEmails();
  // Si la lista está vacía, se niega el acceso por seguridad (fail-closed).
  if (allowed.length === 0) return false;
  return allowed.includes(email.toLowerCase());
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  // Railway sirve detrás de un proxy; sin esto Auth.js rechaza el host ("UntrustedHost").
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    // Rechaza el inicio de sesión de cualquier correo fuera de la allowlist.
    signIn({ profile, user }) {
      const email = profile?.email ?? user?.email;
      return isEmailAllowed(email);
    },
    // Usado por el middleware (edge): protege todo salvo /login y /api/auth.
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname === "/login" ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/_next") ||
        pathname === "/favicon.ico";
      if (isPublic) return true;
      return Boolean(auth?.user && isEmailAllowed(auth.user.email));
    },
    jwt({ token, profile }) {
      if (profile?.picture) token.picture = profile.picture as string;
      return token;
    },
    session({ session, token }) {
      if (token.picture && session.user) {
        session.user.image = token.picture as string;
      }
      return session;
    },
  },
});
