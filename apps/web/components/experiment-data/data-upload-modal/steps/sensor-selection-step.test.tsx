import { render, screen, userEvent } from "@/test/test-utils";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SensorSelectionStep, SENSOR_FAMILIES } from "./sensor-selection-step";

globalThis.React = React;

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

  it("calls onSensorSelect when clicking on enabled sensor card", async () => {
    const user = userEvent.setup();
    render(<SensorSelectionStep selectedSensor={null} onSensorSelect={mockOnSensorSelect} />);

    const enabledSensor = SENSOR_FAMILIES.find((sensor) => !sensor.disabled);
    if (enabledSensor) {
      const sensorCard = screen.getByTestId(`sensor-option-${enabledSensor.id}`);
      await user.click(sensorCard);
      expect(mockOnSensorSelect).toHaveBeenCalledWith(enabledSensor.id);
    }
  });

  it("does not call onSensorSelect when clicking on disabled sensor card", async () => {
    const user = userEvent.setup();
    render(<SensorSelectionStep selectedSensor={null} onSensorSelect={mockOnSensorSelect} />);

    const disabledSensor = SENSOR_FAMILIES.find((sensor) => sensor.disabled);
    if (disabledSensor) {
      const sensorCard = screen.getByTestId(`sensor-option-${disabledSensor.id}`);
      await user.click(sensorCard);
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

  it("handles radio button change events", async () => {
    const user = userEvent.setup();
    render(<SensorSelectionStep selectedSensor={null} onSensorSelect={mockOnSensorSelect} />);

    const enabledSensor = SENSOR_FAMILIES.find((sensor) => !sensor.disabled);
    if (enabledSensor) {
      const radioButton = screen.getByLabelText(enabledSensor.label);
      await user.click(radioButton);
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
