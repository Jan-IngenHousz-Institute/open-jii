import { source } from "@/lib/source";
import { notFound } from "next/navigation";

export const dynamic = "force-static";

// Serves the raw MDX of each page as a static `.md` file under `output: export`,
// so the copy/AI actions can fetch a page's Markdown source. The `.md` suffix on
// the last segment keeps leaf files from colliding with section directories
// (e.g. /raw/developers.md as a file alongside /raw/developers/ as a folder).
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const pageSlugs = slug.map((part, i) =>
    i === slug.length - 1 ? part.replace(/\.md$/, "") : part,
  );
  const page = source.getPage(pageSlugs);
  if (!page) notFound();

  const content = await page.data.getText("raw");
  return new Response(content, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    slug: page.slugs.map((part, i) => (i === page.slugs.length - 1 ? `${part}.md` : part)),
  }));
}
