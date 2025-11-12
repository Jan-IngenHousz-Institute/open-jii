import React from "react";
import type { JSX } from "react";

import type { AsyncApiSpec } from "./asyncapi-docs-types";

interface AsyncApiDocsApiHeaderProps {
  info: AsyncApiSpec["info"];
  servers?: AsyncApiSpec["servers"];
}

export default function AsyncApiDocsApiHeader({
  info,
  servers,
}: AsyncApiDocsApiHeaderProps): JSX.Element {
  return (
    <>
      {/* Header */}
      <h1>{info.title}</h1>

      <div className="margin-bottom--md">
        <span className="badge badge--success badge--lg">v{info.version}</span>
        {servers && Object.keys(servers).length > 0 && (
          <span className="badge badge--info badge--lg margin-left--sm">
            {(Object.values(servers)[0] as AsyncApiSpec["servers"][string]).protocol.toUpperCase()}
          </span>
        )}
      </div>

      {/* API Information */}
      <div className="alert alert--info">
        <strong>API Information:</strong> {info.description}
      </div>
    </>
  );
}
