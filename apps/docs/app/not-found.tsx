import { baseOptions } from "@/lib/layout.shared";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import Link from "next/link";

const links = [
  {
    href: "/guide",
    title: "Researcher Guide",
    description: "Measure, analyze, and share your data.",
  },
  { href: "/developers", title: "Developers", description: "Architecture, ADRs, and tooling." },
  { href: "/api", title: "API Reference", description: "REST and MQTT contracts." },
];

export default function NotFound() {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="text-fd-primary text-sm font-semibold uppercase tracking-wide">404</p>
        <h1 className="text-fd-foreground mt-2 text-3xl font-bold sm:text-4xl">Page not found</h1>
        <p className="text-fd-muted-foreground mt-4 max-w-md">
          That page moved or never existed. Try the search (press{" "}
          <kbd className="bg-fd-muted rounded border px-1.5 py-0.5 text-xs">⌘/Ctrl K</kbd>) or pick
          a starting point below.
        </p>

        <div className="mt-10 grid w-full max-w-2xl gap-4 sm:grid-cols-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="border-fd-border bg-fd-card hover:border-fd-primary rounded-xl border p-5 text-left transition-colors"
            >
              <span className="text-fd-card-foreground font-semibold">{link.title}</span>
              <span className="text-fd-muted-foreground mt-1 block text-sm">
                {link.description}
              </span>
            </Link>
          ))}
        </div>

        <Link href="/" className="text-fd-primary mt-10 text-sm font-medium hover:underline">
          Back to the documentation home
        </Link>
      </main>
    </HomeLayout>
  );
}
