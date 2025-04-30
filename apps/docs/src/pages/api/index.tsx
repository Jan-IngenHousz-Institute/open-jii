import Head from "@docusaurus/Head";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import React from "react";

import styles from "./api.module.css";

export default function ApiIndexPage(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();

  return (
    <Layout
      title="API Documentation"
      description="OpenJII API Documentation Hub"
    >
      <Head>
        <meta name="description" content="OpenJII API Documentation Hub" />
      </Head>
      <main className={styles.apiContainer}>
        <div className={styles.apiHeader}>
          <h1>OpenJII API Documentation</h1>
          <p>Explore and test the OpenJII platform APIs</p>
        </div>

        <div className={styles.apiCardContainer}>
          <div className={styles.apiCard}>
            <h2>REST API</h2>
            <p>
              Browse and test our RESTful API endpoints using OpenAPI/Swagger UI
            </p>
            <Link to="/api/rest" className={styles.apiCardButton}>
              View REST API Docs
            </Link>
          </div>

          <div className={styles.apiCard}>
            <h2>MQTT API</h2>
            <p>
              Explore our MQTT API for real-time communication and device
              management
            </p>
            <Link to="/api/mqtt" className={styles.apiCardButton}>
              View MQTT API Docs
            </Link>
          </div>
        </div>
      </main>
    </Layout>
  );
}
