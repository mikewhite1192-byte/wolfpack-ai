import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

interface Check {
  name: string;
  category: string;
  score: number;
  status: "good" | "warning" | "bad";
  detail: string;
  tip?: string;
}

function getSmtpCreds() {
  // Use first active warmup address for sending reports
  return sql`SELECT email, display_name, smtp_host, smtp_port, smtp_user, smtp_pass FROM warmup_addresses WHERE is_active = true LIMIT 1`;
}

function statusColor(status: string) {
  return status === "good" ? "#2ecc71" : status === "warning" ? "#f5a623" : "#e74c3c";
}

function statusIcon(status: string) {
  return status === "good" ? "✓" : status === "warning" ? "⚠" : "✗";
}

function gradeColor(score: number) {
  return score >= 80 ? "#2ecc71" : score >= 60 ? "#f5a623" : "#e74c3c";
}

function buildWebsiteReportHtml(data: {
  domain: string;
  title: string;
  score: number;
  grade: string;
  checks: Check[];
  summary: { good: number; warning: number; bad: number };
  name?: string;
}) {
  const { domain, score, grade, checks, summary, name } = data;

  const checkRows = checks.map(c => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #1a1a1a;color:${statusColor(c.status)};font-size:16px;width:28px;text-align:center;">${statusIcon(c.status)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #1a1a1a;">
        <div style="font-size:14px;font-weight:600;color:#e8eaf0;">${c.name}</div>
        <div style="font-size:12px;color:#8b8fa8;margin-top:3px;">${c.detail}</div>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #1a1a1a;text-align:right;font-size:14px;font-weight:700;color:${statusColor(c.status)};">${c.score}/100</td>
    </tr>
  `).join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;color:#e8eaf0;">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:14px;letter-spacing:3px;color:rgba(232,230,227,0.3);margin-bottom:8px;">THE <span style="color:rgba(232,106,42,0.5);">WOLF</span> PACK</div>
      <div style="font-size:24px;font-weight:800;color:#e8eaf0;">Website Audit Report</div>
      <div style="font-size:14px;color:#8b8fa8;margin-top:6px;">${domain}</div>
    </div>

    ${name ? `<div style="font-size:14px;color:#8b8fa8;margin-bottom:24px;">Hey ${name},<br><br>Here's your full website audit for <strong style="color:#e8eaf0;">${domain}</strong>.</div>` : ""}

    <!-- Score -->
    <div style="text-align:center;background:#111;border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:32px;margin-bottom:24px;">
      <div style="font-size:64px;font-weight:800;color:${gradeColor(score)};">${score}</div>
      <div style="font-size:20px;font-weight:700;color:${gradeColor(score)};margin-bottom:12px;">Grade: ${grade}</div>
      <div style="display:inline-block;margin:0 12px;">
        <span style="font-size:24px;font-weight:700;color:#2ecc71;">${summary.good}</span>
        <span style="font-size:12px;color:#8b8fa8;"> Passed</span>
      </div>
      <div style="display:inline-block;margin:0 12px;">
        <span style="font-size:24px;font-weight:700;color:#f5a623;">${summary.warning}</span>
        <span style="font-size:12px;color:#8b8fa8;"> Warnings</span>
      </div>
      <div style="display:inline-block;margin:0 12px;">
        <span style="font-size:24px;font-weight:700;color:#e74c3c;">${summary.bad}</span>
        <span style="font-size:12px;color:#8b8fa8;"> Failed</span>
      </div>
    </div>

    <!-- Checks -->
    <div style="background:#111;border:1px solid rgba(255,255,255,0.07);border-radius:16px;overflow:hidden;margin-bottom:24px;">
      <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.07);">
        <div style="font-size:12px;font-weight:700;color:#E86A2A;text-transform:uppercase;letter-spacing:1.5px;">Full Audit Results</div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${checkRows}
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align:center;background:#111;border:1px solid rgba(232,106,42,0.2);border-radius:16px;padding:32px;margin-bottom:24px;">
      <div style="font-size:18px;font-weight:700;color:#e8eaf0;margin-bottom:8px;">Want help fixing these issues?</div>
      <div style="font-size:13px;color:#8b8fa8;margin-bottom:20px;">Wolf Pack builds high-converting websites for service businesses and manages your online presence with AI.</div>
      <a href="https://thewolfpack.ai/book-demo" style="display:inline-block;padding:14px 36px;background:#E86A2A;color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:700;">Book a Free Consultation →</a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:20px 0;">
      <div style="font-size:12px;color:rgba(232,230,227,0.2);">THE WOLF PACK AI</div>
      <div style="font-size:11px;color:rgba(232,230,227,0.1);margin-top:4px;">Free website audit tool · thewolfpack.ai/score</div>
    </div>
  </div>
</body>
</html>`;
}

function buildGbpReportHtml(data: {
  businessName: string;
  score: number;
  grade: string;
  checks: Check[];
  summary: { good: number; warning: number; bad: number };
  name?: string;
}) {
  const { businessName, score, grade, checks, summary, name } = data;

  const checkRows = checks.map(c => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #1a1a1a;color:${statusColor(c.status)};font-size:16px;width:28px;text-align:center;">${statusIcon(c.status)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #1a1a1a;">
        <div style="font-size:14px;font-weight:600;color:#e8eaf0;">${c.name}</div>
        <div style="font-size:12px;color:#8b8fa8;margin-top:3px;">${c.detail}</div>
        ${c.tip ? `<div style="font-size:11px;color:#E86A2A;margin-top:4px;">💡 ${c.tip}</div>` : ""}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #1a1a1a;text-align:right;font-size:14px;font-weight:700;color:${statusColor(c.status)};">${c.score}/100</td>
    </tr>
  `).join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;color:#e8eaf0;">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px;">

    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:14px;letter-spacing:3px;color:rgba(232,230,227,0.3);margin-bottom:8px;">THE <span style="color:rgba(232,106,42,0.5);">WOLF</span> PACK</div>
      <div style="font-size:24px;font-weight:800;color:#e8eaf0;">Google Business Profile Audit</div>
      <div style="font-size:14px;color:#8b8fa8;margin-top:6px;">${businessName}</div>
    </div>

    ${name ? `<div style="font-size:14px;color:#8b8fa8;margin-bottom:24px;">Hey ${name},<br><br>Here's your GBP audit for <strong style="color:#e8eaf0;">${businessName}</strong>.</div>` : ""}

    <div style="text-align:center;background:#111;border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:32px;margin-bottom:24px;">
      <div style="font-size:64px;font-weight:800;color:${gradeColor(score)};">${score}</div>
      <div style="font-size:20px;font-weight:700;color:${gradeColor(score)};margin-bottom:12px;">Grade: ${grade}</div>
      <div style="display:inline-block;margin:0 12px;">
        <span style="font-size:24px;font-weight:700;color:#2ecc71;">${summary.good}</span>
        <span style="font-size:12px;color:#8b8fa8;"> Passed</span>
      </div>
      <div style="display:inline-block;margin:0 12px;">
        <span style="font-size:24px;font-weight:700;color:#f5a623;">${summary.warning}</span>
        <span style="font-size:12px;color:#8b8fa8;"> Warnings</span>
      </div>
      <div style="display:inline-block;margin:0 12px;">
        <span style="font-size:24px;font-weight:700;color:#e74c3c;">${summary.bad}</span>
        <span style="font-size:12px;color:#8b8fa8;"> Failed</span>
      </div>
    </div>

    <div style="background:#111;border:1px solid rgba(255,255,255,0.07);border-radius:16px;overflow:hidden;margin-bottom:24px;">
      <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.07);">
        <div style="font-size:12px;font-weight:700;color:#E86A2A;text-transform:uppercase;letter-spacing:1.5px;">Full Audit Results</div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${checkRows}
      </table>
    </div>

    <div style="text-align:center;background:#111;border:1px solid rgba(232,106,42,0.2);border-radius:16px;padding:32px;margin-bottom:24px;">
      <div style="font-size:18px;font-weight:700;color:#e8eaf0;margin-bottom:8px;">Want us to manage your Google Business Profile?</div>
      <div style="font-size:13px;color:#8b8fa8;margin-bottom:20px;">Wolf Pack handles weekly posts, AI review replies, and monthly performance reports — all on autopilot. $49/mo.</div>
      <a href="https://thewolfpack.ai/book-demo" style="display:inline-block;padding:14px 36px;background:#E86A2A;color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:700;">Book a Free Consultation →</a>
    </div>

    <div style="text-align:center;padding:20px 0;">
      <div style="font-size:12px;color:rgba(232,230,227,0.2);">THE WOLF PACK AI</div>
      <div style="font-size:11px;color:rgba(232,230,227,0.1);margin-top:4px;">Free GBP audit tool · thewolfpack.ai/gbp-score</div>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req: Request) {
  try {
    const { type, email, name, reportData } = await req.json();

    if (!email || !reportData) {
      return NextResponse.json({ error: "Email and report data required" }, { status: 400 });
    }

    // Get SMTP credentials
    const creds = await getSmtpCreds();
    if (creds.length === 0) {
      return NextResponse.json({ error: "No email sender configured" }, { status: 500 });
    }

    const sender = creds[0];

    // Build the HTML report
    const html = type === "gbp"
      ? buildGbpReportHtml({ ...reportData, name })
      : buildWebsiteReportHtml({ ...reportData, name });

    const subject = type === "gbp"
      ? `Your GBP Audit Report — ${reportData.businessName || "Score"}: ${reportData.grade}`
      : `Your Website Audit Report — ${reportData.domain || "Score"}: ${reportData.grade}`;

    // Send via nodemailer
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: sender.smtp_host,
      port: sender.smtp_port,
      secure: sender.smtp_port === 465,
      auth: { user: sender.smtp_user, pass: sender.smtp_pass },
    });

    await transporter.sendMail({
      from: `The Wolf Pack AI <${sender.email}>`,
      to: email,
      subject,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[send-report] Error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
