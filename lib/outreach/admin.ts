// Admin-only access for outreach tools
// Only these emails can see the outreach section
const ADMIN_EMAILS = [
  "info@thewolfpackco.com",
];

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
