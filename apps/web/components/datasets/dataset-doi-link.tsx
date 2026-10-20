import { ExternalLink } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

interface DatasetDoiLinkProps {
  doi: string;
  className?: string;
}

/** A DOI resolves through doi.org, so the link works whichever repository holds the record. */
export function DatasetDoiLink({ doi, className }: DatasetDoiLinkProps) {
  return (
    <a
      href={`https://doi.org/${doi}`}
      target="_blank"
      rel="noreferrer"
      className={cn("text-primary inline-flex items-center gap-1 hover:underline", className)}
    >
      {doi}
      <ExternalLink className="size-3 shrink-0" aria-hidden />
    </a>
  );
}
