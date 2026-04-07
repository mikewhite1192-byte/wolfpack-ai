"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Star, Camera, MessageSquareText, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Download, Loader2, Lightbulb } from "lucide-react";

interface CheckResult {
  name: string;
  category: "reviews" | "completeness" | "engagement" | "visibility";
  score: number;
  status: "good" | "warning" | "bad";
  detail: string;
  tip: string;
}

interface ScoreResult {
  businessName: string;
  score: number;
  grade: string;
  checks: CheckResult[];
  summary: { good: number; warning: number; bad: number; total: number };
}

const CATEGORY_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  reviews: { label: "Reviews & Reputation", icon: <Star className="w-4 h-4" /> },
  completeness: { label: "Profile Completeness", icon: <MapPin className="w-4 h-4" /> },
  engagement: { label: "Engagement & Activity", icon: <Camera className="w-4 h-4" /> },
  visibility: { label: "Visibility & Features", icon: <MessageSquareText className="w-4 h-4" /> },
};

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#2ecc71" : score >= 60 ? "#f5a623" : "#e74c3c";
  return (
    <div className="relative w-[140px] h-[140px]">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle cx="60" cy="60" r="54" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-4xl font-extrabold text-[#e8eaf0]">{score}</div>
        <div className="text-sm font-bold" style={{ color }}>{grade}</div>
      </div>
    </div>
  );
}

export default function GbpScorePage() {
  const [businessName, setBusinessName] = useState("");
  const [reviewCount, setReviewCount] = useState("");
  const [avgRating, setAvgRating] = useState("");
  const [photoCount, setPhotoCount] = useState("");
  const [postsPerMonth, setPostsPerMonth] = useState("");
  const [hasHours, setHasHours] = useState(true);
  const [hasDescription, setHasDescription] = useState(true);
  const [hasCategories, setHasCategories] = useState(true);
  const [hasWebsite, setHasWebsite] = useState(true);
  const [hasPhone, setHasPhone] = useState(true);
  const [respondsToReviews, setRespondsToReviews] = useState(false);
  const [hasServiceArea, setHasServiceArea] = useState(false);
  const [hasProducts, setHasProducts] = useState(false);
  const [hasAppointmentLink, setHasAppointmentLink] = useState(false);
  const [hasMessaging, setHasMessaging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [showCapture, setShowCapture] = useState(false);
  const [captureEmail, setCaptureEmail] = useState("");
  const [captureName, setCaptureName] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState(false);

  async function handleScore() {
    if (!businessName.trim()) return;
    setLoading(true);
    const res = await fetch("/api/score/gbp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName, reviewCount: parseInt(reviewCount) || 0, avgRating: parseFloat(avgRating) || 0,
        photoCount: parseInt(photoCount) || 0, postsPerMonth: parseInt(postsPerMonth) || 0,
        hasHours, hasDescription, hasCategories, hasWebsite, hasPhone,
        respondsToReviews, hasServiceArea, hasProducts, hasAppointmentLink, hasMessaging,
      }),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  async function handleCapture() {
    if (!captureEmail.trim()) return;
    setCapturing(true);
    // Save lead
    await fetch("/api/score/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: captureEmail, name: captureName, url: businessName, score: result?.score, grade: result?.grade, type: "gbp" }),
    });
    // Send report email
    await fetch("/api/score/send-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "gbp",
        email: captureEmail.trim(),
        name: captureName.trim() || null,
        reportData: {
          businessName: result?.businessName,
          score: result?.score,
          grade: result?.grade,
          checks: result?.checks,
          summary: result?.summary,
        },
      }),
    }).catch(() => {});
    setCapturing(false);
    setCaptured(true);
    setShowCapture(false);
  }

  const inputClass = "w-full px-4 py-3 bg-[#111] border border-white/[0.07] rounded-xl text-sm text-[#e8eaf0] outline-none focus:border-[#E86A2A]/40 transition-colors";

  function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
    return (
      <div className="flex items-center justify-between py-2.5 cursor-pointer" onClick={onChange}>
        <span className="text-sm text-[#e8eaf0]">{label}</span>
        <div className={`w-10 h-[22px] rounded-full transition-colors relative flex-shrink-0 ${on ? "bg-emerald-400" : "bg-white/10"}`}>
          <div className={`w-[18px] h-[18px] rounded-full bg-white absolute top-0.5 transition-all ${on ? "left-5" : "left-0.5"}`} />
        </div>
      </div>
    );
  }

  const categories = result ? [...new Set(result.checks.map(c => c.category))] : [];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e8eaf0] font-sans">
      <nav className="fixed top-4 left-4 right-4 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl px-4 sm:px-8 h-14 flex items-center justify-between">
        <Link href="/" className="font-display text-lg sm:text-xl tracking-[2px] text-[#e8eaf0] no-underline">THE <span className="text-[#E86A2A]">WOLF</span> PACK</Link>
        <div className="flex gap-2 sm:gap-4">
          <Link href="/score" className="text-xs sm:text-sm text-[#b0b4c8] no-underline hover:text-white transition-colors">Website Scorer</Link>
          <Link href="/" className="text-xs sm:text-sm text-[#b0b4c8] no-underline hover:text-white transition-colors">← Home</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-[#E86A2A]/15 border border-[#E86A2A]/30 rounded-full text-[11px] font-semibold text-[#E86A2A] tracking-widest uppercase mb-6">
            <MapPin className="w-3 h-3" /> Free GBP Audit
          </div>
          <h1 className="font-display text-[clamp(36px,6vw,56px)] tracking-wide leading-tight mb-4">
            SCORE YOUR <span className="text-[#E86A2A]">GOOGLE BUSINESS PROFILE</span>
          </h1>
          <p className="text-base text-[#b0b4c8] max-w-lg mx-auto leading-relaxed">
            Find out how your Google Business Profile stacks up. Get actionable tips to rank higher in local search.
          </p>
        </div>

        {!result ? (
          <div className="bg-[#111] border border-white/[0.07] rounded-2xl p-8 max-w-xl mx-auto">
            <div className="mb-5">
              <label className="text-xs font-bold text-[#b0b4c8] uppercase tracking-wider mb-1.5 block">Business Name *</label>
              <input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g., Summit Roofing" className={inputClass} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <div>
                <label className="text-xs font-bold text-[#b0b4c8] uppercase tracking-wider mb-1.5 block">Reviews</label>
                <input type="number" value={reviewCount} onChange={e => setReviewCount(e.target.value)} placeholder="0" className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-bold text-[#b0b4c8] uppercase tracking-wider mb-1.5 block">Avg Rating</label>
                <input type="number" step="0.1" max="5" value={avgRating} onChange={e => setAvgRating(e.target.value)} placeholder="4.5" className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-bold text-[#b0b4c8] uppercase tracking-wider mb-1.5 block">Photos</label>
                <input type="number" value={photoCount} onChange={e => setPhotoCount(e.target.value)} placeholder="0" className={inputClass} />
              </div>
            </div>

            <div className="mb-5">
              <label className="text-xs font-bold text-[#b0b4c8] uppercase tracking-wider mb-1.5 block">Posts per month</label>
              <input type="number" value={postsPerMonth} onChange={e => setPostsPerMonth(e.target.value)} placeholder="0" className={inputClass} />
            </div>

            <div className="border-t border-white/[0.07] pt-4 mb-4">
              <div className="text-xs font-bold text-[#b0b4c8] uppercase tracking-wider mb-3">Profile Features</div>
              <Toggle on={hasHours} onChange={() => setHasHours(!hasHours)} label="Business hours listed" />
              <Toggle on={hasDescription} onChange={() => setHasDescription(!hasDescription)} label="Business description filled" />
              <Toggle on={hasCategories} onChange={() => setHasCategories(!hasCategories)} label="Categories set" />
              <Toggle on={hasWebsite} onChange={() => setHasWebsite(!hasWebsite)} label="Website linked" />
              <Toggle on={hasPhone} onChange={() => setHasPhone(!hasPhone)} label="Phone number listed" />
              <Toggle on={respondsToReviews} onChange={() => setRespondsToReviews(!respondsToReviews)} label="Responds to reviews" />
              <Toggle on={hasServiceArea} onChange={() => setHasServiceArea(!hasServiceArea)} label="Service area defined" />
              <Toggle on={hasProducts} onChange={() => setHasProducts(!hasProducts)} label="Products/services listed" />
              <Toggle on={hasAppointmentLink} onChange={() => setHasAppointmentLink(!hasAppointmentLink)} label="Booking/appointment link" />
              <Toggle on={hasMessaging} onChange={() => setHasMessaging(!hasMessaging)} label="Messaging enabled" />
            </div>

            <button onClick={handleScore} disabled={loading || !businessName.trim()}
              className={`w-full py-4 rounded-xl text-base font-bold border-none cursor-pointer flex items-center justify-center gap-2 transition-all ${
                loading || !businessName.trim() ? "bg-white/5 text-[#b0b4c8] cursor-not-allowed" : "bg-[#E86A2A] text-white hover:bg-[#ff7b3a] shadow-[0_4px_20px_rgba(232,106,42,0.3)]"
              }`}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Scoring...</> : <>Score My GBP <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        ) : (
          <div>
            {/* Score Card */}
            <div className="bg-[#111] border border-white/[0.07] rounded-2xl p-8 mb-6 flex flex-col md:flex-row items-center gap-8">
              <ScoreRing score={result.score} grade={result.grade} />
              <div className="flex-1 text-center md:text-left">
                <div className="font-display text-2xl tracking-wider mb-1">{result.businessName}</div>
                <div className="text-sm text-[#b0b4c8] mb-4">Google Business Profile Score</div>
                <div className="flex gap-4 justify-center md:justify-start">
                  <div className="text-center"><div className="text-lg font-bold text-emerald-400">{result.summary.good}</div><div className="text-[10px] text-[#b0b4c8] uppercase">Passed</div></div>
                  <div className="text-center"><div className="text-lg font-bold text-amber-400">{result.summary.warning}</div><div className="text-[10px] text-[#b0b4c8] uppercase">Warnings</div></div>
                  <div className="text-center"><div className="text-lg font-bold text-red-400">{result.summary.bad}</div><div className="text-[10px] text-[#b0b4c8] uppercase">Failed</div></div>
                </div>
              </div>
            </div>

            {/* Checks by category */}
            {categories.map(cat => {
              const catChecks = result.checks.filter(c => c.category === cat);
              const catScore = Math.round(catChecks.reduce((s, c) => s + c.score, 0) / catChecks.length);
              const catInfo = CATEGORY_LABELS[cat] || { label: cat, icon: null };

              return (
                <div key={cat} className="mb-3">
                  <div className="flex items-center gap-3 px-5 py-4 bg-[#111] border border-white/[0.07] rounded-xl">
                    <span className="text-[#E86A2A]">{catInfo.icon}</span>
                    <span className="text-sm font-semibold text-[#e8eaf0] flex-1">{catInfo.label}</span>
                    <span className="text-sm font-bold" style={{ color: catScore >= 70 ? "#2ecc71" : catScore >= 40 ? "#f5a623" : "#e74c3c" }}>{catScore}%</span>
                  </div>

                  <div className="mt-1 space-y-1">
                    {catChecks.map((check, i) => (
                      <div key={i} className="px-5 py-3 bg-[#0d0d0d] border border-white/[0.04] rounded-lg ml-4">
                        <div className="flex items-start gap-3">
                          {check.status === "good" ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" /> : check.status === "warning" ? <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />}
                          <div className="flex-1">
                            <div className="text-sm font-medium text-[#e8eaf0]">{check.name}</div>
                            <div className="text-xs text-[#b0b4c8] mt-0.5">{check.detail}</div>
                            <div className="flex items-start gap-1.5 mt-1.5 text-xs text-[#E86A2A]">
                              <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              <span>{check.tip}</span>
                            </div>
                          </div>
                          <div className="text-xs font-bold" style={{ color: check.score >= 70 ? "#2ecc71" : check.score >= 40 ? "#f5a623" : "#e74c3c" }}>{check.score}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Score again */}
            <div className="mt-6 text-center">
              <button onClick={() => setResult(null)} className="text-sm text-[#b0b4c8] hover:text-[#E86A2A] transition-colors cursor-pointer bg-transparent border-none">
                ← Score another business
              </button>
            </div>

            {/* Lead capture */}
            {!captured ? (
              <div className="mt-8 bg-[#111] border border-[#E86A2A]/20 rounded-2xl p-8 text-center">
                <Download className="w-8 h-8 text-[#E86A2A] mx-auto mb-3" />
                <h3 className="font-display text-xl tracking-wider mb-2">GET YOUR GBP REPORT</h3>
                <p className="text-sm text-[#b0b4c8] mb-5">Download a branded PDF with all {result.checks.length} checks, scores, and improvement tips.</p>
                {!showCapture ? (
                  <button onClick={() => setShowCapture(true)} className="px-8 py-3 bg-[#E86A2A] text-white rounded-xl text-sm font-bold border-none cursor-pointer hover:bg-[#ff7b3a] transition-colors shadow-[0_4px_20px_rgba(232,106,42,0.3)]">
                    Get My Free Report →
                  </button>
                ) : (
                  <div className="max-w-sm mx-auto space-y-3">
                    <input value={captureEmail} onChange={e => setCaptureEmail(e.target.value)} placeholder="Your email *" type="email" className={inputClass} />
                    <input value={captureName} onChange={e => setCaptureName(e.target.value)} placeholder="Your name (optional)" className={inputClass} />
                    <button onClick={handleCapture} disabled={capturing || !captureEmail.trim()}
                      className={`w-full py-3 rounded-xl text-sm font-bold border-none cursor-pointer transition-colors ${capturing || !captureEmail.trim() ? "bg-white/5 text-[#b0b4c8]" : "bg-[#E86A2A] text-white hover:bg-[#ff7b3a]"}`}>
                      {capturing ? "Sending..." : "Send My Report →"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-8 bg-emerald-400/[0.08] border border-emerald-400/20 rounded-2xl p-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                <h3 className="font-display text-xl tracking-wider text-emerald-400 mb-2">REPORT SENT</h3>
                <p className="text-sm text-[#b0b4c8]">Check your email for the full branded PDF report.</p>
              </div>
            )}

            <div className="mt-12 text-center">
              <p className="text-sm text-[#b0b4c8] mb-4">Want us to manage your Google Business Profile? Wolf Pack handles posts, reviews, and reporting on autopilot.</p>
              <Link href="/book-demo" className="inline-flex items-center gap-2 px-8 py-3 bg-transparent border border-[#E86A2A]/30 text-[#E86A2A] rounded-xl text-sm font-bold no-underline hover:bg-[#E86A2A]/10 transition-colors">
                Book a Free Consultation →
              </Link>
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-white/[0.04] py-8 text-center">
        <div className="font-display text-sm text-white/20 tracking-wider">THE <span className="text-[#E86A2A]/20">WOLF</span> PACK</div>
        <div className="text-[11px] text-white/10 mt-2">Free GBP audit tool · No signup required</div>
      </footer>
    </div>
  );
}
