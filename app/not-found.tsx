import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: "2rem",
      }}
    >
      <h1
        style={{
          fontSize: "8rem",
          fontWeight: 700,
          color: "#E86A2A",
          margin: 0,
          lineHeight: 1,
        }}
      >
        404
      </h1>
      <p
        style={{
          fontSize: "1.25rem",
          color: "#e5e5e5",
          marginTop: "1rem",
          marginBottom: "0.5rem",
        }}
      >
        This page doesn't exist
      </p>
      <p
        style={{
          fontSize: "0.95rem",
          color: "#737373",
          marginTop: 0,
          marginBottom: "2rem",
        }}
      >
        The page you're looking for may have been moved or removed.
      </p>
      <Link
        href="/"
        style={{
          display: "inline-block",
          padding: "0.75rem 2rem",
          backgroundColor: "#E86A2A",
          color: "#ffffff",
          borderRadius: "8px",
          textDecoration: "none",
          fontWeight: 600,
          fontSize: "0.95rem",
          transition: "opacity 0.2s",
        }}
      >
        Back to Home
      </Link>
    </div>
  );
}
