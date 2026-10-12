import { useCallback, useEffect, useRef, useState } from "react";

// A chart still downloading its trace family gives up its turn after this, so it cannot hold back
// the charts behind it.
const TURN_TIMEOUT_MS = 1_000;

/** One chart's place in the queue. */
export interface DrawTurn {
  grant: () => void;
}

/**
 * Hands out first draws one at a time, each in a task of its own. Plotly draws a new chart
 * synchronously, so a dashboard revealing many charts in one commit blocked the page for as long as
 * all of them took together.
 */
export class DrawQueue {
  private readonly waiting: DrawTurn[] = [];
  private holder: DrawTurn | undefined;
  private turnTimer: ReturnType<typeof setTimeout> | undefined;

  /** Queues a first draw; `grant` runs when it is this chart's turn. */
  request(grant: () => void): DrawTurn {
    const turn: DrawTurn = { grant };
    this.waiting.push(turn);
    this.grantNext();
    return turn;
  }

  /** The chart has drawn or failed: if it held the turn, the next chart draws in a later task. */
  release(turn: DrawTurn): void {
    if (this.holder !== turn) {
      return;
    }
    clearTimeout(this.turnTimer);
    this.holder = undefined;
    setTimeout(() => this.grantNext(), 0);
  }

  /** Takes an unmounted chart out of the queue, handing on its turn if it held one. */
  leave(turn: DrawTurn): void {
    const index = this.waiting.indexOf(turn);
    if (index !== -1) {
      this.waiting.splice(index, 1);
    }
    this.release(turn);
  }

  private grantNext(): void {
    if (this.holder) {
      return;
    }
    const turn = this.waiting.shift();
    if (!turn) {
      return;
    }
    this.holder = turn;
    this.turnTimer = setTimeout(() => this.release(turn), TURN_TIMEOUT_MS);
    turn.grant();
  }
}

const drawQueue = new DrawQueue();

/**
 * Whether this chart may make its first draw yet, and the call that says it has. It joins the queue
 * once it is ready to draw, so a chart showing an error or its own loading state holds no turn.
 */
export function useDrawTurn(
  isReady: boolean,
  queue: DrawQueue = drawQueue,
): {
  hasTurn: boolean;
  onDrawn: () => void;
} {
  const [hasTurn, setHasTurn] = useState(false);
  const turnRef = useRef<DrawTurn | undefined>(undefined);

  useEffect(() => {
    if (isReady && !turnRef.current) {
      turnRef.current = queue.request(() => setHasTurn(true));
    }
  }, [isReady, queue]);

  // Only on unmount: a granted turn must stay held until the chart has drawn.
  useEffect(() => {
    const slot = turnRef;
    return () => {
      if (slot.current) {
        queue.leave(slot.current);
        slot.current = undefined;
      }
    };
  }, [queue]);

  const onDrawn = useCallback(() => {
    if (turnRef.current) {
      queue.release(turnRef.current);
    }
  }, [queue]);

  return { hasTurn, onDrawn };
}
