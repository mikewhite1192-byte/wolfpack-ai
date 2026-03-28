import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0D1426",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(135deg, #E86A2A, #ff9a5c)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 24,
              fontWeight: 800,
            }}
          >
            WP
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#f5f3f0", letterSpacing: 2 }}>
            THE <span style={{ color: "#E86A2A" }}>WOLF</span> PACK AI
          </div>
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: "#f5f3f0",
            textAlign: "center",
            lineHeight: 1.1,
            maxWidth: 900,
            marginBottom: 24,
          }}
        >
          Your AI Sales Agent That Never Sleeps
        </div>
        <div
          style={{
            fontSize: 24,
            color: "rgba(245,243,240,0.5)",
            textAlign: "center",
            maxWidth: 600,
          }}
        >
          Responds in seconds. Qualifies leads. Books appointments. 24/7.
        </div>
        <div
          style={{
            marginTop: 40,
            padding: "14px 40px",
            background: "#E86A2A",
            borderRadius: 12,
            color: "#fff",
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          thewolfpack.ai
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
