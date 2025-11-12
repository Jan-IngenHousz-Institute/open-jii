import React from "react";
import type { JSX } from "react";

import type { AsyncApiSpec } from "./asyncapi-docs-types";

interface AsyncApiDocsContactLicenseProps {
  info: AsyncApiSpec["info"];
}

export default function AsyncApiDocsContactLicense({
  info,
}: AsyncApiDocsContactLicenseProps): JSX.Element | null {
  if (!info.contact && !info.license) return null;

  return (
    <section className="margin-vert--lg">
      <h2 id="contact--license">Contact & License</h2>
      <div className="alert alert--info">
        {info.contact?.name && (
          <p>
            <strong>Organization:</strong> {info.contact.name}
          </p>
        )}
        {info.contact?.email && (
          <p>
            <strong>Contact:</strong> {info.contact.email}
          </p>
        )}
        {info.license && (
          <p>
            <strong>License:</strong>{" "}
            <a href={info.license.url} target="_blank" rel="noopener noreferrer">
              {info.license.name}
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
