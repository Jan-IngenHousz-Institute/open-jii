import React from "react";
import { Modal } from "react-native";
import { ProcessedMeasurementPreview } from "~/components/measurement-result/components/processed-measurement-preview";
import { RawMeasurementPreview } from "~/components/measurement-result/components/raw-measurement-preview";

interface Props {
  visible: boolean;
  data: any;
  timestamp?: string;
  experimentName?: string;
  onClose: () => void;
}

export function MeasurementModal({ visible, data, timestamp, experimentName, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      {data?.output ? (
        <ProcessedMeasurementPreview
          output={data.output}
          timestamp={timestamp}
          experimentName={experimentName}
          onClose={onClose}
        />
      ) : (
        <RawMeasurementPreview
          data={data}
          timestamp={timestamp}
          experimentName={experimentName}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}
