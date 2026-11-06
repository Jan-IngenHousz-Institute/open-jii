import type { ReactNode } from "react";

import { StatusFooter } from "./status-footer";
import { StatusHeader } from "./status-header";

export function StatusFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <StatusHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-12 md:px-8">
        {children}
      </main>
      <StatusFooter />
    </>
  );
}
