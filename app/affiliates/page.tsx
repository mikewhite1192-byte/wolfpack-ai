"use client";

import { useState } from "react";

const COLORS = {
  orange: "#E86A2A",
  bg: "#0a0a0a",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111111",
};

const fontHeading: React.CSSProperties = {
  fontFamily: "'Bebas Neue', sans-serif",
  letterSpacing: "0.04em",
};

const fontMono: React.CSSProperties = {
  fontFamily: "'Courier New', Courier, monospace",
};

export default function AffiliatesPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [referralLink, setReferralLink] = useState("");
  const [error, setError] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [loginError, setLoginError] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setSuccess(true);
      setReferralLink(data.referralLink || data.referral_link || "");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginSubmitting(true);
    setLoginError("");
    try {
      const res = await fetch("/api/affiliates/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setLoginSuccess(true);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoginSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: COLORS.bg,
        color: COLORS.text,
        padding: "0",
        margin: "0",
      }}
    >
      {/* Hero */}
      <section
        style={{
          textAlign: "center",
          padding: "80px 24px 60px",
          maxWidth: 800,
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            ...fontHeading,
            fontSize: "clamp(2.4rem, 6vw, 4rem)",
            color: COLORS.orange,
            margin: "0 0 16px",
            lineHeight: 1.1,
          }}
        >
          Earn Monthly Recurring Commission
        </h1>
        <p
          style={{
            fontSize: "1.15rem",
            color: COLORS.muted,
            maxWidth: 620,
            margin: "0 auto 12px",
            lineHeight: 1.6,
          }}
        >
          Refer contractors to The Wolf Pack and earn monthly recurring revenue
          for every active subscription. No cap on earnings, no limit on
          referrals.
        </p>
        <p
          style={{
            fontSize: "1rem",
            color: COLORS.muted,
            maxWidth: 620,
            margin: "0 auto",
            lineHeight: 1.6,
          }}
        >
          You will earn <strong style={{ color: COLORS.text }}>$20/mo</strong>{" "}
          per CRM subscriber,{" "}
          <strong style={{ color: COLORS.text }}>$10/mo</strong> per GBP
          subscriber, and a{" "}
          <strong style={{ color: COLORS.orange }}>$100 one time bonus</strong>{" "}
          for every website sale.
        </p>
      </section>

      {/* Signup Form */}
      <section
        style={{
          maxWidth: 480,
          margin: "0 auto",
          padding: "0 24px 60px",
        }}
      >
        {success ? (
          <div
            style={{
              backgroundColor: COLORS.surface,
              border: `1px solid ${COLORS.orange}`,
              borderRadius: 12,
              padding: "36px 28px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>&#10003;</div>
            <h2
              style={{
                ...fontHeading,
                fontSize: "1.6rem",
                color: COLORS.orange,
                margin: "0 0 12px",
              }}
            >
              You Are In!
            </h2>
            <p style={{ color: COLORS.muted, marginBottom: 20, lineHeight: 1.5 }}>
              Your affiliate account has been created. Share your referral link
              to start earning.
            </p>
            {referralLink && (
              <div
                style={{
                  ...fontMono,
                  backgroundColor: COLORS.bg,
                  border: `1px solid #333`,
                  borderRadius: 8,
                  padding: "14px 16px",
                  fontSize: "0.9rem",
                  wordBreak: "break-all",
                  color: COLORS.orange,
                  marginBottom: 16,
                }}
              >
                {referralLink}
              </div>
            )}
            <a
              href="/affiliates/dashboard"
              style={{
                display: "inline-block",
                backgroundColor: COLORS.orange,
                color: "#fff",
                padding: "12px 28px",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "0.95rem",
              }}
            >
              Go to Dashboard
            </a>
          </div>
        ) : (
          <form
            onSubmit={handleSignup}
            style={{
              backgroundColor: COLORS.surface,
              border: "1px solid #222",
              borderRadius: 12,
              padding: "36px 28px",
            }}
          >
            <h2
              style={{
                ...fontHeading,
                fontSize: "1.5rem",
                margin: "0 0 24px",
                textAlign: "center",
              }}
            >
              Join the Affiliate Program
            </h2>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  color: COLORS.muted,
                  marginBottom: 6,
                }}
              >
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  backgroundColor: COLORS.bg,
                  border: "1px solid #333",
                  borderRadius: 8,
                  color: COLORS.text,
                  fontSize: "1rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                placeholder="John Smith"
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  color: COLORS.muted,
                  marginBottom: 6,
                }}
              >
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  backgroundColor: COLORS.bg,
                  border: "1px solid #333",
                  borderRadius: 8,
                  color: COLORS.text,
                  fontSize: "1rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                placeholder="john@example.com"
              />
            </div>
            {error && (
              <p
                style={{
                  color: "#ef4444",
                  fontSize: "0.9rem",
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%",
                padding: "14px",
                backgroundColor: submitting ? "#a04a1a" : COLORS.orange,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: "1rem",
                fontWeight: 700,
                cursor: submitting ? "not-allowed" : "pointer",
                transition: "background-color 0.2s",
              }}
            >
              {submitting ? "Creating Account..." : "Become an Affiliate"}
            </button>
          </form>
        )}
      </section>

      {/* How It Works */}
      <section
        style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: "0 24px 60px",
        }}
      >
        <h2
          style={{
            ...fontHeading,
            fontSize: "2rem",
            textAlign: "center",
            marginBottom: 40,
            color: COLORS.text,
          }}
        >
          How It Works
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 24,
          }}
        >
          {[
            {
              step: "01",
              title: "Sign Up",
              desc: "Create your free affiliate account in seconds and get your unique referral link.",
            },
            {
              step: "02",
              title: "Share Your Link",
              desc: "Send your referral link to contractors, post it on social media, or add it to your website.",
            },
            {
              step: "03",
              title: "Get Paid Monthly",
              desc: "Earn recurring commission every month for every active subscriber you refer.",
            },
          ].map((item) => (
            <div
              key={item.step}
              style={{
                backgroundColor: COLORS.surface,
                border: "1px solid #222",
                borderRadius: 12,
                padding: "28px 24px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  ...fontMono,
                  fontSize: "2rem",
                  color: COLORS.orange,
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                {item.step}
              </div>
              <h3
                style={{
                  ...fontHeading,
                  fontSize: "1.3rem",
                  margin: "0 0 8px",
                  color: COLORS.text,
                }}
              >
                {item.title}
              </h3>
              <p
                style={{
                  color: COLORS.muted,
                  fontSize: "0.9rem",
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Commission Breakdown */}
      <section
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "0 24px 60px",
        }}
      >
        <h2
          style={{
            ...fontHeading,
            fontSize: "2rem",
            textAlign: "center",
            marginBottom: 32,
            color: COLORS.text,
          }}
        >
          Commission Breakdown
        </h2>
        <div
          style={{
            backgroundColor: COLORS.surface,
            border: "1px solid #222",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              ...fontMono,
              fontSize: "0.9rem",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: `2px solid ${COLORS.orange}`,
                }}
              >
                <th
                  style={{
                    textAlign: "left",
                    padding: "14px 20px",
                    color: COLORS.orange,
                    fontWeight: 700,
                  }}
                >
                  Product
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "14px 20px",
                    color: COLORS.orange,
                    fontWeight: 700,
                  }}
                >
                  Subscription
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "14px 20px",
                    color: COLORS.orange,
                    fontWeight: 700,
                  }}
                >
                  Your Commission
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "14px 20px",
                    color: COLORS.orange,
                    fontWeight: 700,
                  }}
                >
                  Type
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  product: "CRM",
                  price: "$97/mo",
                  commission: "$20/mo",
                  type: "Recurring",
                },
                {
                  product: "GBP Management",
                  price: "$49/mo",
                  commission: "$10/mo",
                  type: "Recurring",
                },
                {
                  product: "Website Build",
                  price: "One time",
                  commission: "$100",
                  type: "One time bonus",
                },
              ].map((row, i) => (
                <tr
                  key={row.product}
                  style={{
                    borderBottom:
                      i < 2 ? "1px solid #222" : "none",
                  }}
                >
                  <td
                    style={{
                      padding: "14px 20px",
                      color: COLORS.text,
                      fontWeight: 600,
                    }}
                  >
                    {row.product}
                  </td>
                  <td
                    style={{ padding: "14px 20px", color: COLORS.muted }}
                  >
                    {row.price}
                  </td>
                  <td
                    style={{
                      padding: "14px 20px",
                      color: COLORS.orange,
                      fontWeight: 700,
                    }}
                  >
                    {row.commission}
                  </td>
                  <td
                    style={{ padding: "14px 20px", color: COLORS.muted }}
                  >
                    {row.type}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p
          style={{
            textAlign: "center",
            color: COLORS.muted,
            fontSize: "0.85rem",
            marginTop: 16,
            lineHeight: 1.5,
          }}
        >
          CRM referrals earn $20/mo. GBP referrals earn $10/mo. Website sales earn a $100 bonus.
          Payouts are processed monthly via Stripe.
        </p>
      </section>

      {/* Already an affiliate / Login */}
      <section
        style={{
          maxWidth: 480,
          margin: "0 auto",
          padding: "0 24px 80px",
        }}
      >
        <div
          style={{
            backgroundColor: COLORS.surface,
            border: "1px solid #222",
            borderRadius: 12,
            padding: "36px 28px",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              ...fontHeading,
              fontSize: "1.4rem",
              margin: "0 0 8px",
              color: COLORS.text,
            }}
          >
            Already an Affiliate?
          </h2>
          <p
            style={{
              color: COLORS.muted,
              fontSize: "0.9rem",
              marginBottom: 20,
              lineHeight: 1.5,
            }}
          >
            Enter your email to receive a magic login link for your dashboard.
          </p>
          {loginSuccess ? (
            <div
              style={{
                backgroundColor: COLORS.bg,
                border: `1px solid ${COLORS.orange}`,
                borderRadius: 8,
                padding: "16px",
              }}
            >
              <p style={{ color: COLORS.orange, fontWeight: 600, margin: 0 }}>
                Check your inbox! We sent a login link to {loginEmail}.
              </p>
            </div>
          ) : (
            <form onSubmit={handleLogin}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="your@email.com"
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    backgroundColor: COLORS.bg,
                    border: "1px solid #333",
                    borderRadius: 8,
                    color: COLORS.text,
                    fontSize: "0.95rem",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={loginSubmitting}
                  style={{
                    padding: "12px 20px",
                    backgroundColor: COLORS.orange,
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    cursor: loginSubmitting ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                    opacity: loginSubmitting ? 0.7 : 1,
                  }}
                >
                  {loginSubmitting ? "Sending..." : "Send Login Link"}
                </button>
              </div>
              {loginError && (
                <p
                  style={{
                    color: "#ef4444",
                    fontSize: "0.85rem",
                    margin: 0,
                  }}
                >
                  {loginError}
                </p>
              )}
            </form>
          )}
          <a
            href="/affiliates/dashboard"
            style={{
              display: "inline-block",
              marginTop: 16,
              color: COLORS.muted,
              fontSize: "0.85rem",
              textDecoration: "underline",
            }}
          >
            Go to Dashboard
          </a>
        </div>
      </section>
    </div>
  );
}
