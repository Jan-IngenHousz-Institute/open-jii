import { Mail } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@repo/ui/components/card";

interface UnsubscribeCardProps {
  heading?: string;
  body: string;
  children: ReactNode;
}

export function UnsubscribeCard({ heading, body, children }: UnsubscribeCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="bg-muted text-muted-foreground grid h-12 w-12 place-items-center rounded-full">
          <Mail className="h-5 w-5" aria-hidden />
        </div>
        {heading && <h1 className="text-xl font-semibold">{heading}</h1>}
        <p className="text-muted-foreground text-sm">{body}</p>
        <div className="flex flex-wrap justify-center gap-2">{children}</div>
      </CardContent>
    </Card>
  );
}
