"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import { useTranslation } from "@repo/i18n";
import { Alert, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";

export function AssistantCorpusDetail({ workId }: { workId: string }) {
  const { t } = useTranslation("assistant");
  const work = useQuery(orpc.assistantKnowledge.getCorpusWork.queryOptions({ input: { workId } }));
  if (work.isPending) return <p role="status">{t("workspace.loading")}</p>;
  if (work.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("workspace.error.title")}</AlertTitle>
      </Alert>
    );
  }
  const source = work.data;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>{source.title}</h1>
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            {source.authors.join(", ")} · {source.year}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{t(`knowledge.corpus.status.${source.status}`)}</Badge>
            <Badge variant="outline">{t(`knowledge.rights.${source.rights.status}`)}</Badge>
            {source.rights.licenceId && <Badge variant="outline">{source.rights.licenceId}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {source.rights.attribution && <p className="text-sm">{source.rights.attribution}</p>}
          {source.sourceUrl && /^https?:\/\//iu.test(source.sourceUrl) && (
            <a
              className="text-primary underline"
              href={source.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              {t("knowledge.corpus.fields.sourceUrl")}
            </a>
          )}
          {source.parse.elements.map((element, index) => (
            <section key={`${element.page}-${index}`} className="space-y-2 rounded-lg border p-3">
              <h2 className="text-muted-foreground text-xs">
                {t("knowledge.parse.elementPage", { page: element.page })}
              </h2>
              <p className="whitespace-pre-wrap text-sm">{element.content}</p>
            </section>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
