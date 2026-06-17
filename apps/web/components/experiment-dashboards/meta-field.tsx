interface MetaFieldProps {
  label: string;
  value: string;
}

export function MetaField({ label, value }: MetaFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium leading-[18px] tracking-[0.02em] text-[#011111]">
        {label}
      </span>
      <span className="text-sm leading-[21px] text-[#68737B]">{value}</span>
    </div>
  );
}
