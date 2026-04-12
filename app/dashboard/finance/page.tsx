"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  Building2,
  User,
  Upload,
  TrendingUp,
  TrendingDown,
  CreditCard,
  PiggyBank,
  Calculator,
  FileText,
  Car,
  Brain,
  Target,
  Shield,
  BarChart3,
  Wallet,
  LineChart,
} from "lucide-react";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111111",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
  yellow: "#f5a623",
  bg: "#0a0a0a",
  blue: "#3B82F6",
};

const ADMIN_EMAILS = ["info@thewolfpackco.com", "mikewhite1192@gmail.com"];

type MainTab = "business" | "personal";
type BizSubTab = "dashboard" | "statements" | "tax-strategy" | "retirement" | "mileage" | "filing";
type PersonalSubTab = "net-worth" | "spending" | "debt" | "credit" | "investments" | "retirement" | "savings" | "brief";

// ── Placeholder Section ──────────────────────────────────────────
// Each module gets built out in subsequent phases. For now, show a
// descriptive placeholder so the tab structure is visible and navigable.
function Placeholder({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 16 }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: `${T.orange}15`, border: `1px solid ${T.orange}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon style={{ width: 28, height: 28, color: T.orange }} />
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>{title}</div>
      <div style={{ fontSize: 14, color: T.muted, maxWidth: 500, textAlign: "center", lineHeight: 1.6 }}>{description}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: T.muted, opacity: 0.5 }}>Coming next — Phase 2+</div>
    </div>
  );
}

export default function FinancePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [mainTab, setMainTab] = useState<MainTab>("business");
  const [bizSub, setBizSub] = useState<BizSubTab>("dashboard");
  const [personalSub, setPersonalSub] = useState<PersonalSubTab>("net-worth");

  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || "";
  const isAdmin = isLoaded && ADMIN_EMAILS.includes(email);

  useEffect(() => {
    if (isLoaded && !isAdmin) router.push("/dashboard");
  }, [isLoaded, isAdmin, router]);

  if (!isLoaded) return <div style={{ textAlign: "center", padding: 80, color: T.muted }}>Loading...</div>;
  if (!isAdmin) return null;

  const BIZ_TABS: { key: BizSubTab; label: string; icon: React.ElementType }[] = [
    { key: "dashboard", label: "Dashboard", icon: BarChart3 },
    { key: "statements", label: "Statements", icon: Upload },
    { key: "tax-strategy", label: "Tax Strategy", icon: Calculator },
    { key: "retirement", label: "Retirement", icon: PiggyBank },
    { key: "mileage", label: "Mileage", icon: Car },
    { key: "filing", label: "Tax Filing", icon: FileText },
  ];

  const PERSONAL_TABS: { key: PersonalSubTab; label: string; icon: React.ElementType }[] = [
    { key: "net-worth", label: "Net Worth", icon: Wallet },
    { key: "spending", label: "Spending", icon: CreditCard },
    { key: "debt", label: "Debt Payoff", icon: Target },
    { key: "credit", label: "Credit Score", icon: Shield },
    { key: "investments", label: "Investments", icon: LineChart },
    { key: "retirement", label: "Retirement", icon: PiggyBank },
    { key: "savings", label: "Savings", icon: PiggyBank },
    { key: "brief", label: "AI Brief", icon: Brain },
  ];

  const subTabs = mainTab === "business" ? BIZ_TABS : PERSONAL_TABS;
  const currentSub = mainTab === "business" ? bizSub : personalSub;
  const setCurrentSub = mainTab === "business"
    ? (v: string) => setBizSub(v as BizSubTab)
    : (v: string) => setPersonalSub(v as PersonalSubTab);

  return (
    <div>
      {/* ── Main Tab Selector (Business / Personal) ─────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DollarSign style={{ width: 20, height: 20, color: T.orange }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: 0 }}>Finance</h1>
        </div>
        <div style={{ display: "flex", gap: 4, marginLeft: 16 }}>
          <button
            onClick={() => setMainTab("business")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 20px", fontSize: 13, fontWeight: 700,
              background: mainTab === "business" ? T.orange : "transparent",
              color: mainTab === "business" ? "#fff" : T.muted,
              border: `1px solid ${mainTab === "business" ? T.orange : T.border}`,
              borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
            }}
          >
            <Building2 style={{ width: 14, height: 14 }} />
            Business
          </button>
          <button
            onClick={() => setMainTab("personal")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 20px", fontSize: 13, fontWeight: 700,
              background: mainTab === "personal" ? T.blue : "transparent",
              color: mainTab === "personal" ? "#fff" : T.muted,
              border: `1px solid ${mainTab === "personal" ? T.blue : T.border}`,
              borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
            }}
          >
            <User style={{ width: 14, height: 14 }} />
            Personal
          </button>
        </div>
      </div>

      {/* ── Sub-Tab Navigation ──────────────────────────────────── */}
      <div style={{
        display: "flex", gap: 2, marginBottom: 20, overflowX: "auto", paddingBottom: 2,
        borderBottom: `1px solid ${T.border}`,
      }}>
        {subTabs.map((t) => {
          const Icon = t.icon;
          const isActive = currentSub === t.key;
          const accentColor = mainTab === "business" ? T.orange : T.blue;
          return (
            <button
              key={t.key}
              onClick={() => setCurrentSub(t.key)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 16px", fontSize: 12, fontWeight: 600,
                background: "transparent",
                color: isActive ? accentColor : T.muted,
                border: "none", borderBottom: isActive ? `2px solid ${accentColor}` : "2px solid transparent",
                cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
              }}
            >
              <Icon style={{ width: 14, height: 14 }} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Content Area ───────────────────────────────────────── */}
      {mainTab === "business" && (
        <>
          {bizSub === "dashboard" && (
            <Placeholder
              icon={BarChart3}
              title="Business Dashboard"
              description="Year-to-date revenue, expenses, net profit KPIs. Tax waterfall showing impact of each strategy. Monthly revenue vs expense chart. Quarterly tax payment progress."
            />
          )}
          {bizSub === "statements" && (
            <Placeholder
              icon={Upload}
              title="Statement Upload & Parsing"
              description="Upload Capital One PDF bank statements. AI auto-categorizes every transaction with IRS deduction references. View, search, and re-categorize transactions."
            />
          )}
          {bizSub === "tax-strategy" && (
            <Placeholder
              icon={Calculator}
              title="Tax Strategy Engine"
              description="13 tax reduction strategies with real-time calculations. Tax waterfall visualization showing cumulative savings. S-Corp election threshold monitor."
            />
          )}
          {bizSub === "retirement" && (
            <Placeholder
              icon={PiggyBank}
              title="Retirement Contributions"
              description="SEP-IRA and Solo 401(k) contribution calculator. Slider shows real-time tax bill reduction + retirement impact. Cross-tab with personal retirement readiness."
            />
          )}
          {bizSub === "mileage" && (
            <Placeholder
              icon={Car}
              title="Mileage Logger"
              description="Log business trips with date, destination, miles, and purpose. Auto-calculates deduction at $0.67 per mile. YTD mileage summary."
            />
          )}
          {bizSub === "filing" && (
            <Placeholder
              icon={FileText}
              title="Year-End Tax Filing"
              description="Pre-filled Schedule C, Schedule SE, Form 1040, and MI-1040 generation. Step-by-step IRS Free File and Michigan Treasury instructions."
            />
          )}
        </>
      )}

      {mainTab === "personal" && (
        <>
          {personalSub === "net-worth" && (
            <Placeholder
              icon={Wallet}
              title="Net Worth Dashboard"
              description="Total assets (checking, savings, investments, retirement) minus liabilities (credit card debt). Combined personal + business net worth. Month-over-month trend."
            />
          )}
          {personalSub === "spending" && (
            <Placeholder
              icon={CreditCard}
              title="Spending Analysis"
              description="Category breakdown with donut chart. Budget targets per category (green/yellow/red). Recurring subscription detector. Month-over-month comparison."
            />
          )}
          {personalSub === "debt" && (
            <Placeholder
              icon={Target}
              title="Debt Payoff Engine"
              description="Avalanche vs Snowball methods side-by-side. Exact payoff dates. Total interest comparison. Interactive slider — see what extra payments do to your timeline."
            />
          )}
          {personalSub === "credit" && (
            <Placeholder
              icon={Shield}
              title="Credit Score Tracker"
              description="Score from all 3 bureaus. Factor breakdown (payment history 35%, utilization 30%, length 15%, mix 10%, inquiries 10%). Ranked action items by score impact."
            />
          )}
          {personalSub === "investments" && (
            <Placeholder
              icon={LineChart}
              title="Investment Tracker"
              description="Portfolio value, holdings table, YTD return vs S&P 500 benchmark. Contribution progress toward annual maximums. Retirement account integration."
            />
          )}
          {personalSub === "retirement" && (
            <Placeholder
              icon={TrendingUp}
              title="Retirement Readiness"
              description="Your retirement number (4% rule). Current trajectory vs needed. Retirement age slider. Monthly contribution slider. Monte Carlo simulation (1000 runs). Milestone tracker. Cost of Waiting calculator."
            />
          )}
          {personalSub === "savings" && (
            <Placeholder
              icon={PiggyBank}
              title="Savings & Emergency Fund"
              description="Current savings rate vs 10%/20%/50% targets. Emergency fund progress bar (3-month and 6-month targets). What cutting $X/month from specific categories does to your savings rate."
            />
          )}
          {personalSub === "brief" && (
            <Placeholder
              icon={Brain}
              title="AI Monthly Brief"
              description="Claude analyzes all your uploaded data and generates a plain English monthly report. Net worth change, top 3 wins, top 3 improvements, debt/credit updates, and one specific action to take this week."
            />
          )}
        </>
      )}
    </div>
  );
}
