/**
 * The webhook address in the secret's text. It has to be https and carry no user name or password,
 * because `fetch` names the whole address in the error it throws for one, and that error is logged.
 * The message never quotes the secret.
 */
export function webhookUrlOf(secret: string | undefined): string {
  const candidate = secret?.trim() ?? "";
  const url = URL.canParse(candidate) ? new URL(candidate) : undefined;
  const isUsable = url?.protocol === "https:" && url.username === "" && url.password === "";

  if (!isUsable) {
    throw new Error("The Slack webhook secret does not hold an https address without credentials");
  }

  return candidate;
}

/**
 * Event ids one function instance posted, oldest first and capped. The publisher can send an event
 * again and SNS can deliver one twice, so a repeat on a warm instance is skipped. A cold instance
 * starts empty, so this is best effort.
 */
export class PostedIds {
  private readonly ids = new Set<string>();

  constructor(private readonly limit: number) {}

  has(id: string): boolean {
    return this.ids.has(id);
  }

  remember(id: string): void {
    this.ids.add(id);

    if (this.ids.size > this.limit) {
      const [oldest] = this.ids;
      this.ids.delete(oldest);
    }
  }
}
