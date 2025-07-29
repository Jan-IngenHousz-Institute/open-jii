"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { handleLogout } from "~/app/actions/auth";
import { useCreateUserProfile } from "~/hooks/useCreateUserProfile";

import { useTranslation } from "@repo/i18n";
import {
  Button,
  Checkbox,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Label,
  Input,
  ScrollArea,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

export function RegistrationForm() {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const registrationSchema = z
    .object({
      firstName: z.string().min(2, t("registration.firstNameError")),
      lastName: z.string().min(2, t("registration.lastNameError")),
      organization: z.string().optional(),
      acceptedTerms: z.boolean(),
    })
    .superRefine(({ acceptedTerms }, ctx) => {
      if (!acceptedTerms) {
        ctx.addIssue({
          code: "custom",
          message: t("registration.acceptTermsError"),
          path: ["acceptedTerms"],
        });
      }
    });

  type Registration = z.infer<typeof registrationSchema>;

  const form = useForm<Registration>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      organization: "",
      acceptedTerms: false,
    },
  });

  const translations = {
    title: t("registration.signOutTitle"),
    description: t("registration.signOutDescription"),
    confirm: t("registration.signOutConfirm"),
  };

  const { mutate: createUserProfile } = useCreateUserProfile({
    onSuccess: () => {
      setDialogOpen(true);
    },
  });

  function onSubmit(data: Registration) {
    createUserProfile({
      body: {
        firstName: data.firstName,
        lastName: data.lastName,
        organization: data.organization,
      },
    });
    toast({ description: "Registration successfully" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("registration.title")}</CardTitle>
          <CardDescription>{t("registration.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("registration.firstName")}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t("registration.firstNamePlaceholder")} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("registration.lastName")}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t("registration.lastNamePlaceholder")} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="organization"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("registration.organization")}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t("registration.organizationPlaceholder")} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3">
                <Label>{t("registration.termsAndConditions")}</Label>
                <ScrollArea className="h-32 w-full rounded-md border p-4">
                  <div className="text-muted-foreground space-y-2 text-sm">
                    <p className="font-semibold">Lorem ipsum</p>
                    <p>
                      Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex
                      sapien vitae pellentesque sem placerat. In id cursus mi pretium tellus duis
                      convallis. Tempus leo eu aenean sed diam urna tempor. Pulvinar vivamus
                      fringilla lacus nec metus bibendum egestas. Iaculis massa nisl malesuada
                      lacinia integer nunc posuere. Ut hendrerit semper vel class aptent taciti
                      sociosqu. Ad litora torquent per conubia nostra inceptos himenaeos.
                    </p>
                    <p>
                      Nostra hendrerit litora ullamcorper praesent ligula taciti dignissim lacus
                      interdum. A gravida pharetra a himenaeos tincidunt. Tellus sociosqu elementum
                      lobortis lacus arcu volutpat turpis nunc. Suspendisse torquent cras morbi
                      habitant non id lacinia per ligula hendrerit nunc laoreet sollicitudin
                      blandit.
                    </p>
                    <p>
                      Congue inceptos condimentum adipiscing viverra vestibulum sociosqu conubia
                      finibus nisi class nam. Quisque senectus massa convallis mollis gravida ipsum
                      risus imperdiet quisque fermentum. Adipiscing ut dictum proin pulvinar
                      sociosqu leo orci bibendum tempus rutrum sagittis eros mattis pulvinar.
                    </p>
                    <p>
                      Class mauris donec mollis ipsum elit curae ligula convallis pretium et vitae.
                      Donec posuere nisi odio mi felis venenatis habitasse orci. Duis feugiat
                      scelerisque mauris per morbi habitant aptent elementum felis consequat id
                      euismod leo mattis himenaeos. Congue sollicitudin aliquet eleifend platea
                      scelerisque elit praesent vestibulum.
                    </p>
                    <p>
                      Dictum facilisis sociosqu venenatis dignissim rutrum erat per porta urna
                      aptent praesent quam finibus habitasse. Lorem placerat venenatis tellus eget
                      eget ut blandit cras turpis hendrerit aliquam rutrum consectetur.
                    </p>
                  </div>
                </ScrollArea>

                <div className="flex items-center">
                  <FormField
                    control={form.control}
                    name="acceptedTerms"
                    render={({ field }) => (
                      <FormItem className="space-x-2">
                        <FormControl>
                          <Checkbox
                            id={field.name}
                            name={field.name}
                            checked={!!field.value}
                            onCheckedChange={field.onChange}
                            ref={field.ref}
                            disabled={field.disabled}
                            onBlur={field.onBlur}
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          {t("registration.acceptTerms")}
                        </FormLabel>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full">
                {t("registration.register")}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <MandatorySignOutDialog translations={translations} open={dialogOpen} />
    </div>
  );
}

interface MandatorySignOutDialogProps {
  translations: {
    title: string;
    description: string;
    confirm: string;
  };
  open: boolean;
}

export function MandatorySignOutDialog({ translations, open }: MandatorySignOutDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent className="[&>button:last-child]:hidden">
        <DialogHeader>
          <DialogTitle>{translations.title}</DialogTitle>
          <DialogDescription>{translations.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end">
          <form action={() => handleLogout()} className="inline-flex">
            <Button type="submit" variant="default">
              {translations.confirm}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
