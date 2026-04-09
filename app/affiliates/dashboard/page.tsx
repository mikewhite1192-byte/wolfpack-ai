"use client";

import { useState, useEffect, useCallback } from "react";

const COLORS = {
  orange: "#E86A2A",
  bg: "#0a0a0a",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111111",
  green: "#22c55e",
};

const fontHeading: React.CSSProperties = {
  fontFamily: "'Bebas Neue', sans-serif",
  letterSpacing: "0.04em",
};

const fontMono: React.CSSProperties = {
  fontFamily: "'Courier New', Courier, monospace",
};

interface Referral {
  email: string;
  status: string;
  monthly_value: number;
  commission: number;
  joined: string;
}

interface Payout {
  amount: number;
  period: string;
  status: string;
  paid_date: string | null;
}

interface DashboardData {
  name: string;
  code: string;
  referral_link: string;
  stats: {
    active_clients: number;
    total_referrals: number;
    monthly_earnings: number;
    lifetime_paid: number;
    pending_payout: number;
    link_clicks: number;
  };
  stripe_connected: boolean;
  referrals: Referral[];
  payouts: Payout[];
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "****";
  const masked = user.length > 2 ? user[0] + "***" + user[user.length - 1] : "***";
  return `${masked}@${domain}`;
}

function formatCurrency(val: number): string {
  return "$" + val.toFixed(2);
}

export default function AffiliateDashboard() {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Stripe connect loading
  const [connectingStripe, setConnectingStripe] = useState(false);

  const fetchDashboard = useCallback(async (email: string) => {
    try {
      const res = await fetch(
        `/api/affiliates/dashboard?email=${encodeURIComponent(email)}`
      );
      if (!res.ok) throw new Error("Failed to load dashboard");
      const json = await res.json();
      setData(json);
      setLoggedIn(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/affiliates/me");
        if (res.ok) {
          const json = await res.json();
          if (json.email) {
            await fetchDashboard(json.email);
            return;
          }
        }
      } catch {}
      setLoading(false);
    }
    checkAuth();
  }, [fetchDashboard]);

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
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong");
      setLoginSuccess(true);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoginSubmitting(false);
    }
  }

  async function handleCopy() {
    if (!data?.referral_link) return;
    try {
      await navigator.clipboard.writeText(data.referral_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  async function handleStripeConnect() {
    setConnectingStripe(true);
    try {
      const res = await fetch("/api/affiliates/connect", { method: "POST" });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      }
    } catch {
      alert("Failed to start Stripe onboarding. Please try again.");
    } finally {
      setConnectingStripe(false);
    }
  }

  function handleLogout() {
    document.cookie =
      "wp_affiliate_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/affiliates";
  }

  function shareTwitter() {
    const text = encodeURIComponent(
      `I just joined The Wolf Pack affiliate program. Check it out: ${data?.referral_link}`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
  }

  function shareFacebook() {
    const url = encodeURIComponent(data?.referral_link || "");
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      "_blank"
    );
  }

  function shareEmail() {
    const subject = encodeURIComponent("Check out The Wolf Pack");
    const body = encodeURIComponent(
      `I have been using The Wolf Pack for my contracting business and thought you would like it too. Sign up here: ${data?.referral_link}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: COLORS.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: COLORS.muted,
          fontSize: "1.1rem",
        }}
      >
        Loading...
      </div>
    );
  }

  // Login form
  if (!loggedIn) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: COLORS.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 440,
            width: "100%",
            backgroundColor: COLORS.surface,
            border: "1px solid #222",
            borderRadius: 12,
            padding: "40px 28px",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              ...fontHeading,
              fontSize: "1.8rem",
              color: COLORS.orange,
              margin: "0 0 8px",
            }}
          >
            Affiliate Dashboard
          </h1>
          <p
            style={{
              color: COLORS.muted,
              fontSize: "0.9rem",
              marginBottom: 28,
              lineHeight: 1.5,
            }}
          >
            Enter your email to receive a magic login link.
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
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="your@email.com"
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
                  marginBottom: 14,
                }}
              />
              {loginError && (
                <p
                  style={{
                    color: "#ef4444",
                    fontSize: "0.85rem",
                    marginBottom: 12,
                  }}
                >
                  {loginError}
                </p>
              )}
              <button
                type="submit"
                disabled={loginSubmitting}
                style={{
                  width: "100%",
                  padding: "14px",
                  backgroundColor: loginSubmitting ? "#a04a1a" : COLORS.orange,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: "1rem",
                  cursor: loginSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {loginSubmitting ? "Sending..." : "Send Login Link"}
              </button>
            </form>
          )}
          <a
            href="/affiliates"
            style={{
              display: "inline-block",
              marginTop: 20,
              color: COLORS.muted,
              fontSize: "0.85rem",
              textDecoration: "underline",
            }}
          >
            Not an affiliate yet? Sign up here
          </a>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: COLORS.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ef4444",
          fontSize: "1.1rem",
        }}
      >
        {error || "Failed to load dashboard data."}
      </div>
    );
  }

  const stats = [
    { label: "Active Clients", value: data.stats.active_clients },
    { label: "Total Referrals", value: data.stats.total_referrals },
    {
      label: "Monthly Earnings",
      value: formatCurrency(data.stats.monthly_earnings),
    },
    {
      label: "Lifetime Paid",
      value: formatCurrency(data.stats.lifetime_paid),
    },
    {
      label: "Pending Payout",
      value: formatCurrency(data.stats.pending_payout),
    },
    { label: "Link Clicks", value: data.stats.link_clicks },
  ];

  const btnStyle: React.CSSProperties = {
    padding: "8px 14px",
    border: "1px solid #333",
    borderRadius: 6,
    backgroundColor: COLORS.surface,
    color: COLORS.muted,
    fontSize: "0.8rem",
    cursor: "pointer",
    transition: "border-color 0.2s",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: COLORS.bg,
        color: COLORS.text,
      }}
    >
      {/* Top bar */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 28px",
          borderBottom: "1px solid #222",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <div>
          <h1
            style={{
              ...fontHeading,
              fontSize: "1.4rem",
              color: COLORS.orange,
              margin: 0,
            }}
          >
            Wolf Pack Affiliates
          </h1>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: "8px 18px",
            backgroundColor: "transparent",
            border: "1px solid #444",
            borderRadius: 6,
            color: COLORS.muted,
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </header>

      <main
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "32px 28px 80px",
        }}
      >
        {/* Welcome */}
        <div style={{ marginBottom: 32 }}>
          <h2
            style={{
              ...fontHeading,
              fontSize: "1.8rem",
              margin: "0 0 4px",
              color: COLORS.text,
            }}
          >
            Welcome back, {data.name}
          </h2>
          <p style={{ color: COLORS.muted, margin: 0, fontSize: "0.9rem" }}>
            Affiliate Code:{" "}
            <span style={{ ...fontMono, color: COLORS.orange, fontWeight: 700 }}>
              {data.code}
            </span>
          </p>
        </div>

        {/* Referral Link */}
        <div
          style={{
            backgroundColor: COLORS.surface,
            border: "1px solid #222",
            borderRadius: 12,
            padding: "24px",
            marginBottom: 28,
          }}
        >
          <p
            style={{
              color: COLORS.muted,
              fontSize: "0.85rem",
              margin: "0 0 10px",
            }}
          >
            Your Referral Link
          </p>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                ...fontMono,
                flex: 1,
                minWidth: 200,
                backgroundColor: COLORS.bg,
                border: "1px solid #333",
                borderRadius: 8,
                padding: "12px 14px",
                fontSize: "0.9rem",
                color: COLORS.orange,
                wordBreak: "break-all",
              }}
            >
              {data.referral_link}
            </div>
            <button
              onClick={handleCopy}
              style={{
                ...btnStyle,
                backgroundColor: copied ? COLORS.green : COLORS.orange,
                color: "#fff",
                border: "none",
                fontWeight: 700,
                padding: "12px 18px",
              }}
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 14,
            }}
          >
            <button onClick={shareTwitter} style={btnStyle}>
              Share on Twitter
            </button>
            <button onClick={shareFacebook} style={btnStyle}>
              Share on Facebook
            </button>
            <button onClick={shareEmail} style={btnStyle}>
              Share via Email
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 16,
            marginBottom: 28,
          }}
        >
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                backgroundColor: COLORS.surface,
                border: "1px solid #222",
                borderRadius: 10,
                padding: "20px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  ...fontMono,
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: COLORS.orange,
                  marginBottom: 6,
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  fontSize: "0.78rem",
                  color: COLORS.muted,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Stripe Connect */}
        <div
          style={{
            backgroundColor: COLORS.surface,
            border: "1px solid #222",
            borderRadius: 12,
            padding: "24px",
            marginBottom: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <h3
              style={{
                ...fontHeading,
                fontSize: "1.1rem",
                margin: "0 0 4px",
                color: COLORS.text,
              }}
            >
              Payout Account
            </h3>
            <p style={{ color: COLORS.muted, margin: 0, fontSize: "0.85rem" }}>
              {data.stripe_connected
                ? "Your bank account is connected and ready to receive payouts."
                : "Connect your bank account to start receiving payouts."}
            </p>
          </div>
          {data.stripe_connected ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: COLORS.green,
                fontWeight: 700,
                fontSize: "0.95rem",
              }}
            >
              <span style={{ fontSize: "1.4rem" }}>&#10003;</span>
              Connected
            </div>
          ) : (
            <button
              onClick={handleStripeConnect}
              disabled={connectingStripe}
              style={{
                padding: "12px 24px",
                backgroundColor: COLORS.orange,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: connectingStripe ? "not-allowed" : "pointer",
                opacity: connectingStripe ? 0.7 : 1,
              }}
            >
              {connectingStripe ? "Connecting..." : "Connect Bank Account"}
            </button>
          )}
        </div>

        {/* Referrals Table */}
        <div
          style={{
            backgroundColor: COLORS.surface,
            border: "1px solid #222",
            borderRadius: 12,
            marginBottom: 28,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px 24px 14px",
              borderBottom: "1px solid #222",
            }}
          >
            <h3
              style={{
                ...fontHeading,
                fontSize: "1.1rem",
                margin: 0,
                color: COLORS.text,
              }}
            >
              Referrals
            </h3>
          </div>
          {data.referrals.length === 0 ? (
            <div
              style={{
                padding: "32px 24px",
                textAlign: "center",
                color: COLORS.muted,
                fontSize: "0.9rem",
              }}
            >
              No referrals yet. Share your link to get started!
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.85rem",
                  minWidth: 540,
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "1px solid #333" }}>
                    {["Email", "Status", "Monthly Value", "Commission", "Joined"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "10px 20px",
                            color: COLORS.muted,
                            fontWeight: 600,
                            fontSize: "0.78rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.referrals.map((r, i) => (
                    <tr
                      key={i}
                      style={{
                        borderBottom:
                          i < data.referrals.length - 1
                            ? "1px solid #1a1a1a"
                            : "none",
                      }}
                    >
                      <td
                        style={{
                          padding: "12px 20px",
                          ...fontMono,
                          fontSize: "0.82rem",
                          color: COLORS.text,
                        }}
                      >
                        {maskEmail(r.email)}
                      </td>
                      <td style={{ padding: "12px 20px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            backgroundColor:
                              r.status === "active"
                                ? "rgba(34,197,94,0.15)"
                                : r.status === "trial"
                                ? "rgba(232,106,42,0.15)"
                                : "rgba(176,180,200,0.1)",
                            color:
                              r.status === "active"
                                ? COLORS.green
                                : r.status === "trial"
                                ? COLORS.orange
                                : COLORS.muted,
                          }}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "12px 20px",
                          color: COLORS.text,
                          ...fontMono,
                        }}
                      >
                        {formatCurrency(r.monthly_value)}
                      </td>
                      <td
                        style={{
                          padding: "12px 20px",
                          color: COLORS.orange,
                          fontWeight: 700,
                          ...fontMono,
                        }}
                      >
                        {formatCurrency(r.commission)}
                      </td>
                      <td
                        style={{
                          padding: "12px 20px",
                          color: COLORS.muted,
                        }}
                      >
                        {r.joined}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payouts Table */}
        <div
          style={{
            backgroundColor: COLORS.surface,
            border: "1px solid #222",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px 24px 14px",
              borderBottom: "1px solid #222",
            }}
          >
            <h3
              style={{
                ...fontHeading,
                fontSize: "1.1rem",
                margin: 0,
                color: COLORS.text,
              }}
            >
              Payouts
            </h3>
          </div>
          {data.payouts.length === 0 ? (
            <div
              style={{
                padding: "32px 24px",
                textAlign: "center",
                color: COLORS.muted,
                fontSize: "0.9rem",
              }}
            >
              No payouts yet. Payouts are processed monthly once you reach $50.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.85rem",
                  minWidth: 440,
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "1px solid #333" }}>
                    {["Amount", "Period", "Status", "Paid Date"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "10px 20px",
                          color: COLORS.muted,
                          fontWeight: 600,
                          fontSize: "0.78rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.payouts.map((p, i) => (
                    <tr
                      key={i}
                      style={{
                        borderBottom:
                          i < data.payouts.length - 1
                            ? "1px solid #1a1a1a"
                            : "none",
                      }}
                    >
                      <td
                        style={{
                          padding: "12px 20px",
                          color: COLORS.orange,
                          fontWeight: 700,
                          ...fontMono,
                        }}
                      >
                        {formatCurrency(p.amount)}
                      </td>
                      <td
                        style={{
                          padding: "12px 20px",
                          color: COLORS.text,
                        }}
                      >
                        {p.period}
                      </td>
                      <td style={{ padding: "12px 20px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            backgroundColor:
                              p.status === "paid"
                                ? "rgba(34,197,94,0.15)"
                                : p.status === "pending"
                                ? "rgba(232,106,42,0.15)"
                                : "rgba(176,180,200,0.1)",
                            color:
                              p.status === "paid"
                                ? COLORS.green
                                : p.status === "pending"
                                ? COLORS.orange
                                : COLORS.muted,
                          }}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "12px 20px",
                          color: COLORS.muted,
                        }}
                      >
                        {p.paid_date || "Pending"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
