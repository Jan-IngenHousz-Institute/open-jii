import { ScrollView, Text, View } from "react-native";

function KeyValue({ name, value }) {
  return (
    <Text>
      {name}: {value}
    </Text>
  );
}

function Chart({ name, values }) {
  return null;
}

export function MeasurementOutputPreview({ output: outputs, timestamp, onClose, experimentName }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: "white" }}>
      {/*<Text>{JSON.stringify(output, null, 2)}</Text>*/}
      {outputs.map((output) =>
        Object.keys(output).map((key) => {
          const value = output[key];
          if (typeof value === "string" || typeof value === "number") {
            return <KeyValue key={key} value={value} name={key} />;
          }
          if (Array.isArray(value) && typeof value[0] === "number") {
            return <Chart name={key} values={value} />;
          }
        }),
      )}
    </ScrollView>
  );
}
