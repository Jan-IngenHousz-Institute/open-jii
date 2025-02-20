import Layout from "@theme/Layout";
import React from "react";

export default function RESTApiPage(): JSX.Element {
  return (
    <Layout title="REST API Documentation">
      <div style={{ width: "100%", height: "800px" }}>
        <iframe
          src="/.openapi/index.html"
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
