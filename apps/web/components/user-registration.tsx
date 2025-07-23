"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "next/client";
import { useForm } from "react-hook-form";
import z from "zod";
import { useLocale } from "~/hooks/useLocale";
import { useSetUserRegistered } from "~/hooks/useSetUserRegistered";

import {
  Button,
  Checkbox,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

const registrationSchema = z.object({
  agreedToTerms: z.boolean(),
});

type Registration = z.infer<typeof registrationSchema>;

export function UserRegistration() {
  const locale = useLocale();
  const { mutate: setUserRegistered } = useSetUserRegistered({
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    onSuccess: () => router.push(`/${locale}/platform/`),
  });

  const form = useForm<Registration>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      agreedToTerms: false,
    },
  });

  function onSubmit(data: Registration) {
    console.log("Submitted", data);
    setUserRegistered({
      body: undefined,
    });
    toast({ description: "Registration successfully" });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="agreedToTerms"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Terms and conditions</FormLabel>
              <FormControl>
                <Checkbox
                  id="agreedToTerms"
                  name="agreedToTerms"
                  checked={!!field.value}
                  onCheckedChange={field.onChange}
                  ref={field.ref}
                  disabled={field.disabled}
                  onBlur={field.onBlur}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Form>
  );
}
