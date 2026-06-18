"use client";

import { useDebounce } from "@/hooks/useDebounce";
import { useLocale } from "@/hooks/useLocale";
import { Check, Globe, Loader2, Lock, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { toast } from "@repo/ui/hooks/use-toast";

const TYPES = [
  { value: "research_institute", label: "Research institute" },
  { value: "university", label: "University" },
  { value: "non_profit", label: "Non-profit" },
  { value: "private_company", label: "Company" },
  { value: "government_agency", label: "Government agency" },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Create-organization flow: name → live-checked slug, profile fields, visibility. */
export function CreateOrganizationForm() {
  const router = useRouter();
  const locale = useLocale();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [type, setType] = useState("research_institute");
  const [visibility, setVisibility] = useState("private");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [submitting, setSubmitting] = useState(false);

  const effectiveSlug = slugEdited ? slug : slugify(name);
  const [debouncedSlug] = useDebounce(effectiveSlug, 400);

  useEffect(() => {
    let active = true;
    if (!debouncedSlug) {
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    void authClient.organization
      .checkSlug({ slug: debouncedSlug })
      .then((res) => {
        if (!active) return;
        setSlugStatus(res.data?.status ? "available" : "taken");
      })
      .catch(() => active && setSlugStatus("taken"));
    return () => {
      active = false;
    };
  }, [debouncedSlug]);

  const canSubmit = name.trim().length > 1 && slugStatus === "available" && !submitting;

  const handleSubmit = async () => {
    setSubmitting(true);
    const res = await authClient.organization.create({
      name: name.trim(),
      slug: effectiveSlug,
      type,
      description: description.trim() || undefined,
      visibility,
    } as Parameters<typeof authClient.organization.create>[0]);
    setSubmitting(false);

    if (res.error) {
      toast({
        description: res.error.message ?? "Failed to create organization",
        variant: "destructive",
      });
      return;
    }
    await authClient.organization.setActive({ organizationId: res.data.id });
    toast({ description: "Organization created" });
    router.push(`/${locale}/platform/organizations/${res.data.id}`);
  };

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Create an organization</h1>
        <p className="text-muted-foreground text-sm">
          Organizations own experiments, protocols, macros, and workbooks, and group the people who
          work on them.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="org-name">Name</Label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Photosynthesis Lab"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="org-slug">URL slug</Label>
        <div className="relative">
          <Input
            id="org-slug"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="photosynthesis-lab"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {slugStatus === "checking" && (
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
            )}
            {slugStatus === "available" && <Check className="h-4 w-4 text-green-600" />}
            {slugStatus === "taken" && <X className="text-destructive h-4 w-4" />}
          </span>
        </div>
        {slugStatus === "taken" && (
          <p className="text-destructive text-xs">That slug is taken. Try another.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="org-description">Description</Label>
        <Textarea
          id="org-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this organization work on?"
          rows={3}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger aria-label="Organization type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Visibility</Label>
          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger aria-label="Organization visibility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">
                <span className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5" /> Private (invite-only)
                </span>
              </SelectItem>
              <SelectItem value="public">
                <span className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5" /> Public (discoverable)
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push(`/${locale}/platform/organizations`)}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Create organization
        </Button>
      </div>
    </div>
  );
}
