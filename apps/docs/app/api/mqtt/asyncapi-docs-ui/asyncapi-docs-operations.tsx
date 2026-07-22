import type { AsyncApiSpec } from "./asyncapi-docs-types";

interface AsyncApiDocsOperationsProps {
  channels: AsyncApiSpec["channels"];
}

export default function AsyncApiDocsOperations({ channels }: AsyncApiDocsOperationsProps) {
  if (!channels) return null;

  return (
    <section className="my-8">
      <h2 id="operations" className="mb-4 text-2xl font-semibold">
        Operations
      </h2>
      {Object.entries(channels).map(([channelName, channel]) => (
        <div key={channelName} className="border-fd-border bg-fd-card mb-6 rounded-lg border">
          <div className="border-fd-border flex flex-wrap items-center gap-2 border-b px-4 py-3">
            {channel.subscribe && (
              <span className="bg-fd-primary/10 text-fd-primary rounded px-2 py-0.5 text-xs font-semibold">
                SUBSCRIBE
              </span>
            )}
            {channel.publish && (
              <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
                PUBLISH
              </span>
            )}
            <code className="break-all text-sm">{channelName}</code>
          </div>
          <div className="px-4 py-3">
            {channel.description && (
              <div
                className="text-fd-muted-foreground mb-4 text-sm [&_li]:my-1 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: channel.description }}
              />
            )}

            {channel.parameters && (
              <div className="mb-4">
                <h4 className="mb-2 font-medium">Parameters</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-fd-border border-b text-left">
                      <th className="py-1 pr-4 font-medium">Name</th>
                      <th className="py-1 pr-4 font-medium">Type</th>
                      <th className="py-1 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(channel.parameters).map(([paramName, param]) => (
                      <tr key={paramName} className="border-fd-border/50 border-b">
                        <td className="py-1 pr-4">
                          <code>{paramName}</code>
                        </td>
                        <td className="py-1 pr-4">
                          <span className="bg-fd-accent text-fd-accent-foreground rounded px-1.5 py-0.5 text-xs">
                            {param.schema.type}
                          </span>
                        </td>
                        <td className="text-fd-muted-foreground py-1">{param.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {channel.subscribe && (
              <div className="mb-3 text-sm">
                <h4 className="mb-1 font-medium">Subscribe Operation</h4>
                {channel.subscribe.operationId && (
                  <p>
                    <strong>Operation ID:</strong> <code>{channel.subscribe.operationId}</code>
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
              <div className="mb-3 text-sm">
                <h4 className="mb-1 font-medium">Publish Operation</h4>
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
        </div>
      ))}
    </section>
  );
}
