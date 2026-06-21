import NextAuth from "next-auth";
import { authConfig, isEmailAllowed, getAllowedEmails } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";

export { isEmailAllowed, getAllowedEmails };

/**
 * ¿El correo puede iniciar sesión? Autorizado si está en el respaldo por env
 * (AUTHORIZED_EMAILS) O en la tabla AllowedUser (gestionable desde la app).
 * Solo se usa en Node (signIn callback + requireSession), nunca en el Edge.
 */
export async function isEmailAuthorized(email?: string | null): Promise<boolean> {
  if (!email) return false;
  const e = email.toLowerCase();
  if (isEmailAllowed(e)) return true;
  const u = await prisma.allowedUser.findUnique({ where: { email: e } });
  return !!u;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // Rechaza el inicio de sesión de cualquier correo no autorizado (env o DB).
    async signIn({ profile, user }) {
      return await isEmailAuthorized(profile?.email ?? user?.email);
    },
  },
});
