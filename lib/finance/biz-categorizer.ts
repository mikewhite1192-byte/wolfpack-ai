// ── Business Transaction Categorizer ──────────────────────────────────
// Maps bank statement descriptions to IRS Schedule C categories.
// Each rule has: category, subcategory, deductible flag, deduction
// percentage, and the IRS line reference for Schedule C.

export interface CategoryMatch {
  category: string;
  subcategory: string;
  isDeductible: boolean;
  deductionPct: number; // 0-100
  irsReference: string; // Schedule C line or IRS pub reference
}

interface Rule {
  keywords: string[];
  match: CategoryMatch;
}

const RULES: Rule[] = [
  // ── Advertising & Marketing ──────────────────────────────
  {
    keywords: ["google ads", "meta ads", "facebook ads", "tiktok ads", "linkedin ads", "advertising", "marketing", "ads manager", "fiverr", "canva", "mailchimp", "constant contact", "hootsuite", "buffer"],
    match: { category: "Advertising", subcategory: "Digital Marketing", isDeductible: true, deductionPct: 100, irsReference: "Schedule C Line 8" },
  },
  {
    keywords: ["business cards", "flyers", "brochure", "signage", "banner", "yard sign", "vehicle wrap"],
    match: { category: "Advertising", subcategory: "Print & Signage", isDeductible: true, deductionPct: 100, irsReference: "Schedule C Line 8" },
  },

  // ── Office & Supplies ────────────────────────────────────
  {
    keywords: ["office depot", "staples", "amazon", "best buy", "apple", "microsoft", "ink", "paper", "office supplies"],
    match: { category: "Office Expenses", subcategory: "Supplies", isDeductible: true, deductionPct: 100, irsReference: "Schedule C Line 18" },
  },
  {
    keywords: ["computer", "laptop", "monitor", "keyboard", "mouse", "printer", "ipad", "macbook", "desk", "chair", "standing desk"],
    match: { category: "Office Expenses", subcategory: "Equipment", isDeductible: true, deductionPct: 100, irsReference: "Section 179 / Schedule C Line 13" },
  },

  // ── Software & Subscriptions ─────────────────────────────
  {
    keywords: ["vercel", "heroku", "aws", "digital ocean", "netlify", "railway", "supabase", "neon", "planetscale", "mongodb", "github", "gitlab", "bitbucket"],
    match: { category: "Software", subcategory: "Hosting & Infrastructure", isDeductible: true, deductionPct: 100, irsReference: "Schedule C Line 27a" },
  },
  {
    keywords: ["anthropic", "openai", "claude", "gpt", "ai api", "retell", "elevenlabs"],
    match: { category: "Software", subcategory: "AI Services", isDeductible: true, deductionPct: 100, irsReference: "Schedule C Line 27a" },
  },
  {
    keywords: ["zoom", "slack", "notion", "trello", "asana", "jira", "figma", "adobe", "creative cloud", "photoshop", "1password", "lastpass", "stripe", "twilio", "sendgrid", "loop message", "calendly"],
    match: { category: "Software", subcategory: "Business Tools", isDeductible: true, deductionPct: 100, irsReference: "Schedule C Line 27a" },
  },

  // ── Internet & Phone ─────────────────────────────────────
  {
    keywords: ["comcast", "xfinity", "spectrum", "att internet", "verizon fios", "t-mobile home", "starlink"],
    match: { category: "Utilities", subcategory: "Internet", isDeductible: true, deductionPct: 50, irsReference: "Schedule C Line 25 (business use %)" },
  },
  {
    keywords: ["verizon wireless", "t-mobile", "att wireless", "tello", "mint mobile", "visible"],
    match: { category: "Utilities", subcategory: "Phone", isDeductible: true, deductionPct: 50, irsReference: "Schedule C Line 25 (business use %)" },
  },

  // ── Professional Services ────────────────────────────────
  {
    keywords: ["accountant", "cpa", "tax prep", "bookkeeper", "attorney", "lawyer", "legal", "legalzoom", "incfile"],
    match: { category: "Professional Services", subcategory: "Legal & Accounting", isDeductible: true, deductionPct: 100, irsReference: "Schedule C Line 17" },
  },
  {
    keywords: ["contractor", "freelancer", "consultant", "1099"],
    match: { category: "Professional Services", subcategory: "Contract Labor", isDeductible: true, deductionPct: 100, irsReference: "Schedule C Line 11" },
  },

  // ── Insurance ────────────────────────────────────────────
  {
    keywords: ["business insurance", "liability insurance", "e&o", "errors and omissions", "general liability", "workers comp"],
    match: { category: "Insurance", subcategory: "Business Insurance", isDeductible: true, deductionPct: 100, irsReference: "Schedule C Line 15" },
  },
  {
    keywords: ["health insurance", "dental insurance", "vision insurance", "hsa", "health savings"],
    match: { category: "Insurance", subcategory: "Health Insurance", isDeductible: true, deductionPct: 100, irsReference: "Form 1040 Line 17 (above-the-line)" },
  },

  // ── Travel & Meals ───────────────────────────────────────
  {
    keywords: ["airline", "delta", "united", "southwest", "american airlines", "spirit", "frontier", "hotel", "marriott", "hilton", "airbnb", "vrbo"],
    match: { category: "Travel", subcategory: "Transportation & Lodging", isDeductible: true, deductionPct: 100, irsReference: "Schedule C Line 24a" },
  },
  {
    keywords: ["uber", "lyft", "taxi", "rental car", "hertz", "enterprise", "parking", "tolls"],
    match: { category: "Travel", subcategory: "Local Transportation", isDeductible: true, deductionPct: 100, irsReference: "Schedule C Line 24a" },
  },
  {
    keywords: ["restaurant", "lunch", "dinner", "coffee meeting", "client meal", "business meal"],
    match: { category: "Meals", subcategory: "Business Meals", isDeductible: true, deductionPct: 50, irsReference: "Schedule C Line 24b (50% deductible)" },
  },

  // ── Vehicle ──────────────────────────────────────────────
  {
    keywords: ["gas", "shell", "bp", "speedway", "exxon", "mobil", "chevron", "marathon", "fuel"],
    match: { category: "Vehicle", subcategory: "Fuel", isDeductible: true, deductionPct: 50, irsReference: "Schedule C Line 9 (actual method) or standard mileage" },
  },
  {
    keywords: ["car wash", "auto repair", "oil change", "tire", "mechanic", "auto parts"],
    match: { category: "Vehicle", subcategory: "Maintenance", isDeductible: true, deductionPct: 50, irsReference: "Schedule C Line 9 (actual method)" },
  },

  // ── Education & Training ─────────────────────────────────
  {
    keywords: ["udemy", "coursera", "skillshare", "masterclass", "conference", "workshop", "training", "certification", "pluralsight", "linkedin learning"],
    match: { category: "Education", subcategory: "Professional Development", isDeductible: true, deductionPct: 100, irsReference: "Schedule C Line 27a" },
  },
  {
    keywords: ["book", "kindle", "audible", "amazon book"],
    match: { category: "Education", subcategory: "Books & Resources", isDeductible: true, deductionPct: 100, irsReference: "Schedule C Line 27a" },
  },

  // ── Banking & Fees ───────────────────────────────────────
  {
    keywords: ["bank fee", "monthly fee", "service charge", "overdraft", "wire fee", "ach fee"],
    match: { category: "Banking", subcategory: "Fees", isDeductible: true, deductionPct: 100, irsReference: "Schedule C Line 27a" },
  },
  {
    keywords: ["stripe fee", "payment processing", "square fee", "paypal fee"],
    match: { category: "Banking", subcategory: "Payment Processing", isDeductible: true, deductionPct: 100, irsReference: "Schedule C Line 10" },
  },

  // ── Domain & Hosting ─────────────────────────────────────
  {
    keywords: ["porkbun", "namecheap", "godaddy", "google domains", "cloudflare", "domain"],
    match: { category: "Software", subcategory: "Domains", isDeductible: true, deductionPct: 100, irsReference: "Schedule C Line 27a" },
  },

  // ── Revenue / Income ─────────────────────────────────────
  {
    keywords: ["stripe", "payment", "deposit", "ach credit", "direct deposit", "transfer from", "client payment", "invoice payment"],
    match: { category: "Income", subcategory: "Business Revenue", isDeductible: false, deductionPct: 0, irsReference: "Schedule C Line 1 (Gross Receipts)" },
  },

  // ── Retirement Contributions ─────────────────────────────
  {
    keywords: ["sep-ira", "sep ira", "solo 401k", "retirement contribution", "fidelity", "vanguard", "schwab"],
    match: { category: "Retirement", subcategory: "SEP-IRA / Solo 401k", isDeductible: true, deductionPct: 100, irsReference: "Form 1040 Line 20 (above-the-line)" },
  },

  // ── Personal / Non-Deductible ────────────────────────────
  {
    keywords: ["atm", "cash withdrawal", "venmo", "zelle", "personal", "grocery", "walmart", "target", "costco", "kroger"],
    match: { category: "Personal", subcategory: "Non-Business", isDeductible: false, deductionPct: 0, irsReference: "N/A — not deductible" },
  },
];

const DEFAULT_MATCH: CategoryMatch = {
  category: "Uncategorized",
  subcategory: "Needs Review",
  isDeductible: false,
  deductionPct: 0,
  irsReference: "Review for potential deduction",
};

export function categorizeTransaction(description: string): CategoryMatch {
  const lower = description.toLowerCase();

  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        return rule.match;
      }
    }
  }

  return DEFAULT_MATCH;
}

// ── Detect if a transaction is income (credit) vs expense (debit) ────
export function detectTransactionType(
  amount: number,
  description: string,
): "income" | "expense" | "transfer" {
  const lower = description.toLowerCase();

  if (lower.includes("transfer") || lower.includes("xfer")) return "transfer";
  if (amount > 0) return "income";
  return "expense";
}
