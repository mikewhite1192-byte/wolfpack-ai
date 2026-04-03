"use client";
import { useState, useEffect, useCallback } from "react";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111111",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
  blue: "#3498db",
  yellow: "#f39c12",
  purple: "#9b59b6",
};

interface GbpConnection {
  id: string;
  connected: boolean;
  connected_email: string;
  location_name: string;
  auto_post_enabled: boolean;
  auto_review_reply_enabled: boolean;
  monthly_report_enabled: boolean;
  report_phone: string;
  last_post_at: string | null;
  last_review_check_at: string | null;
  last_report_at: string | null;
}

interface GbpPost {
  id: string;
  summary: string;
  post_type: string;
  status: string;
  cta_type: string | null;
  posted_at: string;
}

interface GbpReview {
  id: string;
  reviewer_name: string;
  star_rating: number;
  comment: string;
  review_time: string;
  reply_text: string | null;
  reply_status: string;
  sentiment: string;
  ai_suggested_reply: string | null;
}

interface GbpInsight {
  id: string;
  period_start: string;
  period_end: string;
  search_impressions: number;
  maps_impressions: number;
  website_clicks: number;
  phone_calls: number;
  direction_requests: number;
  top_search_terms: Array<{ term: string; impressions: number }>;
}

export default function GbpPage() {
  const [tab, setTab] = useState<"overview" | "posts" | "reviews" | "insights">("overview");
  const [connections, setConnections] = useState<GbpConnection[]>([]);
  const [selectedConn, setSelectedConn] = useState<string>("");
  const [posts, setPosts] = useState<GbpPost[]>([]);
  const [reviews, setReviews] = useState<GbpReview[]>([]);
  const [insights, setInsights] = useState<GbpInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostText, setNewPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replying, setReplying] = useState("");

  const fetchConnections = useCallback(async () => {
    const res = await fetch("/api/settings");
    const data = await res.json();
    if (data.gbpConnections) {
      setConnections(data.gbpConnections);
      if (data.gbpConnections.length > 0 && !selectedConn) {
        setSelectedConn(data.gbpConnections[0].id);
      }
    }
    setLoading(false);
  }, [selectedConn]);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  useEffect(() => {
    if (!selectedConn) return;
    if (tab === "posts") {
      fetch(`/api/gbp/posts?connectionId=${selectedConn}`).then(r => r.json()).then(d => setPosts(d.posts || []));
    } else if (tab === "reviews") {
      fetch(`/api/gbp/reviews?connectionId=${selectedConn}`).then(r => r.json()).then(d => setReviews(d.reviews || []));
    } else if (tab === "insights") {
      fetch(`/api/gbp/insights?connectionId=${selectedConn}`).then(r => r.json()).then(d => setInsights(d.insights || []));
    }
  }, [tab, selectedConn]);

  async function createPost() {
    if (!newPostText.trim() || !selectedConn) return;
    setPosting(true);
    await fetch("/api/gbp/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId: selectedConn, summary: newPostText }),
    });
    setNewPostText("");
    setPosting(false);
    fetch(`/api/gbp/posts?connectionId=${selectedConn}`).then(r => r.json()).then(d => setPosts(d.posts || []));
  }

  async function replyToReview(reviewId: string) {
    const text = replyText[reviewId];
    if (!text?.trim()) return;
    setReplying(reviewId);
    await fetch("/api/gbp/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reply", reviewId, replyText: text }),
    });
    setReplying("");
    fetch(`/api/gbp/reviews?connectionId=${selectedConn}`).then(r => r.json()).then(d => setReviews(d.reviews || []));
  }

  async function skipReview(reviewId: string) {
    await fetch("/api/gbp/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "skip", reviewId }),
    });
    fetch(`/api/gbp/reviews?connectionId=${selectedConn}`).then(r => r.json()).then(d => setReviews(d.reviews || []));
  }

  const conn = connections.find(c => c.id === selectedConn);

  if (loading) return <div style={{ color: T.muted, padding: 40, textAlign: "center" }}>Loading...</div>;

  return (
    <div>
      <style>{`
        .gbp-title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: ${T.text}; letter-spacing: 1px; margin-bottom: 24px; }
        .gbp-tabs { display: flex; gap: 4px; background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 4px; margin-bottom: 24px; width: fit-content; }
        .gbp-tab { padding: 8px 18px; border-radius: 7px; font-size: 13px; font-weight: 600; border: none; cursor: pointer; font-family: 'Inter', sans-serif; transition: all 0.15s; }
        .gbp-tab-active { background: ${T.orange}; color: #fff; }
        .gbp-tab-inactive { background: transparent; color: ${T.muted}; }
        .gbp-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
        .gbp-section { font-size: 11px; font-weight: 700; color: ${T.orange}; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 16px; }
        .gbp-stat { text-align: center; }
        .gbp-stat-val { font-size: 28px; font-weight: 800; color: ${T.text}; }
        .gbp-stat-label { font-size: 11px; color: ${T.muted}; margin-top: 4px; }
        .gbp-input { width: 100%; padding: 10px 14px; background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 8px; font-size: 13px; color: ${T.text}; font-family: 'Inter', sans-serif; outline: none; resize: vertical; }
        .gbp-input:focus { border-color: rgba(232,106,42,0.4); }
        .gbp-btn { padding: 8px 16px; background: ${T.orange}; color: #fff; font-size: 12px; font-weight: 700; border: none; border-radius: 8px; cursor: pointer; }
        .gbp-btn:disabled { opacity: 0.5; }
        .gbp-btn-ghost { padding: 6px 12px; background: transparent; border: 1px solid ${T.border}; color: ${T.muted}; font-size: 11px; font-weight: 600; border-radius: 6px; cursor: pointer; }
        .gbp-stars { color: ${T.yellow}; font-size: 14px; letter-spacing: 1px; }
        @media (max-width: 900px) { .gbp-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } }
      `}</style>

      <div className="gbp-title">GOOGLE BUSINESS PROFILE</div>

      {connections.length === 0 ? (
        <div className="gbp-card" style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📍</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>No Google Business Profile Connected</div>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 20 }}>Connect your GBP to manage posts, reviews, and insights all from here.</div>
          <a href="/api/gbp/connect" className="gbp-btn" style={{ textDecoration: "none", display: "inline-block", padding: "12px 24px" }}>
            Connect Google Business Profile
          </a>
        </div>
      ) : (
        <>
          {/* Location selector if multiple */}
          {connections.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {connections.map(c => (
                <button key={c.id} onClick={() => setSelectedConn(c.id)} style={{
                  padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${selectedConn === c.id ? T.orange : T.border}`,
                  background: selectedConn === c.id ? `${T.orange}15` : T.surface,
                  color: selectedConn === c.id ? T.orange : T.text,
                }}>
                  {c.location_name || c.connected_email}
                </button>
              ))}
            </div>
          )}

          <div className="gbp-tabs">
            {(["overview", "posts", "reviews", "insights"] as const).map(t => (
              <button key={t} className={`gbp-tab ${tab === t ? "gbp-tab-active" : "gbp-tab-inactive"}`} onClick={() => setTab(t)}>
                {t === "overview" ? "Overview" : t === "posts" ? "Posts" : t === "reviews" ? "Reviews" : "Insights"}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW ── */}
          {tab === "overview" && conn && (
            <div>
              <div className="gbp-card">
                <div className="gbp-section">Connection</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{conn.location_name || "Business"}</div>
                    <div style={{ fontSize: 12, color: T.green, marginTop: 4 }}>{conn.connected_email}</div>
                  </div>
                  <div style={{ fontSize: 12, color: T.green, fontWeight: 600, background: `${T.green}15`, padding: "4px 12px", borderRadius: 8 }}>Connected</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div className="gbp-card gbp-stat">
                  <div style={{ fontSize: 12, color: conn.auto_review_reply_enabled ? T.green : T.muted, fontWeight: 600 }}>
                    {conn.auto_review_reply_enabled ? "ON" : "OFF"}
                  </div>
                  <div className="gbp-stat-label">Auto Review Reply</div>
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 6 }}>
                    Last check: {conn.last_review_check_at ? new Date(conn.last_review_check_at).toLocaleDateString() : "Never"}
                  </div>
                </div>
                <div className="gbp-card gbp-stat">
                  <div style={{ fontSize: 12, color: conn.auto_post_enabled ? T.green : T.muted, fontWeight: 600 }}>
                    {conn.auto_post_enabled ? "ON" : "OFF"}
                  </div>
                  <div className="gbp-stat-label">Weekly Auto Posts</div>
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 6 }}>
                    Last post: {conn.last_post_at ? new Date(conn.last_post_at).toLocaleDateString() : "Never"}
                  </div>
                </div>
                <div className="gbp-card gbp-stat">
                  <div style={{ fontSize: 12, color: conn.monthly_report_enabled ? T.green : T.muted, fontWeight: 600 }}>
                    {conn.monthly_report_enabled ? "ON" : "OFF"}
                  </div>
                  <div className="gbp-stat-label">Monthly Reports</div>
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 6 }}>
                    Last report: {conn.last_report_at ? new Date(conn.last_report_at).toLocaleDateString() : "Never"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── POSTS ── */}
          {tab === "posts" && (
            <div>
              <div className="gbp-card">
                <div className="gbp-section">Create Post</div>
                <textarea
                  className="gbp-input"
                  style={{ minHeight: 80, marginBottom: 12 }}
                  placeholder="Write a post for your Google Business Profile..."
                  value={newPostText}
                  onChange={e => setNewPostText(e.target.value)}
                />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button className="gbp-btn" disabled={posting || !newPostText.trim()} onClick={createPost}>
                    {posting ? "Posting..." : "Publish Post"}
                  </button>
                </div>
              </div>

              <div className="gbp-card">
                <div className="gbp-section">Recent Posts</div>
                {posts.length === 0 ? (
                  <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: 20 }}>No posts yet. Create one above or wait for the weekly auto-post.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {posts.map(p => (
                      <div key={p.id} style={{ padding: 14, background: "rgba(255,255,255,0.02)", borderRadius: 8, border: `1px solid ${T.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: T.orange, background: `${T.orange}15`, padding: "2px 8px", borderRadius: 4 }}>{p.post_type}</span>
                          <span style={{ fontSize: 11, color: T.muted }}>{new Date(p.posted_at).toLocaleDateString()}</span>
                        </div>
                        <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6 }}>{p.summary}</div>
                        {p.status === "failed" && <div style={{ fontSize: 11, color: T.red, marginTop: 6 }}>Failed to publish</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── REVIEWS ── */}
          {tab === "reviews" && (
            <div className="gbp-card">
              <div className="gbp-section">Reviews</div>
              {reviews.length === 0 ? (
                <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: 20 }}>No reviews fetched yet. Reviews are checked every 6 hours.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {reviews.map(r => (
                    <div key={r.id} style={{ padding: 16, background: "rgba(255,255,255,0.02)", borderRadius: 8, border: `1px solid ${T.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div>
                          <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{r.reviewer_name}</span>
                          <span className="gbp-stars" style={{ marginLeft: 10 }}>{"★".repeat(r.star_rating)}{"☆".repeat(5 - r.star_rating)}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                            background: r.reply_status === "replied" ? `${T.green}15` : r.reply_status === "skipped" ? "rgba(255,255,255,0.05)" : `${T.yellow}15`,
                            color: r.reply_status === "replied" ? T.green : r.reply_status === "skipped" ? T.muted : T.yellow,
                          }}>{r.reply_status.toUpperCase()}</span>
                          <span style={{ fontSize: 11, color: T.muted }}>{new Date(r.review_time).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {r.comment && <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6, marginBottom: 10 }}>{r.comment}</div>}

                      {r.reply_status === "replied" && r.reply_text && (
                        <div style={{ marginTop: 8, padding: 10, background: `${T.green}08`, borderRadius: 6, borderLeft: `3px solid ${T.green}` }}>
                          <div style={{ fontSize: 10, color: T.green, fontWeight: 700, marginBottom: 4 }}>YOUR REPLY</div>
                          <div style={{ fontSize: 12, color: T.text }}>{r.reply_text}</div>
                        </div>
                      )}

                      {r.reply_status === "pending" && (
                        <div style={{ marginTop: 10 }}>
                          {r.ai_suggested_reply && (
                            <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>
                              AI suggested: <span style={{ color: T.text }}>{r.ai_suggested_reply}</span>
                            </div>
                          )}
                          <textarea
                            className="gbp-input"
                            style={{ minHeight: 60, marginBottom: 8 }}
                            placeholder="Write your reply..."
                            value={replyText[r.id] || r.ai_suggested_reply || ""}
                            onChange={e => setReplyText(prev => ({ ...prev, [r.id]: e.target.value }))}
                          />
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button className="gbp-btn-ghost" onClick={() => skipReview(r.id)}>Skip</button>
                            <button className="gbp-btn" disabled={replying === r.id} onClick={() => replyToReview(r.id)}>
                              {replying === r.id ? "Replying..." : "Reply"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── INSIGHTS ── */}
          {tab === "insights" && (
            <div>
              {insights.length === 0 ? (
                <div className="gbp-card" style={{ textAlign: "center", padding: 40 }}>
                  <div style={{ color: T.muted, fontSize: 13 }}>No insights data yet. Monthly reports are generated automatically.</div>
                </div>
              ) : insights.map(ins => (
                <div key={ins.id} className="gbp-card">
                  <div className="gbp-section">
                    {new Date(ins.period_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — {new Date(ins.period_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }} className="gbp-grid-4">
                    <div className="gbp-stat">
                      <div className="gbp-stat-val">{((ins.search_impressions || 0) + (ins.maps_impressions || 0)).toLocaleString()}</div>
                      <div className="gbp-stat-label">Total Impressions</div>
                    </div>
                    <div className="gbp-stat">
                      <div className="gbp-stat-val" style={{ color: T.blue }}>{(ins.website_clicks || 0).toLocaleString()}</div>
                      <div className="gbp-stat-label">Website Clicks</div>
                    </div>
                    <div className="gbp-stat">
                      <div className="gbp-stat-val" style={{ color: T.green }}>{(ins.phone_calls || 0).toLocaleString()}</div>
                      <div className="gbp-stat-label">Phone Calls</div>
                    </div>
                    <div className="gbp-stat">
                      <div className="gbp-stat-val" style={{ color: T.orange }}>{(ins.direction_requests || 0).toLocaleString()}</div>
                      <div className="gbp-stat-label">Direction Requests</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 8 }}>IMPRESSIONS BREAKDOWN</div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, color: T.text }}>
                        <span>Google Search</span><span>{(ins.search_impressions || 0).toLocaleString()}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, color: T.text }}>
                        <span>Google Maps</span><span>{(ins.maps_impressions || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 8 }}>TOP SEARCH TERMS</div>
                      {(ins.top_search_terms || []).slice(0, 5).map((t, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, color: T.text }}>
                          <span>{t.term}</span><span style={{ color: T.muted }}>{t.impressions}</span>
                        </div>
                      ))}
                      {(!ins.top_search_terms || ins.top_search_terms.length === 0) && (
                        <div style={{ fontSize: 12, color: T.muted }}>No search term data</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
