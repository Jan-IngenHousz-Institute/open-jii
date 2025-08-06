"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UploadIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useTranslation } from "@repo/i18n";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";

interface UploadDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  experimentId: string;
}

type UploadState = "idle" | "uploading" | "success" | "error";

const uploadDataSchema = z.object({
  sensorFamily: z.enum(["MultispeQ", "Ambyte"], {
    required_error: "Please select a sensor family",
  }),
  file: z
    .instanceof(FileList)
    .optional()
    .refine((files) => files && files.length > 0, "Please select a file")
    .refine((files) => files?.[0]?.name.endsWith(".zip"), "File must be a .zip archive")
    .refine(
      (files) => files?.[0] && files[0].size <= 100 * 1024 * 1024, // 100MB limit
      "File size must be less than 100MB",
    ),
});

type UploadDataForm = z.infer<typeof uploadDataSchema>;

export function UploadDataModal({ isOpen, onClose, experimentId }: UploadDataModalProps) {
  const { t } = useTranslation();
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const form = useForm<UploadDataForm>({
    resolver: zodResolver(uploadDataSchema),
    defaultValues: {
      sensorFamily: undefined,
    },
  });

  const selectedSensorFamily = form.watch("sensorFamily");
  const isUploading = uploadState === "uploading";
  const isSuccess = uploadState === "success";
  const isError = uploadState === "error";

  const handleSubmit = async (data: UploadDataForm) => {
    if (!data.file || data.file.length === 0) return;

    setUploadState("uploading");
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("file", data.file[0]);
      formData.append("sensorFamily", data.sensorFamily);

      const response = await fetch(`/api/v1/experiments/${experimentId}/upload-data`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(errorData.message ?? `Upload failed: ${response.statusText}`);
      }

      setUploadState("success");
    } catch (error) {
      setUploadState("error");
      setErrorMessage(error instanceof Error ? error.message : t("uploadData.genericError"));
    }
  };

  const handleRetry = () => {
    setUploadState("idle");
    setErrorMessage("");
    form.reset();
  };

  const handleClose = () => {
    handleRetry();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isUploading && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("uploadData.title")}</DialogTitle>
          <DialogDescription>{t("uploadData.description")}</DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="space-y-4">
            <div className="py-4 text-center">
              <div className="text-lg font-medium text-green-600">{t("uploadData.success")}</div>
              <p className="text-muted-foreground mt-2 text-sm">
                {t("uploadData.successDescription")}
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleClose} variant="default">
                {t("uploadData.close")}
              </Button>
            </DialogFooter>
          </div>
        ) : isError ? (
          <div className="space-y-4">
            <div className="py-4 text-center">
              <div className="text-lg font-medium text-red-600">{t("uploadData.error")}</div>
              {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
            </div>
            <DialogFooter className="gap-2">
              <Button onClick={handleClose} variant="ghost">
                {t("uploadData.close")}
              </Button>
              <Button onClick={handleRetry} variant="default">
                {t("uploadData.retry")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="sensorFamily"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("uploadData.sensorFamily")} *</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isUploading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("uploadData.selectSensorFamily")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MultispeQ" disabled>
                            MultispeQ ({t("uploadData.comingSoon")})
                          </SelectItem>
                          <SelectItem value="Ambyte">Ambyte</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedSensorFamily === "Ambyte" && (
                <FormField
                  control={form.control}
                  name="file"
                  render={({ field: { onChange, ...field } }) => (
                    <FormItem>
                      <FormLabel>{t("uploadData.fileUpload")} *</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept=".zip"
                          disabled={isUploading}
                          onChange={(e) => onChange(e.target.files)}
                          className="file:bg-muted file:text-muted-foreground hover:file:bg-accent file:mr-2 file:rounded-md file:border-0 file:px-3 file:py-1"
                          {...field}
                          value=""
                        />
                      </FormControl>
                      <FormDescription>{t("uploadData.zipFileDescription")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter className="gap-2">
                <Button type="button" onClick={handleClose} variant="ghost" disabled={isUploading}>
                  {t("uploadData.cancel")}
                </Button>
                <Button type="submit" disabled={!form.formState.isValid || isUploading}>
                  {isUploading && <UploadIcon className="mr-2 h-4 w-4 animate-spin" />}
                  {isUploading ? t("uploadData.uploading") : t("uploadData.upload")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
