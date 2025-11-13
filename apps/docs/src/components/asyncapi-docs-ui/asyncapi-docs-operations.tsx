import React from "react";
import type { JSX } from "react";

import type { AsyncApiSpec } from "./asyncapi-docs-types";

interface AsyncApiDocsOperationsProps {
  channels: AsyncApiSpec["channels"];
}

export default function AsyncApiDocsOperations({
  channels,
}: AsyncApiDocsOperationsProps): JSX.Element | null {
  if (!channels) return null;

  return (
    <section className="margin-vert--lg">
      <h2 id="operations">Operations</h2>
      {Object.entries(channels).map(([channelName, channel]) => {
        return (
          <div key={channelName} className="card margin-bottom--lg">
            <div className="card__header">
              <h3>
                {channel.subscribe && (
                  <span className="badge badge--success margin-right--sm">SUBSCRIBE</span>
                )}
                {channel.publish && (
                  <span className="badge badge--danger margin-right--sm">PUBLISH</span>
                )}
                <code>{channelName}</code>
              </h3>
            </div>
            <div className="card__body">
              {channel.description && (
                <div
                  className="margin-bottom--md"
                  dangerouslySetInnerHTML={{
                    __html: channel.description
                      .replace(/<ul>/g, '<ul style="margin: 1rem 0;">')
                      .replace(/<li>/g, '<li style="margin: 0.5rem 0;">'),
                  }}
                />
              )}

              {channel.parameters && (
                <div className="margin-bottom--md">
                  <h4>Parameters</h4>
                  <table className="table--compact table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(channel.parameters).map(([paramName, param]) => {
                        return (
                          <tr key={paramName}>
                            <td>
                              <code>{paramName}</code>
                            </td>
                            <td>
                              <span className="badge badge--secondary">{param.schema.type}</span>
                            </td>
                            <td>{param.description}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {(channel.subscribe || channel.publish) && (
                <div>
                  {channel.subscribe && (
                    <div className="margin-bottom--md">
                      <h4>Subscribe Operation</h4>
                      {channel.subscribe.operationId && (
                        <p>
                          <strong>Operation ID:</strong>{" "}
                          <code>{channel.subscribe.operationId}</code>
                        </p>
                      )}
                      {channel.subscribe.summary && (
                        <p>
                          <strong>Summary:</strong> {channel.subscribe.summary}
                        </p>
                      )}
                    </div>
                  )}
                  {channel.publish && (
                    <div className="margin-bottom--md">
                      <h4>Publish Operation</h4>
                      {channel.publish.operationId && (
                        <p>
                          <strong>Operation ID:</strong> <code>{channel.publish.operationId}</code>
                        </p>
                      )}
                      {channel.publish.summary && (
                        <p>
                          <strong>Summary:</strong> {channel.publish.summary}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
