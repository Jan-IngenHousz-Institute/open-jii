import { cn } from "@repo/ui/lib/utils";

interface VisualizationMetaFieldProps {
  label: string;
  value: string;
  mono?: boolean;
}

export function VisualizationMetaField({ label, value, mono }: VisualizationMetaFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-foreground text-sm font-medium leading-[18px] tracking-[0.02em]">
        {label}
      </span>
      <span className={cn("text-muted-foreground text-sm leading-[21px]", mono && "font-mono")}>
        {value}
      </span>
    </div>
  );
}
