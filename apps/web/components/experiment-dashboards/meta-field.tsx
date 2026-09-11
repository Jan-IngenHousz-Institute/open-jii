interface MetaFieldProps {
  label: string;
  value: string;
}

export function MetaField({ label, value }: MetaFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-foreground text-sm font-medium leading-[18px] tracking-[0.02em]">
        {label}
      </span>
      <span className="text-muted-foreground text-sm leading-[21px]">{value}</span>
    </div>
  );
}
