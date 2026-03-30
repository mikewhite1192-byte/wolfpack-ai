import dns from "dns/promises";
import net from "net";

interface ValidationResult {
  valid: boolean;
  syntax: boolean;
  mxExists: boolean;
  smtpValid: boolean;
  details: string;
}

// Known bad/dead domains that will always bounce
const DEAD_DOMAINS = new Set([
  "axa-advisors.com", "tampabay.rr.com", "cfl.rr.com", "socal.rr.com",
  "nycap.rr.com", "twcny.rr.com", "ec.rr.com", "wi.rr.com",
  "woh.rr.com", "neo.rr.com", "carolina.rr.com", "triad.rr.com",
  "austin.rr.com", "rochester.rr.com", "insight.rr.com", "kc.rr.com",
  "columbus.rr.com", "stx.rr.com", "san.rr.com",
  "bellsouth.net", "att.net", "sbcglobal.net", "worldnet.att.net",
  "prodigy.net", "juno.com", "netzero.net", "earthlink.net",
  "mindspring.com", "compuserve.com",
]);

// Disposable email domains
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "tempmail.com", "throwaway.email",
  "yopmail.com", "10minutemail.com", "trashmail.com", "fakeinbox.com",
]);

// Step 1: Syntax check
function isValidSyntax(email: string): boolean {
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
  return re.test(email) && email.length <= 320;
}

// Step 2: MX record lookup
async function getMxHost(domain: string): Promise<string | null> {
  try {
    const records = await dns.resolveMx(domain);
    if (records.length === 0) return null;
    // Return the highest priority MX host
    records.sort((a, b) => a.priority - b.priority);
    return records[0].exchange;
  } catch {
    return null;
  }
}

// Step 3: SMTP mailbox verification
// Connects to the mail server and checks if the address exists via RCPT TO
async function verifySmtp(email: string, mxHost: string): Promise<{ valid: boolean; details: string }> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ valid: true, details: "SMTP timeout — assuming valid" }); // Don't reject on timeout
    }, 8000);

    const socket = net.createConnection(25, mxHost);
    let step = 0;
    let response = "";

    socket.setEncoding("utf8");

    socket.on("data", (data: string) => {
      response += data;

      if (step === 0 && response.includes("220")) {
        // Server greeting — send HELO
        step = 1;
        response = "";
        socket.write("HELO thewolfpack.ai\r\n");
      } else if (step === 1 && response.includes("250")) {
        // HELO accepted — send MAIL FROM
        step = 2;
        response = "";
        socket.write("MAIL FROM:<verify@thewolfpack.ai>\r\n");
      } else if (step === 2 && response.includes("250")) {
        // MAIL FROM accepted — send RCPT TO (this is the real check)
        step = 3;
        response = "";
        socket.write(`RCPT TO:<${email}>\r\n`);
      } else if (step === 3) {
        clearTimeout(timeout);
        socket.write("QUIT\r\n");
        socket.destroy();

        if (response.includes("250")) {
          resolve({ valid: true, details: "SMTP verified" });
        } else if (response.includes("550") || response.includes("551") || response.includes("553") || response.includes("521")) {
          resolve({ valid: false, details: "Mailbox does not exist" });
        } else if (response.includes("452") || response.includes("421")) {
          resolve({ valid: true, details: "Server busy — assuming valid" }); // Temporary error, don't reject
        } else {
          resolve({ valid: true, details: "SMTP inconclusive — assuming valid" }); // Don't reject unknowns
        }
      }
    });

    socket.on("error", () => {
      clearTimeout(timeout);
      resolve({ valid: true, details: "SMTP connection failed — assuming valid" }); // Don't reject on error
    });

    socket.on("timeout", () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve({ valid: true, details: "SMTP timeout — assuming valid" });
    });
  });
}

// Full validation pipeline
export async function validateEmail(email: string): Promise<ValidationResult> {
  const trimmed = email.trim().toLowerCase();

  // Syntax check
  if (!isValidSyntax(trimmed)) {
    return { valid: false, syntax: false, mxExists: false, smtpValid: false, details: "Invalid email format" };
  }

  const domain = trimmed.split("@")[1];

  // Block known dead/disposable domains
  if (DEAD_DOMAINS.has(domain) || DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, syntax: true, mxExists: false, smtpValid: false, details: `Blocked domain: ${domain}` };
  }

  // MX record lookup
  const mxHost = await getMxHost(domain);
  if (!mxHost) {
    return { valid: false, syntax: true, mxExists: false, smtpValid: false, details: `No mail server found for ${domain}` };
  }

  // SMTP verification
  const smtp = await verifySmtp(trimmed, mxHost);
  if (!smtp.valid) {
    return { valid: false, syntax: true, mxExists: true, smtpValid: false, details: smtp.details };
  }

  return { valid: true, syntax: true, mxExists: true, smtpValid: true, details: smtp.details };
}

// Batch validate
export async function validateEmails(emails: string[]): Promise<Map<string, ValidationResult>> {
  const results = new Map<string, ValidationResult>();

  // Cache MX lookups and SMTP results by domain
  const mxCache = new Map<string, string | null>();
  const domainSmtpCache = new Map<string, boolean>();

  for (const email of emails) {
    const trimmed = email.trim().toLowerCase();

    if (!isValidSyntax(trimmed)) {
      results.set(trimmed, { valid: false, syntax: false, mxExists: false, smtpValid: false, details: "Invalid format" });
      continue;
    }

    const domain = trimmed.split("@")[1];

    // Block known dead/disposable domains
    if (DEAD_DOMAINS.has(domain) || DISPOSABLE_DOMAINS.has(domain)) {
      results.set(trimmed, { valid: false, syntax: true, mxExists: false, smtpValid: false, details: `Blocked domain: ${domain}` });
      continue;
    }

    if (!mxCache.has(domain)) {
      mxCache.set(domain, await getMxHost(domain));
    }

    const mxHost = mxCache.get(domain);
    if (!mxHost) {
      results.set(trimmed, { valid: false, syntax: true, mxExists: false, smtpValid: false, details: `No mail server for ${domain}` });
      continue;
    }

    // SMTP verify — only check one email per domain to avoid rate limits
    if (!domainSmtpCache.has(domain)) {
      const smtp = await verifySmtp(trimmed, mxHost);
      domainSmtpCache.set(domain, smtp.valid);
      if (!smtp.valid) {
        results.set(trimmed, { valid: false, syntax: true, mxExists: true, smtpValid: false, details: smtp.details });
        continue;
      }
    } else if (!domainSmtpCache.get(domain)) {
      results.set(trimmed, { valid: false, syntax: true, mxExists: true, smtpValid: false, details: "Domain SMTP rejected" });
      continue;
    }

    results.set(trimmed, { valid: true, syntax: true, mxExists: true, smtpValid: true, details: "Valid" });
  }

  return results;
}
