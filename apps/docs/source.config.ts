import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";

export const docs = defineDocs({
  dir: "content",
});

export default defineConfig({
  mdxOptions: {
    // Rewrites ```mermaid fences into <Mermaid chart="..." /> before the default
    // plugins run, so a diagram never reaches the code-block or search-index
    // handling. The Mermaid component is registered in mdx-components.tsx.
    remarkPlugins: (plugins) => [remarkMdxMermaid, ...plugins],
  },
});
