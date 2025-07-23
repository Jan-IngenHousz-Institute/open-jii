"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "next/client";
import type React from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { useLocale } from "~/hooks/useLocale";
import { useSetUserRegistered } from "~/hooks/useSetUserRegistered";

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
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

const registrationSchema = z.object({
  name: z.string().min(1),
  organization: z.string().optional(),
  acceptedTerms: z.boolean(),
});

type Registration = z.infer<typeof registrationSchema>;

export function RegistrationForm() {
  const { t } = useTranslation();
  const locale = useLocale();
  const form = useForm<Registration>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      name: "",
      organization: "",
      acceptedTerms: false,
    },
  });
  const { mutate: setUserRegistered } = useSetUserRegistered({
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    onSuccess: () => router.push(`/${locale}/platform/`),
  });

  function onSubmit(data: Registration) {
    console.log("Submitting", data);
    if (data.acceptedTerms) {
      toast({ description: "Registration successfully" });
      // setUserRegistered({
      //   body: undefined,
      // });
    } else {
      toast({ description: "You need to accept the terms and conditions." });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("auth.registration")}</CardTitle>
          <CardDescription>{t("auth.registrationDetails")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter your full name" />
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
                      <FormLabel>Organization</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter your organization" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3">
                <Label>Terms and Conditions</Label>
                <ScrollArea className="h-32 w-full rounded-md border p-4">
                  <div className="text-muted-foreground space-y-2 text-sm">
                    <p className="font-semibold">Terms of Service</p>
                    <p>
                      By registering for our service, you agree to comply with and be bound by the
                      following terms and conditions of use.
                    </p>
                    <p>
                      <strong>1. Acceptance of Terms:</strong> By accessing and using this service,
                      you accept and agree to be bound by the terms and provision of this agreement.
                    </p>
                    <p>
                      <strong>2. Privacy Policy:</strong> Your privacy is important to us. We
                      collect and use your information in accordance with our Privacy Policy.
                    </p>
                    <p>
                      <strong>3. User Responsibilities:</strong> You are responsible for maintaining
                      the confidentiality of your account and password and for restricting access to
                      your computer.
                    </p>
                    <p>
                      <strong>4. Prohibited Uses:</strong> You may not use our service for any
                      illegal or unauthorized purpose nor may you, in the use of the service,
                      violate any laws.
                    </p>
                    <p>
                      <strong>5. Limitation of Liability:</strong> In no event shall our company be
                      liable for any indirect, incidental, special, consequential, or punitive
                      damages.
                    </p>
                    <p>
                      <strong>6. Modifications:</strong> We reserve the right to modify these terms
                      at any time. Your continued use of the service constitutes acceptance of such
                      modifications.
                    </p>
                    <p>
                      <strong>7. Termination:</strong> We may terminate or suspend your account
                      immediately, without prior notice or liability, for any reason whatsoever.
                    </p>
                    <p>
                      <strong>8. Governing Law:</strong> These terms shall be governed and construed
                      in accordance with the laws of the jurisdiction in which our company is
                      located.
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
                          {t("auth.registrationAcceptTerms")}
                        </FormLabel>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={!form.formState.isValid}>
                Register
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
