import { ImageResponse } from "next/og";

export const runtime = "edge";

const HERO_URL = "https://thewolfpack.ai/images/hero-wolf.png";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#0a0a0a",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Wolf hero image — right side, bleeding off edge */}
        <img
          src={HERO_URL}
          width={720}
          height={720}
          style={{
            position: "absolute",
            right: -60,
            top: "50%",
            transform: "translateY(-50%)",
            objectFit: "contain",
          }}
        />

        {/* Dark gradient over wolf so text stays legible */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, #0a0a0a 0%, #0a0a0a 40%, rgba(10,10,10,0.6) 65%, rgba(10,10,10,0) 100%)",
            display: "flex",
          }}
        />

        {/* Text content — left side */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 72px",
            width: 780,
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 28,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "linear-gradient(135deg, #E86A2A, #ff9a5c)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 22,
                fontWeight: 800,
              }}
            >
              WP
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                fontSize: 28,
                fontWeight: 800,
                color: "#f5f3f0",
                letterSpacing: 2,
              }}
            >
              <span>THE</span>
              <span style={{ color: "#E86A2A" }}>WOLF</span>
              <span>PACK AI</span>
            </div>
          </div>

          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: "#f5f3f0",
              lineHeight: 1.05,
              marginBottom: 24,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Your AI Sales Agent</span>
            <span style={{ color: "#E86A2A" }}>That Never Sleeps</span>
          </div>

          <div
            style={{
              fontSize: 22,
              color: "rgba(245,243,240,0.7)",
              lineHeight: 1.4,
              marginBottom: 36,
              display: "flex",
            }}
          >
            Responds in seconds. Qualifies leads. Books appointments. 24/7.
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                padding: "12px 28px",
                background: "#E86A2A",
                borderRadius: 10,
                color: "#fff",
                fontSize: 20,
                fontWeight: 700,
                display: "flex",
              }}
            >
              thewolfpack.ai
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
