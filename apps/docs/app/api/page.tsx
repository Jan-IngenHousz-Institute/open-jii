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
    body: "Every endpoint of the openJII REST API, generated from the platform contract.",
    linkText: "Browse endpoints",
  },
  {
    href: "/api/mqtt",
    title: "MQTT API",
    body: "The AWS IoT Core topics and message schemas devices use to publish and receive data.",
    linkText: "Browse topics",
  },
];

export default function ApiPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-4 py-20 text-center">
      <h1 className="text-fd-foreground text-4xl font-bold sm:text-5xl">API Reference</h1>
      <p className="text-fd-muted-foreground mt-4 max-w-2xl text-lg">
        The REST and MQTT references are generated from the platform&apos;s contracts at build time,
        so they always match what the API actually serves.
      </p>

      <div className="mt-12 grid w-full gap-6 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="border-fd-border bg-fd-card hover:border-fd-primary group flex flex-col rounded-xl border p-6 text-left transition-colors"
          >
            <span className="text-fd-card-foreground text-xl font-semibold">{card.title}</span>
            <span className="text-fd-muted-foreground mt-2 flex-1 text-sm">{card.body}</span>
            <span className="text-fd-primary mt-4 text-sm font-medium group-hover:underline">
              {card.linkText} →
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
