"use client";

import { Loader2, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useIotBrowserSupport } from "~/hooks/iot/useIotBrowserSupport";
import { useIotCommunication } from "~/hooks/iot/useIotCommunication/useIotCommunication";
import { useIotProtocolExecution } from "~/hooks/iot/useIotProtocolExecution/useIotProtocolExecution";

import type { SensorFamily } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";

import { ConnectionTypeSelector } from "./iot-connection-type-selector";
import { DeviceStatusCard } from "./iot-device-status-card";
import { ProtocolResultsDisplay } from "./iot-protocol-results-display";

interface IotProtocolRunnerProps {
  protocolCode: Record<string, unknown>[];
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

export function IotProtocolRunner({
  protocolCode,
  sensorFamily,
  layout = "horizontal",
}: IotProtocolRunnerProps) {
  const { t } = useTranslation("iot");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(false);
  const [connectionType, setConnectionType] = useState<"bluetooth" | "serial">("bluetooth");
  const browserSupport = useIotBrowserSupport(sensorFamily);

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
  const { executeProtocol } = useIotProtocolExecution(driver, isConnected, sensorFamily);

  // Disconnect when sensor family changes
  useEffect(() => {
    if (isConnected) {
      void disconnect();
      setTestResult(null);
    }
    // Only trigger on sensorFamily change, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensorFamily]);

  const handleRunProtocol = async () => {
    if (!isConnected || isRunningRef.current) return;

    isRunningRef.current = true;
    setIsRunning(true);
    setTestResult(null);
    const startTime = Date.now();

    try {
      const result = await executeProtocol(protocolCode);
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
        error: err instanceof Error ? err.message : "Protocol execution failed",
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
        {/* Left Column - Device & Protocol */}
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

          {/* Run Protocol Button */}
          {isConnected && (
            <Button
              type="button"
              onClick={handleRunProtocol}
              disabled={isRunning}
              size="sm"
              className="w-full"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                  <span className="truncate">{t("iot.protocolRunner.running")}</span>
                </>
              ) : (
                <>
                  <Play className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{t("iot.protocolRunner.runProtocol")}</span>
                </>
              )}
            </Button>
          )}
        </div>

        {/* Right Column - Results */}
        <ProtocolResultsDisplay testResult={testResult} />
      </div>
    </div>
  );
}
