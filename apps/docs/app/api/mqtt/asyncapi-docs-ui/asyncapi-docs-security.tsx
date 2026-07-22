import type { AsyncApiSpec } from "./asyncapi-docs-types";

interface AsyncApiDocsSecurityProps {
  securitySchemes?: NonNullable<AsyncApiSpec["components"]>["securitySchemes"];
}

export default function AsyncApiDocsSecurity({ securitySchemes }: AsyncApiDocsSecurityProps) {
  if (!securitySchemes) return null;

  return (
    <section className="my-8">
      <h2 id="security" className="mb-4 text-2xl font-semibold">
        Security
      </h2>
      {Object.entries(securitySchemes).map(([name, scheme]) => (
        <div
          key={name}
          className="border-fd-border bg-fd-card mb-4 rounded-lg border px-4 py-3 text-sm"
        >
          <h3 id={name} className="mb-2 text-lg font-medium">
            {name}
          </h3>
          <p>
            <strong>Type:</strong> {scheme.type}
          </p>
          {scheme.in && (
            <p>
              <strong>Location:</strong> {scheme.in}
            </p>
          )}
          {scheme.description && (
            <p className="text-fd-muted-foreground mt-1">{scheme.description}</p>
          )}
        </div>
      ))}
    </section>
  );
}
