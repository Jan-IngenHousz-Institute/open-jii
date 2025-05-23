import { auth, signIn, signOut } from "@repo/auth/next";
import { Button } from "@repo/ui/components";

export async function AuthShowcase() {
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
          Sign in
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <p className="text-center text-2xl">
        <span>Logged in as {session.user?.name}</span>
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
            Sign out (Server)
          </Button>
        </form>
      </div>
    </div>
  );
}
