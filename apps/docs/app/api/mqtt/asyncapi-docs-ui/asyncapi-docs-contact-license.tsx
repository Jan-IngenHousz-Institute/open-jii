import type { AsyncApiSpec } from "./asyncapi-docs-types";

interface AsyncApiDocsContactLicenseProps {
  info: AsyncApiSpec["info"];
}

export default function AsyncApiDocsContactLicense({ info }: AsyncApiDocsContactLicenseProps) {
  if (!info.contact && !info.license) return null;

  return (
    <section className="my-8">
      <h2 id="contact--license" className="mb-4 text-2xl font-semibold">
        Contact &amp; License
      </h2>
      <div className="border-fd-border bg-fd-card rounded-lg border px-4 py-3 text-sm">
        {info.contact?.name && (
          <p>
            <strong>Organization:</strong> {info.contact.name}
          </p>
        )}
        {info.contact?.email && (
          <p>
            <strong>Contact:</strong> {info.contact.email}
          </p>
        )}
        {info.license && (
          <p>
            <strong>License:</strong>{" "}
            <a
              href={info.license.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-fd-primary underline"
            >
              {info.license.name}
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
