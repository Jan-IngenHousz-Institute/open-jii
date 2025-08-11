import Image from "next/image";
import { redirect } from "next/navigation";
import type React from "react";
import { RegistrationForm } from "~/components/registration-form";
import { auth } from "~/lib/auth";
import { getFirstSearchParam } from "~/util/searchParams";
import type { SearchParamsType } from "~/util/searchParams";

import type { Locale } from "@repo/i18n";
import { Toaster } from "@repo/ui/components";

export default async function UserRegistrationPage({
  searchParams,
  params,
}: {
  searchParams: SearchParamsType;
  params: Promise<{ locale: Locale }>;
}) {
  const session = await auth();
  const { locale } = await params;
  const { callbackUrl } = await searchParams;

  if (!session?.user) {
    redirect(`/api/auth/signin`);
  }

  if (session.user.registered) {
    redirect(`/${locale}/platform`);
  }

  return (
    <>
      <div className="grid min-h-svh lg:grid-cols-2">
        <div className="flex flex-col gap-4 p-6 md:p-10">
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-fit">
              <RegistrationForm callbackUrl={getFirstSearchParam(callbackUrl)} />
            </div>
          </div>
        </div>
        <div className="bg-muted relative hidden lg:block">
          <Image
            src="/placeholder.svg"
            width={300}
            height={300}
            alt="Image"
            className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
          />
        </div>
      </div>
      <Toaster />
    </>
  );
}
