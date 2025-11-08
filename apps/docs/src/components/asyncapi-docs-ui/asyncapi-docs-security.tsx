import React from "react";
import type { JSX } from "react";

import type { AsyncApiSpec } from "./asyncapi-docs-types";

interface AsyncApiDocsSecurityProps {
  securitySchemes?: NonNullable<AsyncApiSpec["components"]>["securitySchemes"];
}

export default function AsyncApiDocsSecurity({
  securitySchemes,
}: AsyncApiDocsSecurityProps): JSX.Element | null {
  if (!securitySchemes) return null;

  return (
    <section className="margin-vert--lg">
      <h2 id="security">Security</h2>
      {Object.entries(securitySchemes).map(([name, scheme]) => {
        return (
          <div key={name} className="alert alert--warning">
            <h3 id={name}>{name}</h3>
            <p>
              <strong>Type:</strong> {scheme.type}
            </p>
            {scheme.in && (
              <p>
                <strong>Location:</strong> {scheme.in}
              </p>
            )}
            {scheme.description && <p>{scheme.description}</p>}
          </div>
        );
      })}
    </section>
  );
}
