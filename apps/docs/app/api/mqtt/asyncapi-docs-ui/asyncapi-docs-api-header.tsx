import type { AsyncApiSpec } from "./asyncapi-docs-types";

interface AsyncApiDocsApiHeaderProps {
  info: AsyncApiSpec["info"];
  servers?: AsyncApiSpec["servers"];
}

export default function AsyncApiDocsApiHeader({ info, servers }: AsyncApiDocsApiHeaderProps) {
  const protocol =
    servers && Object.keys(servers).length > 0
      ? Object.values(servers)[0]?.protocol.toUpperCase()
      : undefined;

  return (
    <>
      <h1 className="mb-4 text-3xl font-bold">{info.title}</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        <span className="bg-fd-primary/10 text-fd-primary rounded px-2 py-1 text-sm font-medium">
          v{info.version}
        </span>
        {protocol && (
          <span className="bg-fd-accent text-fd-accent-foreground rounded px-2 py-1 text-sm font-medium">
            {protocol}
          </span>
        )}
      </div>

      <div className="border-fd-border bg-fd-card text-fd-muted-foreground mb-8 rounded-lg border p-4">
        <strong className="text-fd-foreground">API Information:</strong> {info.description}
      </div>
    </>
  );
}
