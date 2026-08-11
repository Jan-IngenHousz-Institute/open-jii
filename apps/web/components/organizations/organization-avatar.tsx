import { Building2 } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

interface OrganizationAvatarProps {
  logo?: string | null;
  name: string;
  className?: string;
}

/**
 * An organization's mark. Logos are optional and rarely set, so the fallback is
 * the normal case rather than an error state.
 */
export function OrganizationAvatar({ logo, name, className }: OrganizationAvatarProps) {
  const size = cn("h-10 w-10 shrink-0 rounded-md", className);

  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote host, not a configured image domain.
    return <img src={logo} alt="" aria-hidden="true" className={cn(size, "object-cover")} />;
  }

  return (
    <div
      aria-hidden="true"
      className={cn(size, "bg-surface text-muted-foreground grid place-items-center border")}
      title={name}
    >
      <Building2 className="h-5 w-5" />
    </div>
  );
}
