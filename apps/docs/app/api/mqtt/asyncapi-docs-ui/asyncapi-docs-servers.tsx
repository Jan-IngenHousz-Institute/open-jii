import type { AsyncApiSpec } from "./asyncapi-docs-types";

interface AsyncApiDocsServersProps {
  servers: AsyncApiSpec["servers"];
}

export default function AsyncApiDocsServers({ servers }: AsyncApiDocsServersProps) {
  if (!servers) return null;

  return (
    <section className="my-8">
      <h2 id="servers" className="mb-4 text-2xl font-semibold">
        Servers
      </h2>
      {Object.entries(servers).map(([name, server]) => (
        <div key={name} className="border-fd-border bg-fd-card mb-4 rounded-lg border">
          <div className="border-fd-border border-b px-4 py-3">
            <h3 id={name} className="text-lg font-medium">
              {name}
            </h3>
          </div>
          <div className="px-4 py-3">
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-1 pr-4 font-medium">URL</td>
                  <td className="py-1">
                    <code>{server.url}</code>
                  </td>
                </tr>
                <tr>
                  <td className="py-1 pr-4 font-medium">Protocol</td>
                  <td className="py-1">{server.protocol.toUpperCase()}</td>
                </tr>
                {server.description && (
                  <tr>
                    <td className="py-1 pr-4 font-medium">Description</td>
                    <td className="py-1">{server.description}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}
