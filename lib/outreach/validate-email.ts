import dns from "dns/promises";

interface ValidationResult {
  valid: boolean;
  syntax: boolean;
  mxExists: boolean;
  details: string;
}

// Step 1: Syntax check
function isValidSyntax(email: string): boolean {
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
  return re.test(email) && email.length <= 320;
}

// Step 2: MX record lookup
async function hasMxRecord(domain: string): Promise<boolean> {
  try {
    const records = await dns.resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}

// Full validation pipeline
export async function validateEmail(email: string): Promise<ValidationResult> {
  const trimmed = email.trim().toLowerCase();

  // Syntax check
  if (!isValidSyntax(trimmed)) {
    return { valid: false, syntax: false, mxExists: false, details: "Invalid email format" };
  }

  const domain = trimmed.split("@")[1];

  // MX record lookup
  const mx = await hasMxRecord(domain);
  if (!mx) {
    return { valid: false, syntax: true, mxExists: false, details: `No mail server found for ${domain}` };
  }

  return { valid: true, syntax: true, mxExists: true, details: "Valid" };
}

// Batch validate
export async function validateEmails(emails: string[]): Promise<Map<string, ValidationResult>> {
  const results = new Map<string, ValidationResult>();

  // Cache MX lookups by domain
  const mxCache = new Map<string, boolean>();

  for (const email of emails) {
    const trimmed = email.trim().toLowerCase();

    if (!isValidSyntax(trimmed)) {
      results.set(trimmed, { valid: false, syntax: false, mxExists: false, details: "Invalid format" });
      continue;
    }

    const domain = trimmed.split("@")[1];

    if (!mxCache.has(domain)) {
      mxCache.set(domain, await hasMxRecord(domain));
    }

    const mx = mxCache.get(domain)!;
    if (!mx) {
      results.set(trimmed, { valid: false, syntax: true, mxExists: false, details: `No mail server for ${domain}` });
      continue;
    }

    results.set(trimmed, { valid: true, syntax: true, mxExists: true, details: "Valid" });
  }

  return results;
}
