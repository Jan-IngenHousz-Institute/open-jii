import Layout from "@theme/Layout";
import React from "react";

export default function MQTTApiPage(): JSX.Element {
  return (
    <Layout title="MQTT API Documentation">
      <div style={{ width: "100%", height: "800px" }}>
        <iframe
          src="/.asyncapi/index.html"
          title="API Documentation"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            display: "block",
          }}
        />
      </div>
    </Layout>
  );
}
