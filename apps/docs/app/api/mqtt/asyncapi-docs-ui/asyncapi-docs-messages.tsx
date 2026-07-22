import type { AsyncApiSpec } from "./asyncapi-docs-types";

interface AsyncApiDocsMessagesProps {
  messages?: NonNullable<AsyncApiSpec["components"]>["messages"];
}

function CodeBlock({ value }: { value: unknown }) {
  return (
    <pre className="border-fd-border bg-fd-secondary overflow-x-auto rounded-lg border p-3 text-xs">
      <code>{JSON.stringify(value, null, 2)}</code>
    </pre>
  );
}

export default function AsyncApiDocsMessages({ messages }: AsyncApiDocsMessagesProps) {
  if (!messages) return null;

  return (
    <section className="my-8">
      <h2 id="messages" className="mb-4 text-2xl font-semibold">
        Messages
      </h2>
      {Object.entries(messages).map(([messageName, message]) => (
        <div key={messageName} className="border-fd-border bg-fd-card mb-6 rounded-lg border">
          <div className="border-fd-border border-b px-4 py-3">
            <h3 id={messageName.toLowerCase()} className="text-lg font-medium">
              {message.title ?? messageName}
            </h3>
            {message.summary && (
              <p className="text-fd-muted-foreground mt-1 text-sm italic">{message.summary}</p>
            )}
          </div>
          <div className="px-4 py-3">
            <table className="mb-4 w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-1 pr-4 font-medium">Name</td>
                  <td className="py-1">
                    <code>{message.name ?? messageName}</code>
                  </td>
                </tr>
                {message.contentType && (
                  <tr>
                    <td className="py-1 pr-4 font-medium">Content Type</td>
                    <td className="py-1">
                      <code>{message.contentType}</code>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {message.payload != null && (
              <div className="mb-4">
                <h4 className="mb-2 font-medium">Payload Schema</h4>
                <CodeBlock value={message.payload} />
              </div>
            )}
            {message.examples && message.examples.length > 0 && (
              <div>
                <h4 className="mb-2 font-medium">
                  Example{message.examples.length > 1 ? "s" : ""}
                </h4>
                {message.examples.map((example, index) => (
                  <div key={index} className="mb-4">
                    <h5 className="mb-1 text-sm font-medium">Example {index + 1}</h5>
                    <CodeBlock value={example.payload} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
