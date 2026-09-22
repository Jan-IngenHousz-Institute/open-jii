"use client";

import { resolveDeviceLabel } from "@/util/device-presentation";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import Link from "next/link";
import type { ReactNode } from "react";

import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import { useTranslation } from "@repo/i18n";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Label } from "@repo/ui/components/label";
import { cn } from "@repo/ui/lib/utils";

/** The minimum a surface must know to render a device. */
export interface DeviceRowDevice {
  id: string;
  name: string | null;
  serialNumber: string;
  deviceType: SensorFamily;
}

interface DeviceIdentityProps {
  device: DeviceRowDevice;
  /** Makes the name a link. Omit on rows whose whole surface is the target. */
  href?: string;
  /** Second line under the name. Off in `compact`, where there is no room. */
  showSerial?: boolean;
  className?: string;
}

/**
 * The identity half of the row grammar, split out so the table density's cells
 * can use it too. Resolution is always the shared presenter, whose precedence
 * is name, then serial, then canonical product name, then a localized
 * unknown-device fallback. Surfaces that shortcut to `name ?? serialNumber`
 * agree with it on the common cases but diverge on blank names and on devices
 * with no serial, which is how one device ends up answering to two labels.
 */
export function DeviceIdentity({ device, href, showSerial, className }: DeviceIdentityProps) {
  const { t } = useTranslation("iot");
  const label = resolveDeviceLabel(device, t);

  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      {href === undefined ? (
        <span className="truncate text-sm font-medium">{label}</span>
      ) : (
        <Link
          href={href}
          onClick={(event) => event.stopPropagation()}
          className="focus-visible:ring-primary/40 focus-visible:outline-hidden truncate text-sm font-medium hover:underline focus-visible:ring-2"
        >
          {label}
        </Link>
      )}
      {showSerial === true && (
        <span className="text-muted-foreground truncate font-mono text-xs">
          {device.serialNumber}
        </span>
      )}
    </div>
  );
}

interface DeviceRowProps {
  device: DeviceRowDevice;
  /** `list` for rosters and summaries, `compact` for pickers and popovers. */
  density?: "list" | "compact";
  href?: string;
  /** Leading checkbox. Omit entirely for a row that is not selectable. */
  selection?: {
    checked: boolean;
    disabled?: boolean;
    onCheckedChange: (checked: boolean) => void;
  };
  /** Status badge, connectivity dot, or whatever states the row's condition. */
  status?: ReactNode;
  /** Right-aligned tail: a reason, a version chip, a menu, an action. */
  trailing?: ReactNode;
  /** Hides the family label where the surface is already single-family. */
  hideFamily?: boolean;
  className?: string;
}

/**
 * One device row, two presentational densities. Fixed anatomy left to right:
 * identity, family, status, actions. Actions are always visible, never
 * revealed on hover.
 *
 * The `table` density is not here: on a table the same anatomy is expressed as
 * cells, so those surfaces compose {@link DeviceIdentity} inside their own
 * columns rather than nesting a flex row inside a `<td>`.
 */
export function DeviceRow({
  device,
  density = "list",
  href,
  selection,
  status,
  trailing,
  hideFamily,
  className,
}: DeviceRowProps) {
  const isCompact = density === "compact";

  const body = (
    <>
      {selection !== undefined && (
        <Checkbox
          checked={selection.checked}
          disabled={selection.disabled}
          onCheckedChange={(checked) => {
            selection.onCheckedChange(checked === true);
          }}
        />
      )}

      <DeviceIdentity
        device={device}
        href={href}
        showSerial={!isCompact}
        className="flex-1 shrink"
      />

      {hideFamily !== true && (
        <span className="text-muted-foreground shrink-0 text-xs">
          {getSensorFamilyLabel(device.deviceType)}
        </span>
      )}
      {status !== undefined && <span className="shrink-0">{status}</span>}
      {trailing !== undefined && <span className="shrink-0">{trailing}</span>}
    </>
  );

  const layout = cn(
    "flex items-center",
    isCompact ? "gap-2 px-2 py-1.5" : "gap-3 px-3 py-2.5",
    className,
  );

  // A selectable row is its own label, so the whole row toggles the checkbox.
  if (selection !== undefined) {
    return (
      <Label className={cn(layout, "hover:bg-muted/30 cursor-pointer font-normal")}>{body}</Label>
    );
  }

  return <div className={layout}>{body}</div>;
}
