import Link from "next/link";

const tabs = [
  {
    title: "Guide",
    href: "/guide",
    description: "For researchers: go from zero to measuring your plants and viewing your data.",
  },
  {
    title: "Developers",
    href: "/developers",
    description:
      "Architecture, the data pipeline, design decisions, tooling, and how to contribute.",
  },
  {
    title: "API Reference",
    href: "/api",
    description: "The REST (OpenAPI) and MQTT (AsyncAPI) contracts for the platform.",
  },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <h1 className="text-fd-primary text-4xl font-bold sm:text-5xl">openJII Documentation</h1>
      <p className="text-fd-muted-foreground mt-4 max-w-2xl text-lg">
        Open science for photosynthesis research. Measure with your devices, analyze your data, and
        share it openly.
      </p>

      <div className="mt-12 grid w-full max-w-4xl gap-6 sm:grid-cols-3">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="border-fd-border bg-fd-card hover:border-fd-primary flex flex-col rounded-xl border p-6 text-left transition-colors"
          >
            <span className="text-fd-card-foreground text-xl font-semibold">{tab.title}</span>
            <span className="text-fd-muted-foreground mt-2 text-sm">{tab.description}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
