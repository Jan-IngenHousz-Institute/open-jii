/** A shared answer, and when the check that gave it began. */
export interface RecentAnswer {
  isTrue: boolean;
  askedAt: number;
}

interface RecentCheck {
  askedAt: number;
  answer: Promise<boolean>;
}

/**
 * Gives every caller that asks the same question within the window the answer the first one got,
 * so the many streams of one reader cost one check. A check that fails is asked again.
 */
export class RecentChecks {
  private readonly checks = new Map<string, RecentCheck>();

  constructor(private readonly windowMs: number) {}

  async ask(key: string, check: () => Promise<boolean>): Promise<RecentAnswer> {
    this.forgetExpired();

    const recent = this.checks.get(key) ?? this.start(key, check);
    return { isTrue: await recent.answer, askedAt: recent.askedAt };
  }

  private start(key: string, check: () => Promise<boolean>): RecentCheck {
    const asked: RecentCheck = { askedAt: Date.now(), answer: check() };
    this.checks.set(key, asked);
    asked.answer.catch(() => {
      if (this.checks.get(key) === asked) {
        this.checks.delete(key);
      }
    });
    return asked;
  }

  private forgetExpired(): void {
    const now = Date.now();
    for (const [key, { askedAt }] of this.checks) {
      if (now - askedAt >= this.windowMs) {
        this.checks.delete(key);
      }
    }
  }
}
