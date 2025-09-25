import React from "react";
import { Modal } from "react-native";
import { MeasurementJsonPreview } from "~/components/measurement-result/components/measurement-json-preview";
import { MeasurementOutputPreview } from "~/components/measurement-result/components/measurement-output-preview";

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
        <MeasurementOutputPreview
          output={data.output}
          timestamp={timestamp}
          experimentName={experimentName}
          onClose={onClose}
        />
      ) : (
        <MeasurementJsonPreview
          data={data}
          timestamp={timestamp}
          experimentName={experimentName}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}
