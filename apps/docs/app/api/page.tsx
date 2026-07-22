import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "API Reference",
  description: "REST (OpenAPI) and MQTT (AsyncAPI) references for openJII.",
};

const cards = [
  {
    href: "/api/rest",
    title: "REST API",
    body: "Browse every endpoint of the openJII REST API, generated from the platform contract.",
  },
  {
    href: "/api/mqtt",
    title: "MQTT API",
    body: "Explore the AWS IoT Core topics and message schemas devices use to publish and receive data.",
  },
];

export default function ApiPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16">
      <h1 className="text-fd-primary text-3xl font-bold">API Reference</h1>
      <p className="text-fd-muted-foreground mt-4 max-w-xl">
        The REST and MQTT references are generated from the platform&apos;s contracts, so they
        always match what the API actually serves.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="hover:border-fd-primary border-fd-border bg-fd-card rounded-lg border p-6 transition-colors"
          >
            <h2 className="text-xl font-semibold">{card.title}</h2>
            <p className="text-fd-muted-foreground mt-2 text-sm">{card.body}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
