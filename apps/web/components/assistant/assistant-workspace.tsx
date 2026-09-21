"use client";

import { useAssistant } from "@/components/assistant/assistant-context";
import { AssistantAttachment } from "@/components/assistant/assistant-message";
import { useMyOrganizations } from "@/hooks/organization/useMyOrganizations/useMyOrganizations";
import { getOrpcError, orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BadgeCheck,
  BookCopy,
  BookOpenText,
  Check,
  CircleAlert,
  FileSearch,
  Files,
  Gauge,
  Library,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { env } from "~/env";

import type {
  AssistantKnowledgeCapabilities,
  AssistantKnowledgeUploadReceipt,
  CorpusWork,
} from "@repo/api/domains/assistant-knowledge/assistant-knowledge.schema";
import type {
  AssistantStarter,
  AssistantStarterCollection,
} from "@repo/api/domains/assistant/assistant.schema";
import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Progress } from "@repo/ui/components/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Separator } from "@repo/ui/components/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { Textarea } from "@repo/ui/components/textarea";

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function StatusMessage({
  pending,
  error,
  empty,
  children,
}: {
  pending: boolean;
  error: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation("assistant");
  if (pending) {
    return (
      <div className="text-muted-foreground flex items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-sm">
        <LoaderCircle className="size-4 animate-spin" />
        {t("workspace.loading")}
      </div>
    );
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <CircleAlert className="size-4" />
        <AlertTitle>{t("workspace.error.title")}</AlertTitle>
        <AlertDescription>{t("workspace.error.description")}</AlertDescription>
      </Alert>
    );
  }
  if (empty) {
    return (
      <div className="text-muted-foreground rounded-xl border border-dashed px-6 py-16 text-center text-sm">
        {children}
      </div>
    );
  }
  return null;
}

function CopyStarterDialog({
  starter,
  open,
  onOpenChange,
}: {
  starter: AssistantStarter | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("assistant");
  const organizations = useMyOrganizations({ enabled: open });
  const [organizationId, setOrganizationId] = React.useState<string>("");
  const copy = useMutation(orpc.assistant.copyStarter.mutationOptions());

  const submit = () => {
    if (!starter) return;
    copy.mutate({
      starterId: starter.id,
      ...(organizationId ? { organizationId } : {}),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setOrganizationId("");
          copy.reset();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("starters.copy.title")}</DialogTitle>
          <DialogDescription>
            {starter ? t("starters.copy.description", { name: starter.name }) : ""}
          </DialogDescription>
        </DialogHeader>
        {copy.data ? (
          <div className="space-y-4">
            <Alert>
              <Check className="size-4" />
              <AlertTitle>{t("starters.copy.created")}</AlertTitle>
              <AlertDescription>{copy.data.name}</AlertDescription>
            </Alert>
            <Button asChild className="w-full">
              <Link href={copy.data.url}>{t("starters.copy.open")}</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="starter-organization">{t("starters.copy.organization")}</Label>
              <Select value={organizationId} onValueChange={setOrganizationId}>
                <SelectTrigger id="starter-organization">
                  <SelectValue placeholder={t("starters.copy.selectOrganization")} />
                </SelectTrigger>
                <SelectContent>
                  {organizations.data?.map((organization) => (
                    <SelectItem key={organization.id} value={organization.id}>
                      {organization.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">{t("starters.copy.privateHint")}</p>
            </div>
            {copy.isError && (
              <p className="text-destructive text-sm" role="alert">
                {t("starters.copy.error")}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel", { ns: "common" })}
              </Button>
              <Button disabled={!organizationId || copy.isPending} onClick={submit}>
                {copy.isPending && <LoaderCircle className="size-4 animate-spin" />}
                {t("starters.copy.action")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StarterLibrary() {
  const { t } = useTranslation("assistant");
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState<"all" | "experiment" | "protocol" | "workbook" | "macro">(
    "all",
  );
  const [sort, setSort] = React.useState<"reuse" | "updated">("reuse");
  const [copyStarter, setCopyStarter] = React.useState<AssistantStarter | null>(null);
  const starters = useQuery(
    orpc.assistant.listStarters.queryOptions({
      input: {
        limit: 100,
        ...(query.trim() ? { query: query.trim() } : {}),
        ...(type === "all" ? {} : { type }),
        sort,
      },
    }),
  );
  const curated = starters.data?.items.filter((item) => item.curated) ?? [];
  const publicItems = starters.data?.items.filter((item) => !item.curated) ?? [];

  const card = (starter: AssistantStarter) => (
    <Card key={starter.id} className="gap-4">
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="secondary">{t(`entity.${starter.type}`)}</Badge>
          {starter.curated && (
            <Badge className="gap-1">
              <BadgeCheck className="size-3" />
              {t("starters.curated")}
            </Badge>
          )}
        </div>
        <CardTitle className="text-base">{starter.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <p className="text-muted-foreground line-clamp-3 text-sm">
          {starter.description ?? t("starters.noDescription")}
        </p>
        <div className="text-muted-foreground mt-auto flex items-center justify-between gap-3 text-xs">
          <span className="truncate">{starter.ownerName ?? t("starters.community")}</span>
          <span>{t("starters.reused", { count: starter.reuseCount })}</span>
        </div>
        <Button onClick={() => setCopyStarter(starter)}>
          <BookCopy className="size-4" />
          {t("starters.start")}
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("starters.search")}
            className="pl-9"
          />
        </div>
        <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
          <SelectTrigger className="w-full lg:w-44" aria-label={t("starters.typeFilter")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("starters.types.all")}</SelectItem>
            <SelectItem value="experiment">{t("entity.experiment")}</SelectItem>
            <SelectItem value="protocol">{t("entity.protocol")}</SelectItem>
            <SelectItem value="workbook">{t("entity.workbook")}</SelectItem>
            <SelectItem value="macro">{t("entity.macro")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}>
          <SelectTrigger className="w-full lg:w-48" aria-label={t("starters.sortLabel")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="reuse">{t("starters.sort.reuse")}</SelectItem>
            <SelectItem value="updated">{t("starters.sort.updated")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <StatusMessage
        pending={starters.isPending}
        error={starters.isError}
        empty={!starters.isPending && !starters.isError && starters.data.items.length === 0}
      >
        {t("starters.empty")}
      </StatusMessage>

      {curated.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <BadgeCheck className="text-primary size-5" />
              {t("starters.curatedTitle")}
            </h2>
            <p className="text-muted-foreground text-sm">{t("starters.curatedDescription")}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{curated.map(card)}</div>
        </section>
      )}

      {publicItems.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{t("starters.publicTitle")}</h2>
            <p className="text-muted-foreground text-sm">{t("starters.publicDescription")}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{publicItems.map(card)}</div>
        </section>
      )}

      <CopyStarterDialog
        starter={copyStarter}
        open={!!copyStarter}
        onOpenChange={(open) => {
          if (!open) setCopyStarter(null);
        }}
      />
    </div>
  );
}

function ProviderState({ capabilities }: { capabilities: AssistantKnowledgeCapabilities }) {
  const { t } = useTranslation("assistant");
  const unavailable = Object.entries(capabilities.providers).filter(
    ([, provider]) => provider.state !== "available",
  );
  if (unavailable.length === 0) return null;
  return (
    <Alert>
      <Settings2 className="size-4" />
      <AlertTitle>{t("knowledge.capabilities.title")}</AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        {unavailable.map(([name, provider]) => (
          <div key={name} className="flex items-start justify-between gap-4 text-xs">
            <span className="font-medium">{t(`knowledge.provider.${name}`)}</span>
            <span className="text-muted-foreground text-right">
              {provider.code ? t(`knowledge.errorCode.${provider.code}`) : provider.message}
            </span>
          </div>
        ))}
      </AlertDescription>
    </Alert>
  );
}

function ParseSummary({ work }: { work: CorpusWork }) {
  const { t } = useTranslation("assistant");
  return (
    <div className="grid gap-2 text-xs sm:grid-cols-3">
      <div className="bg-muted/50 rounded-md px-3 py-2">
        <span className="text-muted-foreground block">{t("knowledge.parse.status")}</span>
        <span className="font-medium">{t(`knowledge.parse.state.${work.parse.status}`)}</span>
      </div>
      <div className="bg-muted/50 rounded-md px-3 py-2">
        <span className="text-muted-foreground block">{t("knowledge.parse.pages")}</span>
        <span className="font-medium">{work.parse.pages}</span>
      </div>
      <div className="bg-muted/50 rounded-md px-3 py-2">
        <span className="text-muted-foreground block">{t("knowledge.parse.confidence")}</span>
        <span className="font-medium">
          {work.parse.averageConfidence === null
            ? t("knowledge.parse.notAvailable")
            : `${Math.round(work.parse.averageConfidence * 100)}%`}
        </span>
      </div>
    </div>
  );
}

function ParseElements({ elements }: { elements: CorpusWork["parse"]["elements"] }) {
  const { t } = useTranslation("assistant");
  if (elements.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs font-medium">{t("knowledge.parse.preview")}</p>
      <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border p-2">
        {elements.map((element, index) => (
          <div
            key={`${element.page}-${element.kind}-${index}`}
            className="bg-muted/40 rounded-md p-3"
          >
            <div className="text-muted-foreground mb-1.5 flex items-center gap-2 text-[11px]">
              <Badge variant="outline" className="h-5 text-[10px]">
                {t(`knowledge.parse.kind.${element.kind}`)}
              </Badge>
              <span>{t("knowledge.parse.elementPage", { page: element.page })}</span>
              {element.confidence !== null && (
                <span className="ml-auto">{Math.round(element.confidence * 100)}%</span>
              )}
            </div>
            <p className="line-clamp-6 whitespace-pre-wrap text-xs leading-relaxed">
              {element.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CorpusWorkspace({ capabilities }: { capabilities: AssistantKnowledgeCapabilities }) {
  const { t } = useTranslation("assistant");
  const queryClient = useQueryClient();
  const organizations = useMyOrganizations();
  const [organizationId, setOrganizationId] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [corpusFiles, setCorpusFiles] = React.useState<Record<string, File | undefined>>({});
  const [uploadingCorpusId, setUploadingCorpusId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [reviewWork, setReviewWork] = React.useState<CorpusWork | null>(null);
  const [parseDecision, setParseDecision] = React.useState<"accepted" | "rejected">("accepted");
  const [rightsDecision, setRightsDecision] = React.useState<"pending" | "approved" | "rejected">(
    "approved",
  );
  const [externalPublicDecision, setExternalPublicDecision] = React.useState<
    "pending" | "approved" | "rejected"
  >("pending");
  const [rightsBasis, setRightsBasis] = React.useState<
    "open-access" | "author-owned" | "licensed" | "public-domain" | "authored-fixture"
  >("open-access");
  const [licenceId, setLicenceId] = React.useState("");
  const [licenceUrl, setLicenceUrl] = React.useState("");
  const [attribution, setAttribution] = React.useState("");
  const [reviewNote, setReviewNote] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [authors, setAuthors] = React.useState("");
  const [year, setYear] = React.useState(String(new Date().getFullYear()));
  const [tags, setTags] = React.useState("");
  const [sourceUrl, setSourceUrl] = React.useState("");

  const works = useQuery(
    orpc.assistantKnowledge.listCorpusWorks.queryOptions({
      input: { includeRemoved: false, ...(organizationId ? { organizationId } : {}) },
    }),
  );
  const documents = useQuery(
    orpc.assistantKnowledge.listDocuments.queryOptions({
      input: { ...(organizationId ? { organizationId } : {}) },
    }),
  );
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.assistantKnowledge.listCorpusWorks.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.assistantKnowledge.listDocuments.key() }),
    ]);
  };
  const create = useMutation(
    orpc.assistantKnowledge.createCorpusWork.mutationOptions({
      onSuccess: async () => {
        setCreateOpen(false);
        setTitle("");
        setAuthors("");
        setTags("");
        setSourceUrl("");
        await invalidate();
      },
    }),
  );
  const parseWork = useMutation(
    orpc.assistantKnowledge.parseCorpusWork.mutationOptions({ onSuccess: invalidate }),
  );
  const review = useMutation(
    orpc.assistantKnowledge.reviewCorpusWork.mutationOptions({
      onSuccess: async () => {
        setReviewWork(null);
        await invalidate();
      },
    }),
  );
  const admit = useMutation(
    orpc.assistantKnowledge.admitCorpusWork.mutationOptions({ onSuccess: invalidate }),
  );
  const remove = useMutation(
    orpc.assistantKnowledge.removeCorpusWork.mutationOptions({ onSuccess: invalidate }),
  );
  const parseDocument = useMutation(
    orpc.assistantKnowledge.parseDocument.mutationOptions({ onSuccess: invalidate }),
  );
  const deleteDocument = useMutation(
    orpc.assistantKnowledge.deleteDocument.mutationOptions({ onSuccess: invalidate }),
  );

  const upload = async () => {
    if (!file || !organizationId) return;
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("organizationId", organizationId);
    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_API_URL}/api/v1/assistant-knowledge/documents`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
          headers: { "x-app-source": "orpc" },
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? t("knowledge.documents.uploadError"));
      }
      await (response.json() as Promise<AssistantKnowledgeUploadReceipt>);
      setFile(null);
      await invalidate();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t("knowledge.documents.uploadError"));
    } finally {
      setUploading(false);
    }
  };

  const uploadCorpusFile = async (workId: string) => {
    const corpusFile = corpusFiles[workId];
    if (!corpusFile) return;
    setUploadingCorpusId(workId);
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", corpusFile);
    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_API_URL}/api/v1/assistant-knowledge/corpus/${workId}/file`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
          headers: { "x-app-source": "orpc" },
        },
      );
      if (!response.ok) throw new Error(t("knowledge.corpus.uploadError"));
      await (response.json() as Promise<CorpusWork>);
      setCorpusFiles((current) => ({ ...current, [workId]: undefined }));
      await invalidate();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t("knowledge.corpus.uploadError"));
    } finally {
      setUploadingCorpusId(null);
    }
  };

  const openReview = (work: CorpusWork) => {
    setReviewWork(work);
    setParseDecision(work.parse.status === "rejected" ? "rejected" : "accepted");
    setRightsDecision(work.rights.status);
    setExternalPublicDecision(work.rights.externalPublicStatus);
    setRightsBasis(work.rights.basis ?? "open-access");
    setLicenceId(work.rights.licenceId ?? "");
    setLicenceUrl(work.rights.licenceUrl ?? "");
    setAttribution(work.rights.attribution ?? "");
    setReviewNote(work.parse.reviewNote ?? "");
  };

  return (
    <div className="space-y-6">
      <ProviderState capabilities={capabilities} />

      <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="knowledge-organization">{t("knowledge.organization")}</Label>
          <Select value={organizationId} onValueChange={setOrganizationId}>
            <SelectTrigger id="knowledge-organization">
              <SelectValue placeholder={t("knowledge.selectOrganization")} />
            </SelectTrigger>
            <SelectContent>
              {organizations.data?.map((organization) => (
                <SelectItem key={organization.id} value={organization.id}>
                  {organization.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {capabilities.canCurateCorpus && (
          <Button onClick={() => setCreateOpen(true)} disabled={!organizationId}>
            <Plus className="size-4" />
            {t("knowledge.corpus.add")}
          </Button>
        )}
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BookOpenText className="text-primary size-5" />
            {t("knowledge.corpus.title")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("knowledge.corpus.description")}</p>
        </div>
        <StatusMessage
          pending={works.isPending}
          error={works.isError}
          empty={!works.isPending && !works.isError && works.data.length === 0}
        >
          {t("knowledge.corpus.empty")}
        </StatusMessage>
        <div className="space-y-3">
          {works.data?.map((work) => (
            <Card key={work.id} className="gap-4">
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{work.title}</CardTitle>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {work.authors.join(", ")} · {work.year}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{t(`knowledge.corpus.status.${work.status}`)}</Badge>
                    <Badge variant={work.rights.status === "approved" ? "default" : "secondary"}>
                      {t(`knowledge.rights.${work.rights.status}`)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ParseSummary work={work} />
                <ParseElements elements={work.parse.elements} />
                {work.topicTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {work.topicTags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                {work.parse.errorMessage && (
                  <p className="text-destructive text-xs">{work.parse.errorMessage}</p>
                )}
                {capabilities.canCurateCorpus && (
                  <div className="space-y-3">
                    {work.status === "held" && !work.fixture && (
                      <div className="grid gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-[1fr_auto] sm:items-end">
                        <div className="space-y-1.5">
                          <Label htmlFor={`corpus-file-${work.id}`}>
                            {t("knowledge.corpus.file")}
                          </Label>
                          <Input
                            id={`corpus-file-${work.id}`}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.doc,.docx,.ppt,.pptx"
                            onChange={(event) =>
                              setCorpusFiles((current) => ({
                                ...current,
                                [work.id]: event.target.files?.[0],
                              }))
                            }
                          />
                          {corpusFiles[work.id] && (
                            <AssistantAttachment
                              name={corpusFiles[work.id]?.name ?? ""}
                              mediaType={corpusFiles[work.id]?.type ?? ""}
                              detail={`${Math.ceil((corpusFiles[work.id]?.size ?? 0) / 1024).toLocaleString()} KB`}
                              removeLabel={t("knowledge.documents.removeSelected")}
                              onRemove={() =>
                                setCorpusFiles((current) => ({
                                  ...current,
                                  [work.id]: undefined,
                                }))
                              }
                            />
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!corpusFiles[work.id] || uploadingCorpusId === work.id}
                          onClick={() => uploadCorpusFile(work.id)}
                        >
                          {uploadingCorpusId === work.id ? (
                            <LoaderCircle className="size-4 animate-spin" />
                          ) : (
                            <Upload className="size-4" />
                          )}
                          {t("knowledge.corpus.upload")}
                        </Button>
                      </div>
                    )}
                    <div className="flex flex-wrap justify-end gap-2">
                      {["uploaded", "failed"].includes(work.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={parseWork.isPending}
                          onClick={() => parseWork.mutate({ workId: work.id })}
                        >
                          <FileSearch className="size-4" />
                          {t("knowledge.corpus.parse")}
                        </Button>
                      )}
                      {work.status === "review" && (
                        <Button size="sm" variant="outline" onClick={() => openReview(work)}>
                          <BadgeCheck className="size-4" />
                          {t("knowledge.corpus.review")}
                        </Button>
                      )}
                      {work.parse.status === "accepted" &&
                        work.rights.status === "approved" &&
                        work.status !== "active" && (
                          <Button
                            size="sm"
                            disabled={admit.isPending}
                            onClick={() => admit.mutate({ workId: work.id })}
                          >
                            <Check className="size-4" />
                            {t("knowledge.corpus.admit")}
                          </Button>
                        )}
                      {work.status !== "removed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate({ workId: work.id })}
                        >
                          <Trash2 className="size-4" />
                          {t("knowledge.corpus.remove")}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Files className="text-primary size-5" />
            {t("knowledge.documents.title")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("knowledge.documents.description")}</p>
        </div>
        {capabilities.canUploadDocument ? (
          <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="assistant-document">{t("knowledge.documents.file")}</Label>
              <Input
                id="assistant-document"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.doc,.docx,.ppt,.pptx"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              {file && (
                <AssistantAttachment
                  name={file.name}
                  mediaType={file.type}
                  detail={`${Math.ceil(file.size / 1024).toLocaleString()} KB`}
                  removeLabel={t("knowledge.documents.removeSelected")}
                  onRemove={() => setFile(null)}
                />
              )}
              <p className="text-muted-foreground flex items-center gap-1 text-xs">
                <LockKeyhole className="size-3" />
                {t("knowledge.documents.privateHint")}
              </p>
            </div>
            <Button disabled={!file || !organizationId || uploading} onClick={upload}>
              {uploading ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {t("knowledge.documents.upload")}
            </Button>
            {uploadError && <p className="text-destructive text-sm md:col-span-2">{uploadError}</p>}
          </div>
        ) : (
          <Alert>
            <CircleAlert className="size-4" />
            <AlertTitle>{t("knowledge.documents.unavailableTitle")}</AlertTitle>
            <AlertDescription>{t("knowledge.documents.unavailableDescription")}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {documents.data?.map((document) => (
            <Card key={document.id} className="gap-3">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{document.fileName}</span>
                  <Badge variant="outline">
                    {t(`knowledge.parse.state.${document.parse.status}`)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-muted-foreground flex justify-between text-xs">
                  <span>{Math.ceil(document.byteSize / 1024).toLocaleString()} KB</span>
                  <span>{t("knowledge.parse.pageCount", { count: document.parse.pages })}</span>
                </div>
                <ParseElements elements={document.parse.elements} />
                <div className="flex justify-end gap-2">
                  {["not-started", "failed"].includes(document.parse.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={parseDocument.isPending}
                      onClick={() => parseDocument.mutate({ documentId: document.id })}
                    >
                      <FileSearch className="size-4" />
                      {t("knowledge.documents.parse")}
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label={t("knowledge.documents.delete")}
                    disabled={deleteDocument.isPending}
                    onClick={() => deleteDocument.mutate({ documentId: document.id })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("knowledge.corpus.createTitle")}</DialogTitle>
            <DialogDescription>{t("knowledge.corpus.createDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="corpus-title">{t("knowledge.corpus.fields.title")}</Label>
              <Input
                id="corpus-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="corpus-authors">{t("knowledge.corpus.fields.authors")}</Label>
              <Input
                id="corpus-authors"
                value={authors}
                onChange={(event) => setAuthors(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="corpus-year">{t("knowledge.corpus.fields.year")}</Label>
              <Input
                id="corpus-year"
                type="number"
                value={year}
                onChange={(event) => setYear(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="corpus-tags">{t("knowledge.corpus.fields.tags")}</Label>
              <Input
                id="corpus-tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="corpus-source">{t("knowledge.corpus.fields.sourceUrl")}</Label>
              <Input
                id="corpus-source"
                type="url"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
              />
            </div>
          </div>
          {create.isError && (
            <p className="text-destructive text-sm">{t("knowledge.corpus.createError")}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("common.cancel", { ns: "common" })}
            </Button>
            <Button
              disabled={!organizationId || !title.trim() || !authors.trim() || create.isPending}
              onClick={() =>
                create.mutate({
                  organizationId,
                  title: title.trim(),
                  authors: authors
                    .split(",")
                    .map((author) => author.trim())
                    .filter(Boolean),
                  year: Number(year),
                  topicTags: tags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                  ...(sourceUrl.trim() ? { sourceUrl: sourceUrl.trim() } : {}),
                })
              }
            >
              {create.isPending && <LoaderCircle className="size-4 animate-spin" />}
              {t("knowledge.corpus.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewWork} onOpenChange={(open) => !open && setReviewWork(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("knowledge.review.title")}</DialogTitle>
            <DialogDescription>{reviewWork?.title}</DialogDescription>
          </DialogHeader>
          {reviewWork && <ParseSummary work={reviewWork} />}
          {reviewWork && <ParseElements elements={reviewWork.parse.elements} />}
          <Alert>
            <BadgeCheck className="size-4" />
            <AlertTitle>{t("knowledge.review.rightsTitle")}</AlertTitle>
            <AlertDescription>{t("knowledge.review.rightsDescription")}</AlertDescription>
          </Alert>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("knowledge.review.parseDecision")}</Label>
              <Select
                value={parseDecision}
                onValueChange={(value) => setParseDecision(value as typeof parseDecision)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accepted">{t("knowledge.parse.state.accepted")}</SelectItem>
                  <SelectItem value="rejected">{t("knowledge.parse.state.rejected")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("knowledge.review.rightsDecision")}</Label>
              <Select
                value={rightsDecision}
                onValueChange={(value) => setRightsDecision(value as typeof rightsDecision)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{t("knowledge.rights.pending")}</SelectItem>
                  <SelectItem value="approved">{t("knowledge.rights.approved")}</SelectItem>
                  <SelectItem value="rejected">{t("knowledge.rights.rejected")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("knowledge.review.externalDecision")}</Label>
              <Select
                value={externalPublicDecision}
                onValueChange={(value) =>
                  setExternalPublicDecision(value as typeof externalPublicDecision)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{t("knowledge.rights.pending")}</SelectItem>
                  <SelectItem value="approved">{t("knowledge.rights.approved")}</SelectItem>
                  <SelectItem value="rejected">{t("knowledge.rights.rejected")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("knowledge.review.basis")}</Label>
              <Select
                value={rightsBasis}
                onValueChange={(value) => setRightsBasis(value as typeof rightsBasis)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "open-access",
                    "author-owned",
                    "licensed",
                    "public-domain",
                    "authored-fixture",
                  ].map((basis) => (
                    <SelectItem key={basis} value={basis}>
                      {t(`knowledge.basis.${basis}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rights-licence">{t("knowledge.review.licenceId")}</Label>
              <Input
                id="rights-licence"
                value={licenceId}
                onChange={(event) => setLicenceId(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rights-url">{t("knowledge.review.licenceUrl")}</Label>
              <Input
                id="rights-url"
                type="url"
                value={licenceUrl}
                onChange={(event) => setLicenceUrl(event.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rights-attribution">{t("knowledge.review.attribution")}</Label>
              <Input
                id="rights-attribution"
                value={attribution}
                onChange={(event) => setAttribution(event.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="parse-note">{t("knowledge.review.note")}</Label>
              <Textarea
                id="parse-note"
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewWork(null)}>
              {t("common.cancel", { ns: "common" })}
            </Button>
            <Button
              disabled={!reviewWork || review.isPending || !licenceId.trim() || !attribution.trim()}
              onClick={() => {
                if (!reviewWork || !licenceId.trim() || !attribution.trim()) return;
                review.mutate({
                  workId: reviewWork.id,
                  parseDecision,
                  parseReviewNote: reviewNote.trim() || undefined,
                  rightsDecision,
                  externalPublicDecision,
                  rights: {
                    basis: rightsBasis,
                    licenceId: licenceId.trim(),
                    licenceUrl: licenceUrl.trim() || null,
                    attribution: attribution.trim(),
                  },
                });
              }}
            >
              {review.isPending && <LoaderCircle className="size-4 animate-spin" />}
              {t("knowledge.review.accept")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          {label}
        </CardTitle>
        <Icon className="text-primary size-4" />
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  );
}

function CollectionEditor({
  collection,
  starters,
}: {
  collection: AssistantStarterCollection;
  starters: AssistantStarter[];
}) {
  const { t } = useTranslation("assistant");
  const queryClient = useQueryClient();
  const [selected, setSelected] = React.useState(() => new Set(collection.starterIds));
  const update = useMutation(
    orpc.assistant.setStarterCollectionItems.mutationOptions({
      onSuccess: async () =>
        queryClient.invalidateQueries({ queryKey: orpc.assistant.listStarterCollections.key() }),
    }),
  );
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base">{collection.name}</CardTitle>
        {collection.description && (
          <p className="text-muted-foreground text-sm">{collection.description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border p-3">
          {starters.map((starter) => (
            <label key={starter.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={selected.has(starter.id)}
                onCheckedChange={(checked) =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (checked) next.add(starter.id);
                    else next.delete(starter.id);
                    return next;
                  })
                }
              />
              <span className="min-w-0 flex-1 truncate">{starter.name}</span>
              <Badge variant="outline">{t(`entity.${starter.type}`)}</Badge>
            </label>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={update.isPending}
          onClick={() => update.mutate({ collectionId: collection.id, starterIds: [...selected] })}
        >
          {update.isPending && <LoaderCircle className="size-4 animate-spin" />}
          {t("operator.collections.save")}
        </Button>
      </CardContent>
    </Card>
  );
}

function UsageWorkspace({ locale }: { locale: string }) {
  const { t } = useTranslation("assistant");
  const queryClient = useQueryClient();
  const usage = useQuery(orpc.assistant.getUsage.queryOptions({ input: {} }));
  const metrics = useQuery(orpc.assistant.listMetrics.queryOptions({ input: {}, retry: false }));
  const collections = useQuery(
    orpc.assistant.listStarterCollections.queryOptions({ input: {}, retry: false }),
  );
  const starters = useQuery(
    orpc.assistant.listStarters.queryOptions({ input: { limit: 100, sort: "reuse" } }),
  );
  const [budget, setBudget] = React.useState("");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const setBudgetMutation = useMutation(
    orpc.assistant.setDailyBudget.mutationOptions({
      onSuccess: async () => {
        setBudget("");
        await queryClient.invalidateQueries({ queryKey: orpc.assistant.listMetrics.key() });
      },
    }),
  );
  const createCollection = useMutation(
    orpc.assistant.upsertStarterCollection.mutationOptions({
      onSuccess: async () => {
        setName("");
        setDescription("");
        await queryClient.invalidateQueries({
          queryKey: orpc.assistant.listStarterCollections.key(),
        });
      },
    }),
  );

  if (usage.isPending)
    return (
      <StatusMessage pending error={false} empty={false}>
        {null}
      </StatusMessage>
    );
  if (usage.isError)
    return (
      <StatusMessage pending={false} error empty={false}>
        {null}
      </StatusMessage>
    );
  const quota = usage.data.quota;
  const percent = Math.min(100, (quota.tokensUsed / quota.dailyTokenLimit) * 100);
  const operator = metrics.data;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{t("usage.yours.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("usage.yours.description")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Sparkles}
            label={t("usage.turns")}
            value={formatNumber(usage.data.totals.turns, locale)}
          />
          <MetricCard
            icon={Gauge}
            label={t("usage.tokensUsed")}
            value={formatNumber(quota.tokensUsed, locale)}
          />
          <MetricCard
            icon={Activity}
            label={t("usage.toolCalls")}
            value={formatNumber(usage.data.totals.toolCalls, locale)}
          />
          <MetricCard
            icon={BookCopy}
            label={t("usage.starterCopies")}
            value={formatNumber(usage.data.totals.starterCopies, locale)}
          />
        </div>
        <Card className="gap-3">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">{t("quota.title")}</CardTitle>
              <p className="text-muted-foreground mt-1 text-xs">
                {t("quota.resets", { date: new Date(quota.resetsAt).toLocaleString(locale) })}
              </p>
            </div>
            <span className="text-sm font-medium">
              {formatNumber(quota.tokensRemaining, locale)} /{" "}
              {formatNumber(quota.dailyTokenLimit, locale)}
            </span>
          </CardHeader>
          <CardContent>
            <Progress value={percent} />
          </CardContent>
        </Card>
      </section>

      {operator ? (
        <section className="space-y-5">
          <Separator />
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Users className="text-primary size-5" />
              {t("operator.title")}
            </h2>
            <p className="text-muted-foreground text-sm">{t("operator.description")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Sparkles}
              label={t("usage.turns")}
              value={formatNumber(operator.totals.turns, locale)}
            />
            <MetricCard
              icon={Activity}
              label={t("usage.toolCalls")}
              value={formatNumber(operator.totals.toolCalls, locale)}
            />
            <MetricCard
              icon={BadgeCheck}
              label={t("usage.approvals")}
              value={formatNumber(operator.totals.approvals, locale)}
            />
            <MetricCard
              icon={BookCopy}
              label={t("usage.starterCopies")}
              value={formatNumber(operator.totals.starterCopies, locale)}
            />
          </div>
          <Card className="gap-4">
            <CardHeader>
              <CardTitle className="text-base">{t("operator.budget.title")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row">
              <Input
                type="number"
                min={1000}
                max={10_000_000}
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                placeholder={String(operator.dailyTokenLimit)}
              />
              <Button
                disabled={!budget || setBudgetMutation.isPending}
                onClick={() => setBudgetMutation.mutate({ dailyTokens: Number(budget) })}
              >
                {t("operator.budget.save")}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h3 className="font-semibold">{t("operator.collections.title")}</h3>
            <Card className="gap-4">
              <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("operator.collections.name")}
                />
                <Input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t("operator.collections.description")}
                />
                <Button
                  className="sm:col-span-2 sm:justify-self-start"
                  disabled={!name.trim() || createCollection.isPending}
                  onClick={() =>
                    createCollection.mutate({
                      name: name.trim(),
                      description: description.trim() || null,
                    })
                  }
                >
                  <Plus className="size-4" />
                  {t("operator.collections.create")}
                </Button>
              </CardContent>
            </Card>
            <div className="grid gap-4 lg:grid-cols-2">
              {collections.data?.map((collection) => (
                <CollectionEditor
                  key={collection.id}
                  collection={collection}
                  starters={starters.data?.items ?? []}
                />
              ))}
            </div>
          </div>
        </section>
      ) : metrics.isError && getOrpcError(metrics.error)?.status !== 403 ? (
        <Alert variant="destructive">
          <CircleAlert className="size-4" />
          <AlertTitle>{t("operator.error")}</AlertTitle>
        </Alert>
      ) : null}
    </div>
  );
}

export function AssistantWorkspace({ locale }: { locale: string }) {
  const { t } = useTranslation("assistant");
  const assistant = useAssistant();
  const capabilities = useQuery(
    orpc.assistantKnowledge.getCapabilities.queryOptions({ enabled: assistant.enabled }),
  );

  if (!assistant.enabled) return null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="text-primary mb-2 flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4" />
            {t("workspace.eyebrow")}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("workspace.title")}</h1>
          <p className="text-muted-foreground mt-2 max-w-3xl">{t("workspace.description")}</p>
        </div>
        <Button onClick={assistant.openAssistant}>
          <Sparkles className="size-4" />
          {t("open")}
        </Button>
      </header>

      <Tabs defaultValue="starters" className="min-h-0">
        <TabsList className="grid h-auto w-full grid-cols-3 sm:w-fit">
          <TabsTrigger value="starters">
            <Library className="size-4" />
            {t("workspace.tabs.starters")}
          </TabsTrigger>
          <TabsTrigger value="knowledge">
            <BookOpenText className="size-4" />
            {t("workspace.tabs.knowledge")}
          </TabsTrigger>
          <TabsTrigger value="usage">
            <Gauge className="size-4" />
            {t("workspace.tabs.usage")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="starters" className="mt-6">
          <StarterLibrary />
        </TabsContent>
        <TabsContent value="knowledge" className="mt-6">
          {capabilities.data ? (
            <CorpusWorkspace capabilities={capabilities.data} />
          ) : (
            <StatusMessage
              pending={capabilities.isPending}
              error={capabilities.isError}
              empty={false}
            >
              {null}
            </StatusMessage>
          )}
        </TabsContent>
        <TabsContent value="usage" className="mt-6">
          <UsageWorkspace locale={locale} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
