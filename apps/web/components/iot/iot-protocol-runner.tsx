"use client";

import { Hand, Loader2, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { RegisterIotDeviceDialog } from "~/components/iot-devices/register-iot-device-dialog";
import { sensorFamilyToDeviceType } from "~/hooks/iot/device-type-mapping";
import { useAutoConnectionType } from "~/hooks/iot/useAutoConnectionType";
import { useIotBrowserSupport } from "~/hooks/iot/useIotBrowserSupport";
import { useIotCommunication } from "~/hooks/iot/useIotCommunication/useIotCommunication";
import { useIotDevices } from "~/hooks/iot/useIotDevices/useIotDevices";
import { useIotProtocolExecution } from "~/hooks/iot/useIotProtocolExecution/useIotProtocolExecution";

import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import { useTranslation } from "@repo/i18n";
import { DEVICE_TRANSPORT_SUPPORT, protocolRequiresInteraction } from "@repo/iot";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

import { ConnectionModule } from "./connection-module";
import { ProtocolResultsDisplay } from "./iot-protocol-results-display";

interface IotProtocolRunnerProps {
  protocolCode: unknown;
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

function isRunnableCode(code: unknown): code is Record<string, unknown>[] {
  return (
    Array.isArray(code) &&
    code.every((item) => typeof item === "object" && item !== null && !Array.isArray(item))
  );
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
  const runnableProtocolCode = isRunnableCode(protocolCode) ? protocolCode : [];

  // The register stitch: hardware just tested here can enter the registry
  // without retyping its serial. Only offered when the serial is readable and
  // matches nothing already registered; a failed registry read hides the
  // stitch rather than guessing.

  // A Bluetooth Classic-only device is BLE-incapable, so Web Bluetooth cannot
  // reach it and the user must be directed to USB/serial. This is derived from
  // the IoT transport capability flags, not a hard-coded family.
  const transportCaps = DEVICE_TRANSPORT_SUPPORT[sensorFamilyToDeviceType(sensorFamily)];
  const bluetoothClassicOnly = transportCaps.supportsBluetoothClassic && !transportCaps.supportsBLE;
  const [registerOpen, setRegisterOpen] = useState(false);

  // Protocols with a physical open/close clamp gate (par_led_start_on_*) pause
  // with the device silent until the user acts; warn so they know to follow the
  // device's prompts rather than assuming it hung. See OJD-1643.
  const requiresInteraction = protocolRequiresInteraction(runnableProtocolCode);

  useAutoConnectionType(browserSupport, setConnectionType);

  const { isConnected, isConnecting, error, deviceInfo, driver, connect, disconnect } =
    useIotCommunication(sensorFamily, connectionType);

  const serialInHand = deviceInfo?.device_id?.trim() ?? "";
  const { data: registeredDevices, isSuccess: registryLoaded } = useIotDevices({
    enabled: isConnected && serialInHand !== "",
  });
  const isUnregistered =
    registryLoaded &&
    serialInHand !== "" &&
    !(registeredDevices ?? []).some((registered) => registered.serialNumber === serialInHand);

  function renderRegisterStitch() {
    if (!isUnregistered) {
      return undefined;
    }
    return (
      <Button
        type="button"
        variant="buttonLink"
        size="sm"
        className="w-full"
        onClick={() => {
          setRegisterOpen(true);
        }}
      >
        {t("iot.protocolRunner.registerDevice")}
      </Button>
    );
  }
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
      const result = await executeProtocol(runnableProtocolCode);
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
          <ConnectionModule
            connectionType={connectionType}
            onConnectionTypeChange={setConnectionType}
            browserSupport={browserSupport}
            bluetoothClassicOnly={bluetoothClassicOnly}
            isConnected={isConnected}
            isConnecting={isConnecting}
            error={error}
            deviceInfo={deviceInfo}
            sensorFamily={sensorFamily}
            onConnect={connect}
            onDisconnect={disconnect}
            registerAction={renderRegisterStitch()}
            action={
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
            }
          />

          {/* Interactive protocols pause for the user to open/close the clamp.
              The device gives no signal while it waits, so prompt the user to
              follow the device rather than assume the run stalled. */}
          {isConnected && requiresInteraction && (
            <div className="bg-muted text-foreground flex items-start gap-2 rounded-lg p-3">
              <Hand className="text-primary mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("iot.protocolRunner.interactionTitle")}</p>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {t("iot.protocolRunner.interactionHint")}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Results */}
        <ProtocolResultsDisplay testResult={testResult} />
      </div>

      <RegisterIotDeviceDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        defaultSerialNumber={serialInHand}
        defaultDeviceType={sensorFamily === "mobile" ? undefined : sensorFamily}
      />
    </div>
  );
}
