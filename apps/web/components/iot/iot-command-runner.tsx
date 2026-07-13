"use client";

import { Hand, Loader2, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useIotBrowserSupport } from "~/hooks/iot/useIotBrowserSupport";
import { useIotCommandExecution } from "~/hooks/iot/useIotCommandExecution/useIotCommandExecution";
import { useIotCommunication } from "~/hooks/iot/useIotCommunication/useIotCommunication";

import type { SensorFamily } from "@repo/api/schemas/command.schema";
import { useTranslation } from "@repo/i18n";
import { commandRequiresInteraction } from "@repo/iot";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

import { CommandResultsDisplay } from "./iot-command-results-display";
import { ConnectionTypeSelector } from "./iot-connection-type-selector";
import { DeviceStatusCard } from "./iot-device-status-card";

interface IotCommandRunnerProps {
  commandCode: Record<string, unknown>[];
  sensorFamily: SensorFamily;
  layout?: "horizontal" | "vertical";
}

interface TestResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTime: number;
  timestamp: Date;
}

export function IotCommandRunner({
  commandCode,
  sensorFamily,
  layout = "horizontal",
}: IotCommandRunnerProps) {
  const { t } = useTranslation("iot");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(false);
  const [connectionType, setConnectionType] = useState<"bluetooth" | "serial">("bluetooth");
  const browserSupport = useIotBrowserSupport(sensorFamily);

  // Commands with a physical open/close clamp gate (par_led_start_on_*) pause
  // with the device silent until the user acts; warn so they know to follow the
  // instrument's prompts rather than assuming it hung. See OJD-1643.
  const requiresInteraction = commandRequiresInteraction(commandCode);

  // Auto-select the first supported connection type
  useEffect(() => {
    if (!browserSupport.bluetooth && browserSupport.serial) {
      setConnectionType("serial");
    } else if (browserSupport.bluetooth && !browserSupport.serial) {
      setConnectionType("bluetooth");
    }
  }, [browserSupport.bluetooth, browserSupport.serial]);

  const { isConnected, isConnecting, error, deviceInfo, driver, connect, disconnect } =
    useIotCommunication(sensorFamily, connectionType);
  const { executeCommandCode } = useIotCommandExecution(driver, isConnected, sensorFamily);

  // Disconnect when sensor family changes
  useEffect(() => {
    if (isConnected) {
      void disconnect();
      setTestResult(null);
    }
    // Only trigger on sensorFamily change, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensorFamily]);

  const handleRunCommand = async () => {
    if (!isConnected || isRunningRef.current) return;

    isRunningRef.current = true;
    setIsRunning(true);
    setTestResult(null);
    const startTime = Date.now();

    try {
      const result = await executeCommandCode(commandCode);
      const executionTime = Date.now() - startTime;

      setTestResult({
        success: true,
        data: result,
        executionTime,
        timestamp: new Date(),
      });
    } catch (err) {
      const executionTime = Date.now() - startTime;
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : "Command execution failed",
        executionTime,
        timestamp: new Date(),
      });
    } finally {
      isRunningRef.current = false;
      setIsRunning(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col gap-4",
          layout === "horizontal" && "md:flex-row md:gap-6",
        )}
      >
        {/* Left Column - Device & Command */}
        <div
          className={cn(
            "w-full min-w-0 space-y-4",
            layout === "horizontal" && "md:w-80 md:space-y-6",
          )}
        >
          {/* Connection Type */}
          {!isConnected && (
            <ConnectionTypeSelector
              connectionType={connectionType}
              onConnectionTypeChange={setConnectionType}
              browserSupport={browserSupport}
            />
          )}

          {/* Device Status */}
          <DeviceStatusCard
            isConnected={isConnected}
            isConnecting={isConnecting}
            error={error}
            deviceInfo={deviceInfo}
            connectionType={connectionType}
            onConnect={connect}
            onDisconnect={disconnect}
          />

          {/* Run Command Button */}
          {isConnected && (
            <Button
              type="button"
              onClick={handleRunCommand}
              disabled={isRunning}
              size="sm"
              className="w-full"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                  <span className="truncate">{t("iot.commandRunner.running")}</span>
                </>
              ) : (
                <>
                  <Play className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{t("iot.commandRunner.runCommand")}</span>
                </>
              )}
            </Button>
          )}

          {/* Interactive commands pause for the user to open/close the clamp.
              The device gives no signal while it waits, so prompt the user to
              follow the instrument rather than assume the run stalled. */}
          {isConnected && requiresInteraction && (
            <div className="bg-muted text-foreground flex items-start gap-2 rounded-lg p-3">
              <Hand className="text-primary mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("iot.commandRunner.interactionTitle")}</p>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {t("iot.commandRunner.interactionHint")}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Results */}
        <CommandResultsDisplay testResult={testResult} />
      </div>
    </div>
  );
}
