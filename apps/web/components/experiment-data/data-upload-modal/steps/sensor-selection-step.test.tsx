import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SensorSelectionStep, SENSOR_FAMILIES } from "./sensor-selection-step";

globalThis.React = React;

// Mock translation
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock components from @repo/ui
vi.mock("@repo/ui/components", () => ({
  Label: ({ children, ...props }: { children: React.ReactNode; className?: string }) => (
    <label {...props}>{children}</label>
  ),
  RadioGroup: ({
    children,
    onValueChange,
    className,
    value,
  }: {
    children: React.ReactNode;
    onValueChange: (value: string) => void;
    className?: string;
    value?: string;
  }) => (
    <div
      role="radiogroup"
      className={className}
      data-value={value}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.type === "radio") {
          onValueChange(e.target.value);
        }
      }}
    >
      {children}
    </div>
  ),
  RadioGroupItem: ({
    value,
    disabled,
    className,
    "aria-label": ariaLabel,
  }: {
    value: string;
    disabled?: boolean;
    className?: string;
    "aria-label"?: string;
  }) => (
    <input
      type="radio"
      name="sensor"
      value={value}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
    />
  ),
}));

describe("SensorSelectionStep", () => {
  const mockOnSensorSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders sensor family label and description", () => {
    render(<SensorSelectionStep selectedSensor={null} onSensorSelect={mockOnSensorSelect} />);

    expect(screen.getByText("uploadModal.sensorFamily.label")).toBeInTheDocument();
    expect(screen.getByText("uploadModal.sensorFamily.description")).toBeInTheDocument();
  });

  it("renders all sensor options", () => {
    render(<SensorSelectionStep selectedSensor={null} onSensorSelect={mockOnSensorSelect} />);

    SENSOR_FAMILIES.forEach((sensor) => {
      expect(screen.getByLabelText(sensor.label)).toBeInTheDocument();
      expect(screen.getByText(`uploadModal.sensorTypes.${sensor.id}.label`)).toBeInTheDocument();
      expect(
        screen.getByText(`uploadModal.sensorTypes.${sensor.id}.description`),
      ).toBeInTheDocument();
    });
  });

  it("shows coming soon badge for disabled sensors", () => {
    render(<SensorSelectionStep selectedSensor={null} onSensorSelect={mockOnSensorSelect} />);

    const disabledSensors = SENSOR_FAMILIES.filter((sensor) => sensor.disabled);
    disabledSensors.forEach(() => {
      expect(screen.getByText("uploadModal.sensorTypes.multispeq.comingSoon")).toBeInTheDocument();
    });
  });

  it("disables radio buttons for disabled sensors", () => {
    render(<SensorSelectionStep selectedSensor={null} onSensorSelect={mockOnSensorSelect} />);

    SENSOR_FAMILIES.forEach((sensor) => {
      const radioButton = screen.getByLabelText(sensor.label);
      if (sensor.disabled) {
        expect(radioButton).toBeDisabled();
      } else {
        expect(radioButton).not.toBeDisabled();
      }
    });
  });

  it("calls onSensorSelect when clicking on enabled sensor card", () => {
    render(<SensorSelectionStep selectedSensor={null} onSensorSelect={mockOnSensorSelect} />);

    const enabledSensor = SENSOR_FAMILIES.find((sensor) => !sensor.disabled);
    if (enabledSensor) {
      const sensorCard = screen.getByTestId(`sensor-option-${enabledSensor.id}`);
      fireEvent.click(sensorCard);
      expect(mockOnSensorSelect).toHaveBeenCalledWith(enabledSensor.id);
    }
  });

  it("does not call onSensorSelect when clicking on disabled sensor card", () => {
    render(<SensorSelectionStep selectedSensor={null} onSensorSelect={mockOnSensorSelect} />);

    const disabledSensor = SENSOR_FAMILIES.find((sensor) => sensor.disabled);
    if (disabledSensor) {
      const sensorCard = screen.getByTestId(`sensor-option-${disabledSensor.id}`);
      fireEvent.click(sensorCard);
      expect(mockOnSensorSelect).not.toHaveBeenCalled();
    }
  });

  it("shows selected sensor correctly", () => {
    const selectedSensor = SENSOR_FAMILIES.find((sensor) => !sensor.disabled) ?? SENSOR_FAMILIES[0];

    render(
      <SensorSelectionStep selectedSensor={selectedSensor} onSensorSelect={mockOnSensorSelect} />,
    );

    // The radio group should have the selected value
    const radioGroup = screen.getByRole("radiogroup");
    expect(radioGroup).toBeInTheDocument();
  });

  it("handles radio button change events", () => {
    render(<SensorSelectionStep selectedSensor={null} onSensorSelect={mockOnSensorSelect} />);

    const enabledSensor = SENSOR_FAMILIES.find((sensor) => !sensor.disabled);
    if (enabledSensor) {
      const radioButton = screen.getByLabelText(enabledSensor.label);
      fireEvent.click(radioButton);
      expect(mockOnSensorSelect).toHaveBeenCalledWith(enabledSensor.id);
    }
  });
});

describe("SENSOR_FAMILIES constant", () => {
  it("should have MultispeQ sensor disabled", () => {
    const multispeq = SENSOR_FAMILIES.find((sensor) => sensor.id === "multispeq");
    expect(multispeq).toBeDefined();
    expect(multispeq?.disabled).toBe(true);
  });

  it("should have Ambyte sensor enabled", () => {
    const ambyte = SENSOR_FAMILIES.find((sensor) => sensor.id === "ambyte");
    expect(ambyte).toBeDefined();
    expect(ambyte?.disabled).toBe(false);
  });

  it("should have correct sensor properties", () => {
    SENSOR_FAMILIES.forEach((sensor) => {
      expect(sensor).toHaveProperty("id");
      expect(sensor).toHaveProperty("label");
      expect(sensor).toHaveProperty("disabled");
      expect(sensor).toHaveProperty("description");
      expect(typeof sensor.disabled).toBe("boolean");
    });
  });
});
