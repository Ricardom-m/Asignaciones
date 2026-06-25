"use client";

import { createContext, useContext } from "react";

interface SessionUser {
  name: string;
  email: string;
  image: string;
  isAdmin?: boolean;
}

const Ctx = createContext<SessionUser | null>(null);

export function UserProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return <Ctx.Provider value={user}>{children}</Ctx.Provider>;
}

export function useCurrentUser() {
  return useContext(Ctx);
}

export function useIsAdmin() {
  return !!useContext(Ctx)?.isAdmin;
}
