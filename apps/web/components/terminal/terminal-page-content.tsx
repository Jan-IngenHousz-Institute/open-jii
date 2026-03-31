"use client";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { Circle, Unplug, Usb } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { MULTISPEQ_CONSOLE, MULTISPEQ_SERIAL_DEFAULTS } from "@repo/iot";
import { WebSerialAdapter } from "@repo/iot/transport/web";
import { Button } from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";

export function TerminalPageContent() {
  const termRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const adapterRef = useRef<WebSerialAdapter | null>(null);
  const inputBufferRef = useRef("");
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });

  const writeSystem = useCallback((msg: string) => {
    const term = xtermRef.current;
    if (!term) return;
    const currentInput = inputBufferRef.current;
    term.write("\r\x1b[K");
    term.writeln(`\x1b[90m${formatTime(new Date())}\x1b[0m \x1b[33mSYS  \x1b[90m${msg}\x1b[0m`);
    term.write("$ " + currentInput);
  }, []);

  const writeReceived = useCallback((data: string) => {
    const term = xtermRef.current;
    if (!term) return;
    const currentInput = inputBufferRef.current;
    term.write("\r\x1b[K");
    term.writeln(`\x1b[90m${formatTime(new Date())}\x1b[0m \x1b[32mRX < \x1b[0m${data}\x1b[0m`);
    term.write("$ " + currentInput);
  }, []);

  const writeSent = useCallback((data: string) => {
    const term = xtermRef.current;
    if (!term) return;
    const currentInput = inputBufferRef.current;
    term.write("\r\x1b[K");
    term.writeln(`\x1b[90m${formatTime(new Date())}\x1b[0m \x1b[34mTX > \x1b[36m${data}\x1b[0m`);
    term.write("$ " + currentInput);
  }, []);

  // Initialize xterm
  useEffect(() => {
    if (!termRef.current) return;

    const fitAddon = new FitAddon();
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      theme: {
        background: "#ffffff",
        foreground: "#1a1a1a",
        cursor: "#1a1a1a",
        selectionBackground: "#d0d0d0",
        black: "#1a1a1a",
        red: "#d32f2f",
        green: "#2e7d32",
        yellow: "#f57f17",
        blue: "#1565c0",
        magenta: "#7b1fa2",
        cyan: "#00838f",
        white: "#ffffff",
      },
      convertEol: true,
      disableStdin: false,
    });

    term.loadAddon(fitAddon);
    term.open(termRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln("\x1b[36mSerial Terminal\x1b[0m");
    term.writeln(
      "\x1b[90mConnect a device using the button above, then type commands below.\x1b[0m",
    );
    term.writeln("");
    term.write("$ ");

    // Handle keyboard input
    inputBufferRef.current = "";
    const replaceInput = (newValue: string) => {
      // Clear current input on the line, then write the new value
      const current = inputBufferRef.current;
      term.write(
        "\b".repeat(current.length) + " ".repeat(current.length) + "\b".repeat(current.length),
      );
      inputBufferRef.current = newValue;
      term.write(newValue);
    };

    term.onData((data) => {
      if (data === "\r") {
        term.writeln("");
        const cmd = inputBufferRef.current.trim();
        if (cmd) {
          historyRef.current.push(cmd);
        }
        if (cmd === "clear") {
          term.reset();
          term.write("$ ");
          inputBufferRef.current = "";
          historyIndexRef.current = -1;
          return;
        } else if (cmd === "cancel") {
          const adapter = adapterRef.current;
          if (adapter) {
            void adapter.send(MULTISPEQ_CONSOLE.CANCEL + "\r\n").then(() => {
              writeSent(MULTISPEQ_CONSOLE.CANCEL);
            });
          } else {
            term.writeln("\x1b[31mNot connected.\x1b[0m");
          }
        } else if (cmd) {
          const adapter = adapterRef.current;
          if (adapter) {
            void adapter.send(cmd + "\r\n").then(() => {
              writeSent(cmd);
            });
          } else {
            term.writeln("\x1b[31mNot connected.\x1b[0m");
          }
        }
        inputBufferRef.current = "";
        historyIndexRef.current = -1;
        term.write("$ ");
      } else if (data === "\x1b[A") {
        // Arrow up
        const history = historyRef.current;
        if (history.length === 0) return;
        if (historyIndexRef.current === -1) {
          historyIndexRef.current = history.length - 1;
        } else if (historyIndexRef.current > 0) {
          historyIndexRef.current--;
        }
        replaceInput(history[historyIndexRef.current]);
      } else if (data === "\x1b[B") {
        // Arrow down
        const history = historyRef.current;
        if (historyIndexRef.current === -1) return;
        if (historyIndexRef.current < history.length - 1) {
          historyIndexRef.current++;
          replaceInput(history[historyIndexRef.current]);
        } else {
          historyIndexRef.current = -1;
          replaceInput("");
        }
      } else if (data === "\x7f" || data === "\b") {
        if (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          term.write("\b \b");
        }
      } else if (data >= " ") {
        inputBufferRef.current += data;
        term.write(data);
      }
    });

    const handleResize = () => fitAddon.fit();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async () => {
    if (!WebSerialAdapter.isSupported()) {
      writeSystem("Web Serial API not supported in this browser.");
      return;
    }

    setIsConnecting(true);
    try {
      const adapter = await WebSerialAdapter.requestAndConnect(MULTISPEQ_SERIAL_DEFAULTS);

      adapter.onDataReceived((data) => {
        writeReceived(data);
      });

      adapter.onStatusChanged((connected, error) => {
        if (!connected) {
          setIsConnected(false);
          adapterRef.current = null;
          writeSystem(error ? `Disconnected: ${error.message}` : "Disconnected.");
        }
      });

      adapterRef.current = adapter;
      setIsConnected(true);
      writeSystem("Connected.");
    } catch (err) {
      writeSystem(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (adapterRef.current) {
      await adapterRef.current.disconnect();
      adapterRef.current = null;
      setIsConnected(false);
      writeSystem("Disconnected.");
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      adapterRef.current
        ?.disconnect()
        .catch((err: unknown) => console.error("Terminal cleanup error:", err));
    };
  }, []);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Serial Terminal</h1>
          <p className="text-muted-foreground text-sm">
            Raw serial communication with connected devices
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <Circle
              className={cn(
                "h-2 w-2 fill-current",
                isConnected ? "text-green-500" : "text-muted-foreground",
              )}
            />
            <span className="text-muted-foreground">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          {!isConnected ? (
            <Button size="sm" onClick={handleConnect} disabled={isConnecting}>
              <Usb className="mr-1.5 h-3.5 w-3.5" />
              {isConnecting ? "Connecting…" : "Connect"}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleDisconnect}>
              <Unplug className="mr-1.5 h-3.5 w-3.5" />
              Disconnect
            </Button>
          )}
        </div>
      </div>

      <div ref={termRef} className="min-h-0 flex-1" />
    </div>
  );
}
