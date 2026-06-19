"use client";

import { SessionProvider } from "next-auth/react";
import { SWRConfig } from "swr";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/Confirm";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SWRConfig
        value={{
          revalidateOnFocus: true,
          revalidateOnReconnect: true,
          dedupingInterval: 2000,
        }}
      >
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </SWRConfig>
    </SessionProvider>
  );
}
