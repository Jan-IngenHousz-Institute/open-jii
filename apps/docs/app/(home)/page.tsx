import { GITHUB_URL, PLATFORM_URL } from "@/lib/layout.shared";
import Image from "next/image";
import Link from "next/link";

const sections = [
  {
    title: "Researcher Guide",
    href: "/guide",
    description:
      "Create an account, set up an experiment, measure with your MultispeQ, and view, export, and share your data.",
    linkText: "Read the guide",
  },
  {
    title: "Developers",
    href: "/developers",
    description:
      "System architecture, the data pipeline, design decisions (ADRs), the MultispeQ MQTT tool, and how to contribute.",
    linkText: "Explore internals",
  },
  {
    title: "API Reference",
    href: "/api",
    description:
      "The generated REST (OpenAPI) and MQTT (AsyncAPI) contracts, always in sync with the platform code.",
    linkText: "Browse the APIs",
  },
];

const highlights = [
  {
    title: "Measure",
    description:
      "Handheld MultispeQ readings through the offline-first mobile app, plus continuous Ambyte sensor ingestion.",
  },
  {
    title: "Analyze",
    description:
      "Experiment data lands in searchable tables with built-in visualizations, five export formats, and macro-based analysis.",
  },
  {
    title: "Share",
    description:
      "Invite collaborators with clear roles, keep data private under embargo, and publish it openly when you are ready.",
  },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-16">
      <Image
        src="/img/openjii-logo-horizontal.svg"
        alt="openJII"
        width={171}
        height={80}
        className="block dark:hidden"
        priority
      />
      <Image
        src="/img/openjii-logo-horizontal-dark.svg"
        alt="openJII"
        width={171}
        height={80}
        className="hidden dark:block"
        priority
      />
      <h1 className="text-fd-foreground mt-8 max-w-3xl text-center text-4xl font-bold sm:text-5xl">
        Open science for photosynthesis research
      </h1>
      <p className="text-fd-muted-foreground mt-4 max-w-2xl text-center text-lg">
        openJII connects your devices, experiments, and data in one open platform. These docs take
        you from your first measurement to shared, analysis-ready datasets.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/guide/get-started/quick-start"
          className="bg-fd-primary text-fd-primary-foreground rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
        >
          Quick start: first measurement in ~10 minutes
        </Link>
        <a
          href={PLATFORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="border-fd-border text-fd-foreground hover:border-fd-primary rounded-lg border px-5 py-2.5 text-sm font-semibold transition-colors"
        >
          Open the platform
        </a>
      </div>

      <div className="mt-16 grid w-full max-w-4xl gap-6 sm:grid-cols-3">
        {highlights.map((item) => (
          <div key={item.title} className="text-center sm:text-left">
            <h2 className="text-fd-primary text-lg font-semibold">{item.title}</h2>
            <p className="text-fd-muted-foreground mt-2 text-sm">{item.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 grid w-full max-w-4xl gap-6 sm:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="border-fd-border bg-fd-card hover:border-fd-primary group flex flex-col rounded-xl border p-6 text-left transition-colors"
          >
            <span className="text-fd-card-foreground text-xl font-semibold">{section.title}</span>
            <span className="text-fd-muted-foreground mt-2 flex-1 text-sm">
              {section.description}
            </span>
            <span className="text-fd-primary mt-4 text-sm font-medium group-hover:underline">
              {section.linkText} →
            </span>
          </Link>
        ))}
      </div>

      <p className="text-fd-muted-foreground mt-16 text-sm">
        openJII is open source:{" "}
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-fd-primary hover:underline"
        >
          star or contribute on GitHub
        </a>
        .
      </p>
    </main>
  );
}
