"use client";

import { useState } from "react";
import { Brain, Loader2, RefreshCw } from "lucide-react";

const T = { orange: "#E86A2A", text: "#e8eaf0", muted: "#b0b4c8", surface: "#111111", border: "rgba(255,255,255,0.07)", green: "#2ecc71", red: "#e74c3c", blue: "#3B82F6" };

export default function AIBrief() {
  const [brief, setBrief] = useState("");
  const [generating, setGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  async function generateBrief() {
    setGenerating(true);
    try {
      // Gather all financial data
      const [nwRes, acctRes, stmtRes] = await Promise.all([
        fetch("/api/finance/net-worth"),
        fetch("/api/finance/personal-accounts"),
        fetch("/api/finance/statements?type=business"),
      ]);

      const nw = await nwRes.json();
      const accts = await acctRes.json();
      const stmts = await stmtRes.json();

      const summary = `
PERSONAL FINANCES:
- Personal Net Worth: $${(nw.personalNetWorth || 0).toLocaleString()}
- Combined Net Worth (personal + business): $${(nw.combinedNetWorth || 0).toLocaleString()}
- Assets: Checking/Savings $${((nw.assets?.checking || 0) + (nw.assets?.savings || 0)).toLocaleString()}, Investments $${(nw.assets?.investments || 0).toLocaleString()}, Retirement $${(nw.assets?.retirement || 0).toLocaleString()}
- Liabilities: Credit Card Debt $${(nw.liabilities?.creditCards || 0).toLocaleString()}
- Month-over-month change: $${(nw.monthChange || 0).toLocaleString()}

ACCOUNTS:
${(accts.accounts || []).map((a: { name: string; type: string; current_balance: number }) => `- ${a.name} (${a.type}): $${(parseFloat(String(a.current_balance)) || 0).toLocaleString()}`).join("\n")}

BUSINESS:
- YTD Revenue: $${(parseFloat(String(stmts.ytd?.ytd_revenue)) || 0).toLocaleString()}
- YTD Expenses: $${(parseFloat(String(stmts.ytd?.ytd_expenses)) || 0).toLocaleString()}
- Net Profit: $${((parseFloat(String(stmts.ytd?.ytd_revenue)) || 0) - (parseFloat(String(stmts.ytd?.ytd_expenses)) || 0)).toLocaleString()}
- Statements uploaded: ${(stmts.statements || []).length}
      `.trim();

      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: `You are Mike's personal financial advisor. You analyze his complete financial picture and give him a monthly brief in plain English.

Your tone: direct, honest, no fluff. Mike is a founder running The Wolf Pack Co LLC (web dev, software, AI). He's in his early career building a business. Talk to him like a smart friend who happens to know finance, not like a banker.

Structure your brief as:
1. NET WORTH UPDATE — what changed and why (one paragraph)
2. TOP 3 WINS — positive things to reinforce (bullet points)
3. TOP 3 ACTIONS — specific, ranked by dollar impact (bullet points with exact amounts)
4. DEBT CHECK — credit card status, progress, next step
5. SAVINGS CHECK — rate vs target, emergency fund progress
6. BUSINESS CHECK — revenue/expense trend, tax preparation status
7. ONE THING TO DO THIS WEEK — single highest-impact action

Keep the entire brief under 400 words. Be specific with numbers. No generic advice — everything should reference his actual data. If data is missing or zero, acknowledge it and tell him what to set up first.`,
          prompt: `Here is my current financial snapshot. Give me my monthly brief:\n\n${summary}`,
          maxTokens: 800,
        }),
      });

      const data = await res.json();
      setBrief(data.text || data.content || "Failed to generate brief. Try again.");
      setLastGenerated(new Date().toLocaleString());
    } catch {
      setBrief("Failed to generate brief — check your connection and try again.");
    }
    setGenerating(false);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Brain style={{ width: 20, height: 20, color: T.blue }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>AI Monthly Brief</div>
          <div style={{ fontSize: 12, color: T.muted }}>Claude analyzes your complete financial picture and tells you exactly what to do.</div>
        </div>
      </div>

      {!brief ? (
        <div style={{ background: T.surface, border: `2px dashed ${T.border}`, borderRadius: 16, padding: 60, textAlign: "center" }}>
          <Brain style={{ width: 48, height: 48, color: T.blue, margin: "0 auto 16px", opacity: 0.5 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8 }}>Generate Your Monthly Brief</div>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 24, maxWidth: 500, margin: "0 auto 24px" }}>
            Claude will analyze your net worth, spending, debt, savings, and business data to give you a personalized action plan.
          </div>
          <button onClick={generateBrief} disabled={generating}
            style={{ padding: "14px 32px", fontSize: 14, fontWeight: 700, background: T.blue, color: "#fff", border: "none", borderRadius: 10, cursor: generating ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            {generating ? <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> Analyzing...</> : <><Brain style={{ width: 16, height: 16 }} /> Generate Brief</>}
          </button>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <div>
          <div style={{ background: T.surface, border: `1px solid ${T.blue}30`, borderRadius: 12, padding: 28, marginBottom: 20 }}>
            <div style={{ fontSize: 14, color: T.text, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{brief}</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: T.muted }}>Generated {lastGenerated}</span>
            <button onClick={generateBrief} disabled={generating}
              style={{ padding: "8px 16px", fontSize: 12, fontWeight: 600, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 8, color: T.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              {generating ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : <RefreshCw style={{ width: 12, height: 12 }} />}
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
