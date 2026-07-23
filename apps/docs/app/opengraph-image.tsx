import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "openJII Documentation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #003d3d 0%, #005e5e 100%)",
          color: "#ffffff",
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700, color: "#49e06d" }}>openJII</div>
        <div style={{ fontSize: 68, fontWeight: 700, marginTop: 24, lineHeight: 1.1 }}>
          Documentation
        </div>
        <div style={{ fontSize: 34, marginTop: 24, color: "#cfeede", maxWidth: 900 }}>
          Open science for photosynthesis research. Measure, analyze, and share your data.
        </div>
      </div>
    ),
    { ...size },
  );
}
