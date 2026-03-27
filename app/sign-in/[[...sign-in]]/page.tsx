"use client";
import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0D1426",
      padding: 24,
    }}>
      <SignIn forceRedirectUrl="/dashboard" />
    </div>
  );
}
