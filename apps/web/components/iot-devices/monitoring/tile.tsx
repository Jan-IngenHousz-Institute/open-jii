"use client";

/** One triage-row cell, shared by the device and group monitoring dashboards. */
export function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="mt-1.5 text-sm font-medium">{children}</div>
    </div>
  );
}
