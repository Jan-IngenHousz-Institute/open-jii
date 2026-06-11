import { cn } from "@repo/ui/lib/utils";

interface VisualizationMetaFieldProps {
  label: string;
  value: string;
  mono?: boolean;
}

export function VisualizationMetaField({ label, value, mono }: VisualizationMetaFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium leading-[18px] tracking-[0.02em] text-[#011111]">
        {label}
      </span>
      <span className={cn("text-sm leading-[21px] text-[#68737B]", mono && "font-mono")}>
        {value}
      </span>
    </div>
  );
}
