import React, { useRef, useState } from "react";
import { View, TextInput, StyleSheet, Text, ScrollView, Image } from "react-native";
import WebView from "react-native-webview";
import { Button } from "~/components/Button";
import { pythonSandboxHtml } from "~/services/python/python-sandbox-html";

export default function PythonDemo() {
  const webviewRef = useRef<any>(null);
  const [code, setCode] = useState(`
import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import io
import base64

x = np.linspace(0, 2 * np.pi, 200)
y = np.sin(x)

fig, ax = plt.subplots()
ax.plot(x, y)

buf = io.BytesIO()
fig.savefig(buf, format="png")
plt.close(fig)
buf.seek(0)

base64.b64encode(buf.read()).decode("utf-8")
`);

  const [output, setOutput] = useState("");
  const testPng =
    "iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0dhZglkAAAABJRU5ErkJggg==";

  const executePython = (code) => {
    webviewRef.current?.postMessage(code);
  };

  return (
    <View style={styles.container}>
      <ScrollView>
        <TextInput
          multiline
          value={code}
          onChangeText={setCode}
          style={styles.textArea}
          placeholder="Enter Python code"
        />
        <Button title="Execute" onPress={() => executePython(code)} />
        {/*{output ? (*/}
        {/*  <>*/}
        {/*    <Text style={styles.label}>Output:</Text>*/}
        {/*    <Text style={styles.output}>{output}</Text>*/}
        {/*  </>*/}
        {/*) : null}*/}
        {output && (
          <Image
            // source={{ uri: `data:image/png;base64,${output}` }}
            // source={{
            //   uri: "https://file-examples.com/storage/fe6146b54768752f9a08cf7/2017/10/file_example_PNG_500kB.png",
            // }}
            source={{ uri: `data:image/png;base64,${output}` }}
            style={{
              width: 200,
              height: 200,
              borderWidth: 1,
              borderColor: "red",
            }}
            resizeMode="contain"
            onLoad={() => console.log("loaded")}
            onError={(error) => console.log("error", error)}
          />
        )}
      </ScrollView>
      <WebView
        ref={webviewRef}
        originWhitelist={["*"]}
        source={{ html: pythonSandboxHtml }}
        onMessage={(event) => {
          const message = event.nativeEvent.data;
          // console.log("message", message);
          const cleaned = message
            .replace(/\s/g, "") // remove all whitespace
            .replace(/^"|"$/g, ""); // r
          setOutput(cleaned);
          // if (message.result) {
          //   setOutput(message.result);
          // } else if (message.error) {
          //   setOutput(`❌ ${message.error}`);
          // }
        }}
        style={styles.hiddenWebView}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
  },
  textArea: {
    height: 200,
    borderColor: "#ccc",
    borderWidth: 1,
    padding: 10,
    fontSize: 16,
    marginBottom: 16,
    fontFamily: "monospace",
  },
  label: {
    marginTop: 20,
    fontWeight: "bold",
    fontSize: 16,
  },
  output: {
    backgroundColor: "#f0f0f0",
    padding: 10,
    marginTop: 8,
    fontFamily: "monospace",
  },
  hiddenWebView: {
    width: 0,
    height: 0,
    opacity: 0,
  },
});
