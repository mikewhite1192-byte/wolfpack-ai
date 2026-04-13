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
  Search,
} from "lucide-react";
import BusinessDashboard from "./BusinessDashboard";
import QuarterlyPayments from "./QuarterlyPayments";
import RetirementContributions from "./RetirementContributions";
import MileageLogger from "./MileageLogger";
import TaxFiling from "./TaxFiling";
import NetWorthDashboard from "./NetWorthDashboard";
import DebtPayoff from "./DebtPayoff";
import RetirementReadiness from "./RetirementReadiness";
import SavingsTracker from "./SavingsTracker";
import CatchUp from "./CatchUp";
import SpendingAnalysis from "./SpendingAnalysis";
import CreditScoreTracker from "./CreditScoreTracker";
import InvestmentTracker from "./InvestmentTracker";
import AIBrief from "./AIBrief";

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
type BizSubTab = "dashboard" | "catch-up" | "statements" | "tax-strategy" | "retirement" | "mileage" | "filing";
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
    { key: "catch-up", label: "Smart Scan", icon: Search },
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
          {bizSub === "dashboard" && <BusinessDashboard />}
          {bizSub === "catch-up" && <CatchUp />}
          {bizSub === "statements" && (
            <Placeholder
              icon={Upload}
              title="Statement Upload & Parsing"
              description="Upload Capital One PDF bank statements. AI auto-categorizes every transaction with IRS deduction references. View, search, and re-categorize transactions. Upload via the Dashboard tab."
            />
          )}
          {bizSub === "tax-strategy" && <QuarterlyPayments />}
          {bizSub === "retirement" && <RetirementContributions />}
          {bizSub === "mileage" && <MileageLogger />}
          {bizSub === "filing" && <TaxFiling />}
        </>
      )}

      {mainTab === "personal" && (
        <>
          {personalSub === "net-worth" && <NetWorthDashboard />}
          {personalSub === "spending" && <SpendingAnalysis />}
          {personalSub === "debt" && <DebtPayoff />}
          {personalSub === "credit" && <CreditScoreTracker />}
          {personalSub === "investments" && <InvestmentTracker />}
          {personalSub === "retirement" && <RetirementReadiness />}
          {personalSub === "savings" && <SavingsTracker />}
          {personalSub === "brief" && <AIBrief />}
        </>
      )}
    </div>
  );
}
