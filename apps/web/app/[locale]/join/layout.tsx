import type { ReactNode } from "react";

/**
 * Deliberately outside `(info)` and `(auth)`: the CMS footer is one more thing to
 * fail on a phone that has just scanned a QR, and this page is not a sign-in step.
 */
export default function JoinLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen w-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
