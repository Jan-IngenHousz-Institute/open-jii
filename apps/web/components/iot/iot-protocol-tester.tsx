"use client";

import { Loader2, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useIotProtocolConnection } from "~/hooks/iot/useIotProtocolConnection";

import type { SensorFamily } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components";

import { ConnectionTypeSelector } from "./iot-connection-type-selector";
import { DeviceStatusCard } from "./iot-device-status-card";
import { ProtocolResultsDisplay } from "./iot-protocol-results-display";

interface IotProtocolTesterProps {
  protocolCode: Record<string, unknown>[];
  sensorFamily: SensorFamily;
  protocolName?: string;
}

interface TestResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTime: number;
  timestamp: Date;
}

export function IotProtocolTester({
  protocolCode,
  sensorFamily,
  protocolName: _protocolName,
}: IotProtocolTesterProps) {
  const { t } = useTranslation("iot");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [connectionType, setConnectionType] = useState<"bluetooth" | "serial">("bluetooth");
  const [browserSupport, setBrowserSupport] = useState<{
    bluetooth: boolean;
    serial: boolean;
  }>({ bluetooth: false, serial: false });

  const { isConnected, isConnecting, error, deviceInfo, connect, disconnect, executeProtocol } =
    useIotProtocolConnection(sensorFamily, connectionType);

  // Check browser support for Web Bluetooth and Serial APIs
  useEffect(() => {
    setBrowserSupport({
      bluetooth: typeof navigator !== "undefined" && "bluetooth" in navigator,
      serial: typeof navigator !== "undefined" && "serial" in navigator,
    });
  }, []);

  const handleRunProtocol = async () => {
    if (!isConnected) return;

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
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 md:flex-row">
        {/* Left Column - Device & Protocol */}
        <div className="w-full space-y-6 md:w-80">
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
            <Button onClick={handleRunProtocol} disabled={isRunning} className="w-full">
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("iot.protocolTester.running")}
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  {t("iot.protocolTester.runProtocol")}
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
