"use client";

import { useTheme } from "next-themes";
import { useEffect, useId, useState } from "react";

interface MermaidProps {
  // Mermaid source, e.g. a `flowchart LR` or `sequenceDiagram` body.
  chart: string;
}

// Renders a mermaid diagram in the browser. Authors write a ```mermaid fence and
// remarkMdxMermaid (see source.config.ts) rewrites it into this component, which is
// registered globally in mdx-components.tsx. The library is imported lazily inside the
// effect so its ~180 kB gzipped of chunks only load on the pages that draw a diagram.
export function Mermaid({ chart }: MermaidProps) {
  const [svg, setSvg] = useState<string>();
  const [failed, setFailed] = useState(false);
  const { resolvedTheme } = useTheme();
  // useId() emits colons/guillemets that are invalid in the DOM selectors mermaid
  // builds from the render id, so keep only characters a selector accepts.
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  // The theme is only known once next-themes has mounted, and mermaid bakes colours
  // into the SVG it emits, so the first paint has to wait and every light/dark switch
  // has to re-render rather than restyle.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    // Unmounting, or a theme switch arriving mid-render, must drop the in-flight result
    // instead of letting it overwrite a newer one.
    const controller = new AbortController();

    void (async () => {
      const { default: mermaid } = await import("mermaid");

      mermaid.initialize({
        startOnLoad: false,
        theme: resolvedTheme === "dark" ? "dark" : "default",
        fontFamily: "inherit",
      });

      return mermaid.render(`${id}-svg`, chart);
    })().then(
      ({ svg: rendered }) => {
        if (controller.signal.aborted) return;
        setSvg(rendered);
        setFailed(false);
      },
      () => {
        if (controller.signal.aborted) return;
        setFailed(true);
      },
    );

    return () => controller.abort();
  }, [chart, id, mounted, resolvedTheme]);

  if (failed) {
    return (
      <pre className="bg-fd-muted text-fd-muted-foreground my-6 overflow-x-auto rounded-lg p-4 text-sm">
        <code>{chart}</code>
      </pre>
    );
  }

  return (
    <div
      className="my-6 flex justify-center overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full"
      // Mermaid returns a complete SVG document, carrying its own graphics-document
      // role and labels; there is no React tree to build from it.
      dangerouslySetInnerHTML={{ __html: svg ?? "" }}
    />
  );
}
