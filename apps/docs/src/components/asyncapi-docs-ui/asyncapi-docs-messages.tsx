import CodeBlock from "@theme/CodeBlock";
import React from "react";
import type { JSX } from "react";

import type { AsyncApiSpec } from "./asyncapi-docs-types";

interface AsyncApiDocsMessagesProps {
  messages?: NonNullable<AsyncApiSpec["components"]>["messages"];
}

export default function AsyncApiDocsMessages({
  messages,
}: AsyncApiDocsMessagesProps): JSX.Element | null {
  if (!messages) return null;

  return (
    <section className="margin-vert--lg">
      <h2 id="messages">Messages</h2>
      {Object.entries(messages).map(([messageName, message]) => {
        return (
          <div key={messageName} className="card margin-bottom--lg">
            <div className="card__header">
              <h3 id={messageName.toLowerCase()}>{message.title || messageName}</h3>
              {message.summary && (
                <p className="text--italic margin-bottom--none">{message.summary}</p>
              )}
            </div>
            <div className="card__body">
              <table className="table--compact margin-bottom--md table">
                <tbody>
                  <tr>
                    <td>
                      <strong>Name</strong>
                    </td>
                    <td>
                      <code>{message.name || messageName}</code>
                    </td>
                  </tr>
                  {message.contentType && (
                    <tr>
                      <td>
                        <strong>Content Type</strong>
                      </td>
                      <td>
                        <code>{message.contentType}</code>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {(message.payload || (message.examples && message.examples.length > 0)) && (
                <div>
                  {message.payload && (
                    <div className="margin-bottom--md">
                      <h4>Payload Schema</h4>
                      <CodeBlock
                        language="json"
                        children={JSON.stringify(message.payload, null, 2)}
                      />
                    </div>
                  )}
                  {message.examples && message.examples.length > 0 && (
                    <div>
                      <h4>Example{message.examples.length > 1 ? "s" : ""}</h4>
                      {message.examples.map((example, index) => (
                        <div key={index} className="margin-bottom--md">
                          <h5>Example {index + 1}</h5>
                          <CodeBlock
                            language="json"
                            children={JSON.stringify(example.payload, null, 2)}
                          />
                        </div>
                      ))}
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
