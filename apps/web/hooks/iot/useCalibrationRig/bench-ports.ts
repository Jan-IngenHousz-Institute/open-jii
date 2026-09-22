/**
 * Scripted serial ports for the auxiliary instruments of a calibration bench, written against
 * the real instrument classes so a test drives the identity probe rather than a stub of it.
 */
import type { ITransportAdapter } from "@repo/iot";
import {
  KIPRIM_COMMANDS,
  KiprimDcSource,
  MICROPYTHON_COMMANDS,
  MicroPythonParReference,
} from "@repo/iot";

export interface FakePort {
  transport: ITransportAdapter;
  /** Every payload written to the port, in order. */
  sent: string[];
  /** How many times the port was handed back, which a closed port alone does not show. */
  disconnects: number;
  /** Payloads written after the port was handed back, which the real adapter refuses. */
  refused: string[];
  emitStatus(connected: boolean): void;
}

// Read off the instruments so a port cannot answer an identity the registry no longer probes for.
const SUPPLY_IDENTITY = new KiprimDcSource().identityToken;
const REFERENCE_BANNER = `${new MicroPythonParReference().identityToken}; CTRL-B to exit`;

const PROMPT = ">>> ";

const SYNTAX_ERROR = `Traceback (most recent call last):\r\n  File "<stdin>", line 1\r\nSyntaxError: invalid syntax\r\n${PROMPT}`;

const NO_VALUE_LEFT = "NameError: name 'getPAR' isn't defined";

/** The concrete adapters keep one data callback and replace it, so a fake holding several would flatter them. */
function scriptedPort(answer: (payload: string) => string | undefined): FakePort {
  const sent: string[] = [];
  const refused: string[] = [];
  let receive: ((data: string) => void) | undefined;
  let notifyStatus: ((connected: boolean, error?: Error) => void) | undefined;
  let connected = true;
  // Distinct from `connected`: a port that reports itself gone still has a working writer;
  // only handing the port back releases it, as the real adapter does.
  let closed = false;
  let disconnects = 0;

  const transport: ITransportAdapter = {
    isConnected: () => connected,
    send: (data) => {
      if (closed) {
        refused.push(data);
        return Promise.reject(new Error("Writer not initialized"));
      }
      sent.push(data);
      const reply = answer(data);
      if (reply !== undefined) {
        receive?.(reply);
      }
      return Promise.resolve();
    },
    onDataReceived: (callback) => {
      receive = callback;
    },
    onStatusChanged: (callback) => {
      notifyStatus = callback;
    },
    disconnect: () => {
      connected = false;
      closed = true;
      disconnects += 1;
      // The real adapter reports its own close through the callback a pulled cable uses.
      notifyStatus?.(false);
      return Promise.resolve();
    },
  };

  return {
    transport,
    sent,
    refused,
    get disconnects() {
      return disconnects;
    },
    emitStatus: (isConnected) => {
      connected = isConnected;
      notifyStatus?.(isConnected);
    },
  };
}

/** Names itself once and acknowledges nothing else, as the supply's firmware does. */
export function supplyPort(): FakePort {
  return scriptedPort((payload) =>
    payload === KIPRIM_COMMANDS.IDENTIFY ? `${SUPPLY_IDENTITY},dc-source,1.0\r\n` : undefined,
  );
}

/** A prompt handing out `values` one read at a time; a read past the end answers with an error line. */
export function referencePort(values: number[]): FakePort {
  const remaining = [...values];

  return scriptedPort((payload) => {
    if (payload === MICROPYTHON_COMMANDS.ENTER_RAW) {
      return `${REFERENCE_BANNER}\r\n>`;
    }

    if (payload === MICROPYTHON_COMMANDS.LEAVE_RAW_AND_REBOOT) {
      return undefined;
    }

    if (payload === MICROPYTHON_COMMANDS.GET_PAR) {
      const value = remaining.shift();
      return `${payload}\r\n${value ?? NO_VALUE_LEFT}\r\n${PROMPT}`;
    }

    // A prompt errors on the supply's query, so that probe fails on the first line rather than waiting out its timeout.
    return SYNTAX_ERROR;
  });
}

/** One fixed line for anything written: a port on the bench belonging to neither instrument. */
export function unknownPort(banner: string): FakePort {
  return scriptedPort(() => `${banner}\r\n`);
}
