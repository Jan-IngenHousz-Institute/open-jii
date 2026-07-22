import { DOCS_CONTENT_ROOT, GITHUB_BRANCH, GITHUB_OWNER, GITHUB_REPO } from "@/lib/layout.shared";
import { source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";
import { ViewOptionsPopover } from "fumadocs-ui/layouts/docs/page";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

const SECTION = "developers";

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage([SECTION, ...(params.slug ?? [])]);
  if (!page) notFound();

  const MDXContent = page.data.body;
  const githubPath = `${DOCS_CONTENT_ROOT}/${page.path}`;

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      editOnGithub={{
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        sha: GITHUB_BRANCH,
        path: githubPath,
      }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <div className="flex flex-row items-center gap-2 border-b pb-4">
        <ViewOptionsPopover
          markdownUrl={`/raw/${page.slugs.join("/")}.md`}
          githubUrl={`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/${githubPath}`}
        />
      </div>
      <DocsBody>
        <MDXContent components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source
    .generateParams()
    .filter((param) => param.slug[0] === SECTION)
    .map((param) => ({ slug: param.slug.slice(1) }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage([SECTION, ...(params.slug ?? [])]);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
