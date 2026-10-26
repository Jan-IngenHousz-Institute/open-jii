"use client";

import { useEffect, useState } from "react";

import { authClient } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

export function OAuthConsentForm({ clientId, scope }: { clientId?: string; scope: string }) {
  const { t } = useTranslation();
  const [clientName, setClientName] = useState<string>();
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    if (!clientId) {
      setError(true);
      return;
    }
    void authClient.oauth2
      .publicClient({ query: { client_id: clientId } })
      .then((result) => {
        if (!active) return;
        if (result.error) setError(true);
        else setClientName(result.data.client_name ?? clientId);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [clientId]);

  async function consent(accept: boolean) {
    setPending(true);
    setError(false);
    try {
      const result = await authClient.oauth2.consent({ accept });
      if (result.error) setError(true);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="bg-card text-card-foreground w-full max-w-md space-y-6 rounded-2xl p-6 shadow-2xl">
      <h1 className="text-2xl font-bold">{t("auth.consent.title")}</h1>
      {clientName ? (
        <>
          <p>{t("auth.consent.request", { client: clientName })}</p>
          <ul className="list-inside list-disc">
            {scope
              .split(" ")
              .filter(Boolean)
              .map((item) => (
                <li key={item}>{t(`auth.consent.scopes.${item}`, item)}</li>
              ))}
          </ul>
        </>
      ) : (
        !error && <p>{t("auth.consent.loading")}</p>
      )}
      {error && <p role="alert">{t("auth.consent.error")}</p>}
      <div className="flex gap-3">
        <Button disabled={!clientName || pending} onClick={() => consent(true)}>
          {t("auth.consent.allow")}
        </Button>
        <Button variant="outline" disabled={!clientName || pending} onClick={() => consent(false)}>
          {t("auth.consent.deny")}
        </Button>
      </div>
    </section>
  );
}
