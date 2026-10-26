import type {
  EndedSession,
  SessionSkip,
} from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";

import type { PlotMark } from "../plot-state";
import type { FieldPlan } from "./field-plan";

/** One measurer's ended session, counted against their assignment. */
export interface SessionTally {
  session: EndedSession;
  measured: number;
  skips: SessionSkip[];
  repeatUnitIds: string[];
  outsideShareUnitIds: string[];
  flaggedUnitIds: string[];
  failedUploadUnitIds: string[];
}

/** What every session that ended on one day measured, as uploaded so far. */
export class SessionDay {
  readonly tallies: readonly SessionTally[];
  readonly measured: ReadonlySet<string>;

  constructor(
    private readonly plan: FieldPlan,
    readonly sessions: readonly EndedSession[],
  ) {
    const read = new Set(
      sessions.flatMap((session) => session.readings.map((reading) => reading.unitId)),
    );
    this.measured = new Set(plan.plots.filter((plot) => read.has(plot.id)).map((plot) => plot.id));
    this.tallies = sessions.map((session) => SessionDay.tally(session));
  }

  get readingCount(): number {
    return this.sessions.reduce((sum, session) => sum + session.readings.length, 0);
  }

  get phoneCount(): number {
    return new Set(this.sessions.map((session) => session.phone)).size;
  }

  get isAllUploaded(): boolean {
    return this.sessions.every((session) => session.isUploaded);
  }

  get waitingCount(): number {
    return this.sessions.filter((session) => !session.isUploaded).length;
  }

  /** Skipped plots nobody measured later the same day. */
  get skippedUnitIds(): string[] {
    const skipped = this.sessions.flatMap((session) => session.skips.map((skip) => skip.unitId));
    return [...new Set(skipped)].filter((unitId) => !this.measured.has(unitId));
  }

  get repeatCount(): number {
    return this.tallies.reduce((sum, tally) => sum + tally.repeatUnitIds.length, 0);
  }

  get outsideShareUnitIds(): string[] {
    return this.tallies.flatMap((tally) => tally.outsideShareUnitIds);
  }

  get flaggedUnitIds(): string[] {
    return [...new Set(this.tallies.flatMap((tally) => tally.flaggedUnitIds))];
  }

  /** Plots whose reading never arrived, unless another reading of them did. */
  get failedUploadUnitIds(): string[] {
    const failed = this.sessions.flatMap((session) => session.failedUploadUnitIds);
    return [...new Set(failed)].filter((unitId) => !this.measured.has(unitId));
  }

  /** Plots read in more than one session without a repeat asked for. */
  get measuredTwiceUnitIds(): string[] {
    const sessionsByPlot = new Map<string, number>();
    for (const session of this.sessions) {
      const read = new Set(
        session.readings.filter((reading) => !reading.isRepeat).map((reading) => reading.unitId),
      );
      for (const unitId of read) {
        sessionsByPlot.set(unitId, (sessionsByPlot.get(unitId) ?? 0) + 1);
      }
    }
    return [...sessionsByPlot].filter(([, count]) => count > 1).map(([unitId]) => unitId);
  }

  /** The glyph the field map shows on a plot, the most urgent state first. */
  markOf(unitId: string): PlotMark | undefined {
    if (this.measuredTwiceUnitIds.includes(unitId)) {
      return "measuredTwice";
    }
    if (this.flaggedUnitIds.includes(unitId)) {
      return "flagged";
    }
    if (this.outsideShareUnitIds.includes(unitId)) {
      return "outsideShare";
    }
    if (this.skippedUnitIds.includes(unitId)) {
      return "skipped";
    }
    if (this.measured.has(unitId)) {
      return "measured";
    }
    return this.failedUploadUnitIds.includes(unitId) ? "uploadFailed" : undefined;
  }

  /** Plots of each treatment nobody measured, in the field's treatment order. */
  missingByTreatment(): Map<string, string[]> {
    const missing = new Map<string, string[]>(
      this.plan.treatments.map((treatment) => [treatment, []]),
    );
    for (const plot of this.plan.plots) {
      const treatment = this.plan.treatmentOf(plot.id);
      if (treatment !== null && !this.measured.has(plot.id)) {
        missing.get(treatment)?.push(plot.id);
      }
    }
    return missing;
  }

  private static tally(session: EndedSession): SessionTally {
    const assigned = new Set(session.assignedUnitIds);
    const inShare = session.readings.filter((reading) => assigned.has(reading.unitId));

    return {
      session,
      measured: new Set(inShare.map((reading) => reading.unitId)).size,
      skips: session.skips,
      repeatUnitIds: session.readings
        .filter((reading) => reading.isRepeat)
        .map((reading) => reading.unitId),
      outsideShareUnitIds: session.readings
        .filter((reading) => !assigned.has(reading.unitId))
        .map((reading) => reading.unitId),
      flaggedUnitIds: session.readings
        .filter((reading) => reading.isFlagged)
        .map((reading) => reading.unitId),
      failedUploadUnitIds: session.failedUploadUnitIds,
    };
  }
}
