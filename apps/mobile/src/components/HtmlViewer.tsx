import React from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { useTheme } from "~/hooks/use-theme";

interface HtmlViewerProps {
  htmlContent: string;
  scrollEnabled?: boolean;
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
}

export function HtmlViewer({
  htmlContent,
  scrollEnabled = true,
  showsVerticalScrollIndicator = true,
  showsHorizontalScrollIndicator = false,
}: HtmlViewerProps) {
  const { isDark } = useTheme();

  const fullHtmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 16px;
          background-color: ${isDark ? "#1f2937" : "#ffffff"};
          color: ${isDark ? "#f9fafb" : "#111827"};
          line-height: 1.6;
        }
        h1, h2, h3, h4, h5, h6 {
          margin: 16px 0 8px 0;
          font-weight: 600;
        }
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
          background-color: ${isDark ? "#374151" : "#f3f4f6"};
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
          font-size: 14px;
        }
        blockquote {
          border-left: 4px solid ${isDark ? "#6b7280" : "#d1d5db"};
          margin: 16px 0;
          padding: 8px 16px;
          background-color: ${isDark ? "#374151" : "#f9fafb"};
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
      ${htmlContent}
    </body>
    </html>
  `;

  return (
    <View style={{ flex: 1 }}>
      <WebView
        source={{ html: fullHtmlContent }}
        style={{ flex: 1 }}
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
