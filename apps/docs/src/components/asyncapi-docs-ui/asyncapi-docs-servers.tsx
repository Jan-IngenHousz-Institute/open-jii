import React from "react";
import type { JSX } from "react";

import type { AsyncApiSpec } from "./asyncapi-docs-types";

interface AsyncApiDocsServersProps {
  servers: AsyncApiSpec["servers"];
}

export default function AsyncApiDocsServers({
  servers,
}: AsyncApiDocsServersProps): JSX.Element | null {
  if (!servers) return null;

  return (
    <section className="margin-vert--lg">
      <h2 id="servers">Servers</h2>
      {Object.entries(servers).map(([name, server]) => {
        return (
          <div key={name} className="card margin-bottom--md">
            <div className="card__header">
              <h3 id={name}>{name}</h3>
            </div>
            <div className="card__body">
              <table className="table">
                <tbody>
                  <tr>
                    <td>
                      <strong>URL</strong>
                    </td>
                    <td>
                      <code>{server.url}</code>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Protocol</strong>
                    </td>
                    <td>{server.protocol.toUpperCase()}</td>
                  </tr>
                  {server.description && (
                    <tr>
                      <td>
                        <strong>Description</strong>
                      </td>
                      <td>{server.description}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </section>
  );
}
