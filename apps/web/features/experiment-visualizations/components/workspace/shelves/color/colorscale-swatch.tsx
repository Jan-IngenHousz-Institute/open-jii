import { cn } from "@repo/ui/lib/utils";

interface ColorscaleSwatchProps {
  gradient: string;
  className?: string;
}

export function ColorscaleSwatch({ gradient, className }: ColorscaleSwatchProps) {
  return (
    <div className={cn("h-4 w-8 rounded border", className)} style={{ background: gradient }} />
  );
}
