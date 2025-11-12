import Layout from "@theme/Layout";
import { load } from "js-yaml";
import React, { useState, useEffect } from "react";
import type { JSX } from "react";

import {
  AsyncApiDocsApiHeader,
  AsyncApiDocsServers,
  AsyncApiDocsSecurity,
  AsyncApiDocsOperations,
  AsyncApiDocsMessages,
  AsyncApiDocsContactLicense,
  type AsyncApiSpec,
} from "../../components/asyncapi-docs-ui";

export default function MQTTApiPage(): JSX.Element {
  const [asyncApiSpec, setAsyncApiSpec] = useState<AsyncApiSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAsyncApiSpec() {
      try {
        // Fetch the AsyncAPI YAML file from the static folder
        const response = await fetch("/api/mqtt/asyncapi.yaml");
        if (!response.ok) {
          throw new Error(`Failed to fetch AsyncAPI spec: ${response.statusText}`);
        }
        const yamlText = await response.text();

        // Parse YAML using js-yaml
        const spec = load(yamlText) as AsyncApiSpec;
        setAsyncApiSpec(spec);
      } catch (err) {
        console.error("Failed to load AsyncAPI specification:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    loadAsyncApiSpec();
  }, []);

  if (loading) {
    return (
      <Layout title="MQTT API Documentation">
        <div className="margin-vert--lg container">
          <div className="text--center">
            <h1>Loading AsyncAPI Documentation...</h1>
            <div className="margin-top--lg">
              <div className="spinner"></div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !asyncApiSpec) {
    return (
      <Layout title="MQTT API Documentation">
        <div className="margin-vert--lg container">
          <div className="alert alert--danger">
            <h1>Failed to Load AsyncAPI Documentation</h1>
            <p>Error: {error || "AsyncAPI specification not found"}</p>
            <p>Please ensure the asyncapi.yaml file is available in the static folder.</p>
          </div>
        </div>
      </Layout>
    );
  }

  const { info, servers, channels, components } = asyncApiSpec;

  return (
    <Layout title={info.title} description={info.description}>
      <div className="margin-vert--lg container">
        <div className="row">
          <div className="col col--12">
            <AsyncApiDocsApiHeader info={info} servers={servers} />
            <AsyncApiDocsServers servers={servers} />
            <AsyncApiDocsSecurity securitySchemes={components?.securitySchemes} />
            <AsyncApiDocsOperations channels={channels} />
            <AsyncApiDocsMessages messages={components?.messages} />
            <AsyncApiDocsContactLicense info={info} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
