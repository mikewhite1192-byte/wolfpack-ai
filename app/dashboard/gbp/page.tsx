"use client";
import { useState, useEffect, useCallback } from "react";
import { MapPin, Star } from "lucide-react";

interface GbpConnection { id: string; connected: boolean; connected_email: string; location_name: string; auto_post_enabled: boolean; auto_review_reply_enabled: boolean; monthly_report_enabled: boolean; report_phone: string; last_post_at: string | null; last_review_check_at: string | null; last_report_at: string | null; }
interface GbpPost { id: string; summary: string; post_type: string; status: string; cta_type: string | null; posted_at: string; }
interface GbpReview { id: string; reviewer_name: string; star_rating: number; comment: string; review_time: string; reply_text: string | null; reply_status: string; sentiment: string; ai_suggested_reply: string | null; }
interface GbpInsight { id: string; period_start: string; period_end: string; search_impressions: number; maps_impressions: number; website_clicks: number; phone_calls: number; direction_requests: number; top_search_terms: Array<{ term: string; impressions: number }>; }

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

  const fetchConnections = useCallback(async () => { const res = await fetch("/api/settings"); const data = await res.json(); if (data.gbpConnections) { setConnections(data.gbpConnections); if (data.gbpConnections.length > 0 && !selectedConn) setSelectedConn(data.gbpConnections[0].id); } setLoading(false); }, [selectedConn]);
  useEffect(() => { fetchConnections(); }, [fetchConnections]);
  useEffect(() => { if (!selectedConn) return; if (tab === "posts") fetch(`/api/gbp/posts?connectionId=${selectedConn}`).then(r => r.json()).then(d => setPosts(d.posts || [])); else if (tab === "reviews") fetch(`/api/gbp/reviews?connectionId=${selectedConn}`).then(r => r.json()).then(d => setReviews(d.reviews || [])); else if (tab === "insights") fetch(`/api/gbp/insights?connectionId=${selectedConn}`).then(r => r.json()).then(d => setInsights(d.insights || [])); }, [tab, selectedConn]);

  async function createPost() { if (!newPostText.trim() || !selectedConn) return; setPosting(true); await fetch("/api/gbp/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId: selectedConn, summary: newPostText }) }); setNewPostText(""); setPosting(false); fetch(`/api/gbp/posts?connectionId=${selectedConn}`).then(r => r.json()).then(d => setPosts(d.posts || [])); }
  async function replyToReview(reviewId: string) { const text = replyText[reviewId]; if (!text?.trim()) return; setReplying(reviewId); await fetch("/api/gbp/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reply", reviewId, replyText: text }) }); setReplying(""); fetch(`/api/gbp/reviews?connectionId=${selectedConn}`).then(r => r.json()).then(d => setReviews(d.reviews || [])); }
  async function skipReview(reviewId: string) { await fetch("/api/gbp/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "skip", reviewId }) }); fetch(`/api/gbp/reviews?connectionId=${selectedConn}`).then(r => r.json()).then(d => setReviews(d.reviews || [])); }

  const conn = connections.find(c => c.id === selectedConn);
  if (loading) return <div className="text-[#b0b4c8] py-10 text-center">Loading...</div>;

  return (
    <div>
      <div className="font-display text-[28px] text-[#e8eaf0] tracking-wide mb-6">GOOGLE BUSINESS PROFILE</div>

      {connections.length === 0 ? (
        <div className="bg-[#111] border border-white/[0.07] rounded-xl p-16 text-center">
          <MapPin className="w-12 h-12 text-[#E86A2A] mx-auto mb-4" />
          <div className="text-base font-semibold text-[#e8eaf0] mb-2">No Google Business Profile Connected</div>
          <div className="text-sm text-[#b0b4c8] mb-5">Connect your GBP to manage posts, reviews, and insights all from here.</div>
          <a href="/api/gbp/connect" className="inline-block px-6 py-3 bg-[#E86A2A] text-white rounded-xl text-sm font-bold no-underline hover:bg-[#ff7b3a] transition-colors">Connect Google Business Profile</a>
        </div>
      ) : (<>
        {connections.length > 1 && (
          <div className="flex gap-2 mb-4">
            {connections.map(c => (
              <button key={c.id} onClick={() => setSelectedConn(c.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border transition-all ${selectedConn === c.id ? "border-[#E86A2A] bg-[#E86A2A]/15 text-[#E86A2A]" : "border-white/[0.07] bg-[#111] text-[#e8eaf0] hover:border-white/[0.15]"}`}>
                {c.location_name || c.connected_email}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-1 bg-[#111] border border-white/[0.07] rounded-xl p-1 mb-6 w-full sm:w-fit overflow-x-auto">
          {(["overview", "posts", "reviews", "insights"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer border-none transition-all ${tab === t ? "bg-[#E86A2A] text-white" : "bg-transparent text-[#b0b4c8] hover:text-[#e8eaf0]"}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && conn && (<>
          <div className="bg-[#111] border border-white/[0.07] rounded-xl p-5 mb-4">
            <div className="text-[11px] font-bold text-[#E86A2A] tracking-[1.5px] uppercase mb-4">Connection</div>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-lg font-bold text-[#e8eaf0]">{conn.location_name || "Business"}</div>
                <div className="text-xs text-emerald-400 mt-1">{conn.connected_email}</div>
              </div>
              <div className="text-xs text-emerald-400 font-semibold bg-emerald-400/15 px-3 py-1 rounded-lg">Connected</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {[
              { label: "Auto Review Reply", on: conn.auto_review_reply_enabled, last: conn.last_review_check_at, lastLabel: "Last check" },
              { label: "Weekly Auto Posts", on: conn.auto_post_enabled, last: conn.last_post_at, lastLabel: "Last post" },
              { label: "Monthly Reports", on: conn.monthly_report_enabled, last: conn.last_report_at, lastLabel: "Last report" },
            ].map(s => (
              <div key={s.label} className="bg-[#111] border border-white/[0.07] rounded-xl p-5 text-center">
                <div className={`text-xs font-semibold ${s.on ? "text-emerald-400" : "text-[#b0b4c8]"}`}>{s.on ? "ON" : "OFF"}</div>
                <div className="text-[11px] text-[#b0b4c8] mt-1">{s.label}</div>
                <div className="text-[10px] text-[#b0b4c8] mt-1.5">{s.lastLabel}: {s.last ? new Date(s.last).toLocaleDateString() : "Never"}</div>
              </div>
            ))}
          </div>
        </>)}

        {/* Posts */}
        {tab === "posts" && (<>
          <div className="bg-[#111] border border-white/[0.07] rounded-xl p-5 mb-4">
            <div className="text-[11px] font-bold text-[#E86A2A] tracking-[1.5px] uppercase mb-4">Create Post</div>
            <textarea placeholder="Write a post for your Google Business Profile..." value={newPostText} onChange={e => setNewPostText(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#111] border border-white/[0.07] rounded-lg text-sm text-[#e8eaf0] outline-none resize-y min-h-[80px] mb-3 focus:border-[#E86A2A]/40 transition-colors" />
            <div className="flex justify-end">
              <button onClick={createPost} disabled={posting || !newPostText.trim()}
                className={`px-4 py-2 bg-[#E86A2A] text-white text-xs font-bold border-none rounded-lg cursor-pointer transition-colors ${posting ? "opacity-50" : "hover:bg-[#ff7b3a]"}`}>
                {posting ? "Posting..." : "Publish Post"}
              </button>
            </div>
          </div>
          <div className="bg-[#111] border border-white/[0.07] rounded-xl p-5">
            <div className="text-[11px] font-bold text-[#E86A2A] tracking-[1.5px] uppercase mb-4">Recent Posts</div>
            {posts.length === 0 ? <div className="text-[#b0b4c8] text-sm text-center py-5">No posts yet.</div> : (
              <div className="flex flex-col gap-3">
                {posts.map(p => (
                  <div key={p.id} className="p-3.5 bg-white/[0.02] rounded-lg border border-white/[0.07]">
                    <div className="flex justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase text-[#E86A2A] bg-[#E86A2A]/15 px-2 py-0.5 rounded">{p.post_type}</span>
                      <span className="text-[11px] text-[#b0b4c8]">{new Date(p.posted_at).toLocaleDateString()}</span>
                    </div>
                    <div className="text-sm text-[#e8eaf0] leading-relaxed">{p.summary}</div>
                    {p.status === "failed" && <div className="text-[11px] text-red-400 mt-1.5">Failed to publish</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>)}

        {/* Reviews */}
        {tab === "reviews" && (
          <div className="bg-[#111] border border-white/[0.07] rounded-xl p-5">
            <div className="text-[11px] font-bold text-[#E86A2A] tracking-[1.5px] uppercase mb-4">Reviews</div>
            {reviews.length === 0 ? <div className="text-[#b0b4c8] text-sm text-center py-5">No reviews fetched yet. Reviews are checked every 6 hours.</div> : (
              <div className="flex flex-col gap-4">
                {reviews.map(r => (
                  <div key={r.id} className="p-4 bg-white/[0.02] rounded-lg border border-white/[0.07]">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-semibold text-[#e8eaf0]">{r.reviewer_name}</span>
                        <span className="text-amber-400 text-sm tracking-wider flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-3.5 h-3.5 ${i < r.star_rating ? "fill-amber-400" : "fill-none text-white/20"}`} />)}
                        </span>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${r.reply_status === "replied" ? "bg-emerald-400/15 text-emerald-400" : r.reply_status === "skipped" ? "bg-white/5 text-[#b0b4c8]" : "bg-amber-400/15 text-amber-400"}`}>{r.reply_status.toUpperCase()}</span>
                        <span className="text-[11px] text-[#b0b4c8]">{new Date(r.review_time).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {r.comment && <div className="text-sm text-[#e8eaf0] leading-relaxed mb-2.5">{r.comment}</div>}
                    {r.reply_status === "replied" && r.reply_text && (
                      <div className="mt-2 p-2.5 bg-emerald-400/[0.08] rounded-md border-l-[3px] border-emerald-400">
                        <div className="text-[10px] text-emerald-400 font-bold mb-1">YOUR REPLY</div>
                        <div className="text-xs text-[#e8eaf0]">{r.reply_text}</div>
                      </div>
                    )}
                    {r.reply_status === "pending" && (
                      <div className="mt-2.5">
                        {r.ai_suggested_reply && <div className="text-[11px] text-[#b0b4c8] mb-1.5">AI suggested: <span className="text-[#e8eaf0]">{r.ai_suggested_reply}</span></div>}
                        <textarea placeholder="Write your reply..." value={replyText[r.id] || r.ai_suggested_reply || ""} onChange={e => setReplyText(prev => ({ ...prev, [r.id]: e.target.value }))}
                          className="w-full px-3 py-2 bg-[#111] border border-white/[0.07] rounded-lg text-sm text-[#e8eaf0] outline-none resize-y min-h-[60px] mb-2 focus:border-[#E86A2A]/40 transition-colors" />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => skipReview(r.id)} className="px-3 py-1.5 bg-transparent border border-white/[0.07] text-[#b0b4c8] text-[11px] font-semibold rounded-md cursor-pointer hover:bg-white/[0.04] transition-colors">Skip</button>
                          <button onClick={() => replyToReview(r.id)} disabled={replying === r.id}
                            className={`px-4 py-1.5 bg-[#E86A2A] text-white text-xs font-bold border-none rounded-md cursor-pointer transition-colors ${replying === r.id ? "opacity-50" : "hover:bg-[#ff7b3a]"}`}>
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

        {/* Insights */}
        {tab === "insights" && (<>
          {insights.length === 0 ? (
            <div className="bg-[#111] border border-white/[0.07] rounded-xl p-10 text-center text-[#b0b4c8] text-sm">No insights data yet. Monthly reports are generated automatically.</div>
          ) : insights.map(ins => (
            <div key={ins.id} className="bg-[#111] border border-white/[0.07] rounded-xl p-5 mb-4">
              <div className="text-[11px] font-bold text-[#E86A2A] tracking-[1.5px] uppercase mb-4">
                {new Date(ins.period_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — {new Date(ins.period_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                {[
                  { value: ((ins.search_impressions || 0) + (ins.maps_impressions || 0)).toLocaleString(), label: "Total Impressions" },
                  { value: (ins.website_clicks || 0).toLocaleString(), label: "Website Clicks", color: "#3498db" },
                  { value: (ins.phone_calls || 0).toLocaleString(), label: "Phone Calls", color: "#2ecc71" },
                  { value: (ins.direction_requests || 0).toLocaleString(), label: "Direction Requests", color: "#E86A2A" },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className="text-[28px] font-extrabold" style={{ color: s.color || "#e8eaf0" }}>{s.value}</div>
                    <div className="text-[11px] text-[#b0b4c8] mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] text-[#b0b4c8] font-semibold mb-2 uppercase">Impressions Breakdown</div>
                  {[{ label: "Google Search", value: ins.search_impressions || 0 }, { label: "Google Maps", value: ins.maps_impressions || 0 }].map(r => (
                    <div key={r.label} className="flex justify-between py-1.5 text-sm text-[#e8eaf0]"><span>{r.label}</span><span>{r.value.toLocaleString()}</span></div>
                  ))}
                </div>
                <div>
                  <div className="text-[11px] text-[#b0b4c8] font-semibold mb-2 uppercase">Top Search Terms</div>
                  {(ins.top_search_terms || []).slice(0, 5).map((t, i) => (
                    <div key={i} className="flex justify-between py-1.5 text-sm text-[#e8eaf0]"><span>{t.term}</span><span className="text-[#b0b4c8]">{t.impressions}</span></div>
                  ))}
                  {(!ins.top_search_terms || ins.top_search_terms.length === 0) && <div className="text-xs text-[#b0b4c8]">No search term data</div>}
                </div>
              </div>
            </div>
          ))}
        </>)}
      </>)}
    </div>
  );
}
