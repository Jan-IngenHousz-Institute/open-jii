import { LoginForm } from "@/components/login-form";
import type { SearchParamsType } from "@/util/searchParams";
import { getFirstSearchParam } from "@/util/searchParams";
import Image from "next/image";

export default async function LoginPage(props: {
  searchParams: SearchParamsType;
}) {
  const { callbackUrl } = await props.searchParams;
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm callbackUrl={getFirstSearchParam(callbackUrl)} />
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
  );
}
