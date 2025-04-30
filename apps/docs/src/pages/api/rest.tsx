import Head from "@docusaurus/Head";
import Layout from "@theme/Layout";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

import styles from "./api.module.css";

export default function RestApiPage(): JSX.Element {
  return (
    <Layout
      title="REST API Documentation"
      description="OpenJII REST API Documentation"
    >
      <Head>
        <meta name="description" content="OpenJII REST API Documentation" />
      </Head>
      <main className={styles.apiContainer}>
        <div className={styles.apiHeader}>
          <h1>OpenJII REST API Documentation</h1>
          <p>Explore and test the OpenJII REST API endpoints</p>
        </div>
        <div className={styles.apiContent}>
          <SwaggerUI
            url="/api/rest/openapi.json"
            docExpansion="list"
            tryItOutEnabled={false}
            filter={true}
            deepLinking={true}
            persistAuthorization={true}
          />
        </div>
      </main>
    </Layout>
  );
}
