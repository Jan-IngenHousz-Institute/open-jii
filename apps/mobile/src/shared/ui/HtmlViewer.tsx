import { useColorScheme } from "nativewind";
import React from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

interface HtmlViewerProps {
  htmlContent: string;
  scrollEnabled?: boolean;
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
}

function normalizeQuillLists(html: string) {
  if (!html) return html;

  let updated = html.replace(/<ol>([\s\S]*?)<\/ol>/g, (match) => {
    if (match.includes('data-list="bullet"')) {
      return match
        .replace(/<ol>/g, "<ul>")
        .replace(/<\/ol>/g, "</ul>")
        .replace(/ data-list="bullet"/g, "");
    }
    return match;
  });

  updated = updated.replace(/ data-list="ordered"/g, "");

  return updated;
}

// Approved exception: WebView renders raw HTML outside the NativeWind view
// tree, so CSS colors must be injected as a string. See docs/styling.md.
export function HtmlViewer({
  htmlContent,
  scrollEnabled = true,
  showsVerticalScrollIndicator = true,
  showsHorizontalScrollIndicator = false,
}: HtmlViewerProps) {
  const { colorScheme } = useColorScheme();
  // Body stays transparent so the parent <View>'s background bleeds through
  // (matches whatever surface — bg-card / bg-background — wraps the WebView).
  // Avoids the dark-mode gray-800 block that didn't line up with bg-card.
  const palette =
    colorScheme === "dark"
      ? {
          body: "transparent",
          text: "#f9fafb",
          codeBg: "rgba(255,255,255,0.08)",
          quoteBorder: "rgba(255,255,255,0.2)",
          quoteBg: "rgba(255,255,255,0.05)",
        }
      : {
          body: "transparent",
          text: "#111827",
          codeBg: "#f3f4f6",
          quoteBorder: "#d1d5db",
          quoteBg: "#f9fafb",
        };

  const normalizedContent = normalizeQuillLists(htmlContent);

  const fullHtmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 13px;
          margin: 0;
          background-color: ${palette.body};
          color: ${palette.text};
          line-height: 1.6;
        }
        h1 { font-size: 1.85em; margin: 16px 0 8px 0; font-weight: 600; }
        h2 { font-size: 1.54em; margin: 16px 0 8px 0; font-weight: 600; }
        h3 { font-size: 1.31em; margin: 16px 0 8px 0; font-weight: 600; }
        h4 { font-size: 1.15em; margin: 16px 0 8px 0; font-weight: 600; }
        h5 { font-size: 1em;    margin: 16px 0 8px 0; font-weight: 600; }
        h6 { font-size: 0.85em; margin: 16px 0 8px 0; font-weight: 600; }
        p {
          margin: 8px 0;
        }
        ul, ol {
          margin: 8px 0;
          padding-left: 24px;
        }
        li {
          margin: 4px 0;
        }
        code {
          background-color: ${palette.codeBg};
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
          font-size: 0.92em;
        }
        blockquote {
          border-left: 4px solid ${palette.quoteBorder};
          margin: 16px 0;
          padding: 8px 16px;
          background-color: ${palette.quoteBg};
        }
        a {
          color: #3b82f6;
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
        strong {
          font-weight: 600;
        }
        em {
          font-style: italic;
        }
        u {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      ${normalizedContent}
    </body>
    </html>
  `;

  return (
    <View className="flex-1">
      <WebView
        source={{ html: fullHtmlContent }}
        style={{ flex: 1, backgroundColor: "transparent" }}
        opaque={false}
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
        javaScriptEnabled={false}
        domStorageEnabled={false}
        nestedScrollEnabled={true}
        bounces={false}
        overScrollMode="never"
        onShouldStartLoadWithRequest={() => true}
        startInLoadingState={false}
        scalesPageToFit={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
      />
    </View>
  );
}
