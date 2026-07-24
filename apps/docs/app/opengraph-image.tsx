import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const logo = readFile(
  join(process.cwd(), "public/img/openjii-logo-horizontal-yellow-transparent.png"),
).then((buffer) => Uint8Array.from(buffer).buffer);

export const dynamic = "force-static";
export const alt = "openJII Documentation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logoData = await logo;

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
        <img
          src={logoData as unknown as string}
          alt=""
          width={500}
          height={147}
          style={{ objectFit: "contain" }}
        />
        <div style={{ fontSize: 68, fontWeight: 700, marginTop: 30, lineHeight: 1.1 }}>
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
