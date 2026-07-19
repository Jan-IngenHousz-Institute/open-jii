import { PasskeysCard } from "~/components/account-settings/passkeys/passkeys-card";
import { SignInMethodsCard } from "~/components/account-settings/security/sign-in-methods-card";

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <SignInMethodsCard />
      <PasskeysCard />
    </div>
  );
}
