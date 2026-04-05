"use client";

import { useState } from "react";
import Link from "next/link";
import { Globe, Shield, Smartphone, Search, FileText, Zap, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Download, Loader2 } from "lucide-react";

interface CheckResult {
  name: string;
  category: "performance" | "seo" | "security" | "mobile" | "content";
  score: number;
  status: "good" | "warning" | "bad";
  detail: string;
}

interface ScoreResult {
  url: string;
  domain: string;
  title: string;
  score: number;
  grade: string;
  checks: CheckResult[];
  summary: { good: number; warning: number; bad: number; total: number };
  lighthouse: { performance: number | null; accessibility: number | null; seo: number | null };
  loadTimeMs: number;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  performance: <Zap className="w-4 h-4" />,
  seo: <Search className="w-4 h-4" />,
  security: <Shield className="w-4 h-4" />,
  mobile: <Smartphone className="w-4 h-4" />,
  content: <FileText className="w-4 h-4" />,
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  good: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  bad: <XCircle className="w-4 h-4 text-red-400" />,
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

export default function WebsiteScorePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState("");
  const [showCapture, setShowCapture] = useState(false);
  const [captureEmail, setCaptureEmail] = useState("");
  const [captureName, setCaptureName] = useState("");
  const [capturePhone, setCapturePhone] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  async function handleScore() {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/score/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch {
      setError("Failed to score website. Please try again.");
    }
    setLoading(false);
  }

  async function handleCapture() {
    if (!captureEmail.trim()) return;
    setCapturing(true);
    // Save lead
    await fetch("/api/score/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: captureEmail.trim(),
        name: captureName.trim() || null,
        phone: capturePhone.trim() || null,
        url: result?.url,
        score: result?.score,
        grade: result?.grade,
        type: "website",
      }),
    });
    // Send report email
    await fetch("/api/score/send-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "website",
        email: captureEmail.trim(),
        name: captureName.trim() || null,
        reportData: {
          domain: result?.domain,
          title: result?.title,
          score: result?.score,
          grade: result?.grade,
          checks: result?.checks,
          summary: result?.summary,
        },
      }),
    }).catch(() => {}); // Non-fatal if email fails
    setCapturing(false);
    setCaptured(true);
    setShowCapture(false);
  }

  const categories = result ? [...new Set(result.checks.map(c => c.category))] : [];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e8eaf0] font-sans">
      {/* Nav */}
      <nav className="fixed top-4 left-4 right-4 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl px-8 h-14 flex items-center justify-between">
        <Link href="/" className="font-display text-xl tracking-[2px] text-[#e8eaf0] no-underline">
          THE <span className="text-[#E86A2A]">WOLF</span> PACK
        </Link>
        <Link href="/" className="text-sm text-[#b0b4c8] no-underline hover:text-white transition-colors">
          ← Back to home
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-[#E86A2A]/15 border border-[#E86A2A]/30 rounded-full text-[11px] font-semibold text-[#E86A2A] tracking-widest uppercase mb-6">
            <Globe className="w-3 h-3" /> Free Website Audit
          </div>
          <h1 className="font-display text-[clamp(36px,6vw,56px)] tracking-wide leading-tight mb-4">
            HOW DOES YOUR <span className="text-[#E86A2A]">WEBSITE SCORE?</span>
          </h1>
          <p className="text-base text-[#b0b4c8] max-w-lg mx-auto leading-relaxed">
            Get an instant audit of your website&apos;s performance, SEO, security, and mobile readiness. Free. No signup required.
          </p>
        </div>

        {/* Input */}
        <div className="flex gap-3 mb-8 max-w-xl mx-auto">
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleScore()}
            placeholder="Enter your website URL..."
            className="flex-1 px-5 py-4 bg-[#111] border border-white/[0.07] rounded-xl text-base text-[#e8eaf0] outline-none focus:border-[#E86A2A]/40 transition-colors"
          />
          <button
            onClick={handleScore}
            disabled={loading || !url.trim()}
            className={`px-8 py-4 rounded-xl text-base font-bold border-none cursor-pointer whitespace-nowrap transition-all flex items-center gap-2 ${
              loading || !url.trim()
                ? "bg-white/5 text-[#b0b4c8] cursor-not-allowed"
                : "bg-[#E86A2A] text-white hover:bg-[#ff7b3a] shadow-[0_4px_20px_rgba(232,106,42,0.3)]"
            }`}
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning...</> : <>Score My Site <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>

        {error && <div className="text-center text-red-400 text-sm mb-6">{error}</div>}

        {loading && (
          <div className="text-center py-16">
            <Loader2 className="w-10 h-10 text-[#E86A2A] mx-auto mb-4 animate-spin" />
            <div className="text-base font-semibold text-[#e8eaf0] mb-2">Analyzing your website...</div>
            <div className="text-sm text-[#b0b4c8]">Running performance, SEO, and security checks. This may take 15-30 seconds.</div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div>
            {/* Score Card */}
            <div className="bg-[#111] border border-white/[0.07] rounded-2xl p-8 mb-6 flex flex-col md:flex-row items-center gap-8">
              <ScoreRing score={result.score} grade={result.grade} />
              <div className="flex-1 text-center md:text-left">
                <div className="font-display text-2xl tracking-wider mb-1">{result.domain}</div>
                <div className="text-sm text-[#b0b4c8] mb-4">{result.title}</div>
                <div className="flex gap-4 justify-center md:justify-start">
                  <div className="text-center">
                    <div className="text-lg font-bold text-emerald-400">{result.summary.good}</div>
                    <div className="text-[10px] text-[#b0b4c8] uppercase">Passed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-amber-400">{result.summary.warning}</div>
                    <div className="text-[10px] text-[#b0b4c8] uppercase">Warnings</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-red-400">{result.summary.bad}</div>
                    <div className="text-[10px] text-[#b0b4c8] uppercase">Failed</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Lighthouse scores if available */}
            {(result.lighthouse.performance !== null || result.lighthouse.seo !== null) && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { label: "Performance", value: result.lighthouse.performance },
                  { label: "SEO", value: result.lighthouse.seo },
                  { label: "Accessibility", value: result.lighthouse.accessibility },
                ].map(l => l.value !== null && (
                  <div key={l.label} className="bg-[#111] border border-white/[0.07] rounded-xl p-4 text-center">
                    <div className="text-2xl font-extrabold" style={{ color: (l.value ?? 0) >= 70 ? "#2ecc71" : (l.value ?? 0) >= 40 ? "#f5a623" : "#e74c3c" }}>{l.value}</div>
                    <div className="text-[11px] text-[#b0b4c8] uppercase mt-1">{l.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Checks by category */}
            {categories.map(cat => {
              const catChecks = result.checks.filter(c => c.category === cat);
              const catScore = Math.round(catChecks.reduce((s, c) => s + c.score, 0) / catChecks.length);
              const isExpanded = expandedCategory === cat || expandedCategory === null;

              return (
                <div key={cat} className="mb-3">
                  <button
                    onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)}
                    className="w-full flex items-center gap-3 px-5 py-4 bg-[#111] border border-white/[0.07] rounded-xl cursor-pointer hover:border-white/[0.12] transition-colors text-left"
                  >
                    <span className="text-[#E86A2A]">{CATEGORY_ICONS[cat]}</span>
                    <span className="text-sm font-semibold text-[#e8eaf0] capitalize flex-1">{cat}</span>
                    <span className="text-sm font-bold" style={{ color: catScore >= 70 ? "#2ecc71" : catScore >= 40 ? "#f5a623" : "#e74c3c" }}>{catScore}%</span>
                    <span className="text-xs text-[#b0b4c8]">{catChecks.length} checks</span>
                  </button>

                  {isExpanded && (
                    <div className="mt-1 space-y-1">
                      {catChecks.map((check, i) => (
                        <div key={i} className="flex items-start gap-3 px-5 py-3 bg-[#0d0d0d] border border-white/[0.04] rounded-lg ml-4">
                          {STATUS_ICONS[check.status]}
                          <div className="flex-1">
                            <div className="text-sm font-medium text-[#e8eaf0]">{check.name}</div>
                            <div className="text-xs text-[#b0b4c8] mt-0.5 leading-relaxed">{check.detail}</div>
                          </div>
                          <div className="text-xs font-bold" style={{ color: check.score >= 70 ? "#2ecc71" : check.score >= 40 ? "#f5a623" : "#e74c3c" }}>{check.score}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* PDF Download CTA */}
            {!captured ? (
              <div className="mt-8 bg-[#111] border border-[#E86A2A]/20 rounded-2xl p-8 text-center">
                <Download className="w-8 h-8 text-[#E86A2A] mx-auto mb-3" />
                <h3 className="font-display text-xl tracking-wider mb-2">DOWNLOAD FULL REPORT</h3>
                <p className="text-sm text-[#b0b4c8] mb-5">Get a branded PDF report with all {result.checks.length} checks, scores, and recommendations.</p>
                {!showCapture ? (
                  <button onClick={() => setShowCapture(true)}
                    className="px-8 py-3 bg-[#E86A2A] text-white rounded-xl text-sm font-bold border-none cursor-pointer hover:bg-[#ff7b3a] transition-colors shadow-[0_4px_20px_rgba(232,106,42,0.3)]">
                    Get My Free Report →
                  </button>
                ) : (
                  <div className="max-w-sm mx-auto space-y-3">
                    <input value={captureEmail} onChange={e => setCaptureEmail(e.target.value)} placeholder="Your email *" type="email"
                      className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/[0.07] rounded-lg text-sm text-[#e8eaf0] outline-none focus:border-[#E86A2A]/40 transition-colors" />
                    <input value={captureName} onChange={e => setCaptureName(e.target.value)} placeholder="Your name (optional)"
                      className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/[0.07] rounded-lg text-sm text-[#e8eaf0] outline-none focus:border-[#E86A2A]/40 transition-colors" />
                    <input value={capturePhone} onChange={e => setCapturePhone(e.target.value)} placeholder="Phone (optional)"
                      className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/[0.07] rounded-lg text-sm text-[#e8eaf0] outline-none focus:border-[#E86A2A]/40 transition-colors" />
                    <button onClick={handleCapture} disabled={capturing || !captureEmail.trim()}
                      className={`w-full py-3 rounded-xl text-sm font-bold border-none cursor-pointer transition-colors ${capturing || !captureEmail.trim() ? "bg-white/5 text-[#b0b4c8] cursor-not-allowed" : "bg-[#E86A2A] text-white hover:bg-[#ff7b3a]"}`}>
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

            {/* Bottom CTA */}
            <div className="mt-12 text-center">
              <p className="text-sm text-[#b0b4c8] mb-4">Want help fixing these issues? Wolf Pack builds high-converting websites for service businesses.</p>
              <Link href="/book-demo" className="inline-flex items-center gap-2 px-8 py-3 bg-transparent border border-[#E86A2A]/30 text-[#E86A2A] rounded-xl text-sm font-bold no-underline hover:bg-[#E86A2A]/10 transition-colors">
                Book a Free Consultation →
              </Link>
            </div>
          </div>
        )}

        {/* Trust line */}
        {!result && !loading && (
          <div className="text-center mt-16">
            <div className="text-xs text-[#b0b4c8] uppercase tracking-widest mb-3">What we check</div>
            <div className="flex flex-wrap justify-center gap-3">
              {["Page Speed", "SSL Security", "Mobile Ready", "SEO Tags", "Open Graph", "Schema Markup", "Accessibility", "Image Alt Text", "Google Lighthouse"].map(tag => (
                <div key={tag} className="px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-full text-xs text-[#b0b4c8]">{tag}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] py-8 text-center">
        <div className="font-display text-sm text-white/20 tracking-wider">THE <span className="text-[#E86A2A]/20">WOLF</span> PACK</div>
        <div className="text-[11px] text-white/10 mt-2">Free website audit tool · No signup required</div>
      </footer>
    </div>
  );
}
