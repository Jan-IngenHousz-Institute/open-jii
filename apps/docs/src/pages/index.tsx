import React from "react";
import Layout from "@theme/Layout";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import SearchBar from "@theme/SearchBar";
import styles from "./index.module.css";

function HomepageHeader(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={styles.hero}>
      <div className={styles.container}>
        <div className={styles.searchContainer}>
          <SearchBar />
        </div>
      </div>
    </header>
  );
}

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description="Your site description">
      <HomepageHeader />
      <main>{/* Other homepage content */}</main>
    </Layout>
  );
}
