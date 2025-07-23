import Image from "next/image";
import type React from "react";
import { RegistrationForm } from "~/components/registration-form";

import { Toaster } from "@repo/ui/components";

export default function VerifyRequestPage() {
  return (
    <>
      <div className="grid min-h-svh lg:grid-cols-2">
        <div className="flex flex-col gap-4 p-6 md:p-10">
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-fit">
              <RegistrationForm />
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
