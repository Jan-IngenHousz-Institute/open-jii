import { Redirect } from "@docusaurus/router";
//import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
//import Layout from "@theme/Layout";
// import SearchBar from "@theme/SearchBar";
import React from "react";

//import styles from "./index.module.css";

// function HomepageHeader(): JSX.Element {
//   const { siteConfig } = useDocusaurusContext();
//   return (
//     <header className={styles.hero}>
//       <div className={styles.container}>
//         {/*<div className={styles.searchContainer}>*/}
//         {/*  <SearchBar />*/}
//         {/*</div>*/}
//       </div>
//     </header>
//   );
// }

// export default function Home(): JSX.Element {
//   const { siteConfig } = useDocusaurusContext();
//   return (
//     <Layout title={siteConfig.title} description="Your site description">
//       <HomepageHeader />
//       <main>{/* Other homepage content */}</main>
//     </Layout>
//   );
// }
export default function HomeRedirect() {
  return <Redirect to="/docs/introduction/overview" />;
}
