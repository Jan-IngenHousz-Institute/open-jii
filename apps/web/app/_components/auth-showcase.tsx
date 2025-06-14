import { auth, signIn, signOut } from "@repo/auth/next";
import type { TFunction } from "@repo/i18n";
import { Button } from "@repo/ui/components";

interface AuthShowcaseProps {
  t: TFunction;
}

export async function AuthShowcase({ t }: AuthShowcaseProps) {
  const session = await auth();

  if (!session) {
    return (
      <form>
        <Button
          size="lg"
          formAction={async () => {
            "use server";
            await signIn();
          }}
        >
          {t("auth.signIn")}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <p className="text-center text-2xl">
        <span>{t("auth.loggedInAs", { name: session.user.name })}</span>
      </p>

      <div className="flex flex-col gap-2">
        <form>
          <Button
            size="lg"
            formAction={async () => {
              "use server";
              await signOut();
            }}
          >
            {t("auth.signOutServer")}
          </Button>
        </form>
      </div>
    </div>
  );
}
