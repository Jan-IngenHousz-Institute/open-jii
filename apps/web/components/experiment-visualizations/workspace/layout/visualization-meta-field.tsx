import { cn } from "@repo/ui/lib/utils";

interface VisualizationMetaFieldProps {
  label: string;
  value: string;
  mono?: boolean;
}

export function VisualizationMetaField({ label, value, mono }: VisualizationMetaFieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-foreground text-sm font-medium leading-[18px] tracking-[0.02em]">
        {label}
      </span>
      {/* A fully-qualified table identifier has no break opportunity, so
          without this it sets the row's min-content width. */}
      <span
        className={cn(
          "text-muted-foreground text-sm leading-[21px]",
          mono && "break-all font-mono",
        )}
      >
        {value}
      </span>
    </div>
  );
}
