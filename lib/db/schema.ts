import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  jsonb,
  serial,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================
// WORKSPACES (sub-accounts under an agency)
// ============================================
export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: text("org_id").notNull(), // Clerk organization ID
  name: text("name").notNull(),
  slug: text("slug").unique(),
  customDomain: text("custom_domain"),
  branding: jsonb("branding"), // {logo, primaryColor, companyName, favicon}
  twilioPhone: text("twilio_phone"),
  twilioSid: text("twilio_sid"),
  googleGbpId: text("google_gbp_id"),
  timezone: text("timezone").default("America/New_York"),
  status: text("status").default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// CONTACTS / LEADS
// ============================================
export const contacts = pgTable("contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  source: text("source"), // 'manual', 'landing_page', 'import', 'api', 'facebook', 'google'
  sourceDetail: text("source_detail"),
  listId: uuid("list_id").references(() => contactLists.id),
  tags: text("tags").array(),
  customFields: jsonb("custom_fields"),
  leadScore: integer("lead_score").default(0),
  leadScoreReasons: jsonb("lead_score_reasons"),
  assignedTo: text("assigned_to"), // Clerk user ID
  lastContacted: timestamp("last_contacted", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// PIPELINES
// ============================================
export const pipelines = pgTable("pipelines", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  name: text("name").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// PIPELINE STAGES
// ============================================
export const pipelineStages = pgTable("pipeline_stages", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  pipelineId: uuid("pipeline_id").references(() => pipelines.id),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  color: text("color"),
  isWon: boolean("is_won").default(false),
  isLost: boolean("is_lost").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// CONTACT LISTS
// ============================================
export const contactLists = pgTable("contact_lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  name: text("name").notNull(),
  color: text("color").default("#E86A2A"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// DEALS
// ============================================
export const deals = pgTable("deals", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  contactId: uuid("contact_id").notNull().references(() => contacts.id),
  stageId: uuid("stage_id").notNull().references(() => pipelineStages.id),
  title: text("title"),
  value: numeric("value", { precision: 12, scale: 2 }),
  assignedTo: text("assigned_to"), // Clerk user ID
  expectedClose: date("expected_close"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  lostReason: text("lost_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// DEAL ACTIVITY
// ============================================
export const dealActivity = pgTable("deal_activity", {
  id: uuid("id").defaultRandom().primaryKey(),
  dealId: uuid("deal_id").notNull().references(() => deals.id),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  userId: text("user_id"),
  action: text("action").notNull(), // 'stage_changed', 'note_added', 'call_made', 'email_sent', 'sms_sent'
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// CONVERSATIONS
// ============================================
export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  contactId: uuid("contact_id").notNull().references(() => contacts.id),
  channel: text("channel").notNull(), // 'sms', 'email'
  status: text("status").default("open"), // 'open', 'closed', 'snoozed'
  assignedTo: text("assigned_to"),
  aiEnabled: boolean("ai_enabled").default(true),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// MESSAGES
// ============================================
export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  direction: text("direction").notNull(), // 'inbound', 'outbound'
  channel: text("channel").notNull(), // 'sms', 'email'
  sender: text("sender"),
  recipient: text("recipient"),
  body: text("body"),
  subject: text("subject"),
  htmlBody: text("html_body"),
  status: text("status").default("sent"), // 'sent', 'delivered', 'failed', 'received'
  sentBy: text("sent_by"), // 'ai', 'user', 'automation', 'contact'
  twilioSid: text("twilio_sid"),
  creditsUsed: integer("credits_used").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// CALLS
// ============================================
export const calls = pgTable("calls", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  contactId: uuid("contact_id").notNull().references(() => contacts.id),
  dealId: uuid("deal_id").references(() => deals.id),
  direction: text("direction").notNull(), // 'inbound', 'outbound'
  fromNumber: text("from_number"),
  toNumber: text("to_number"),
  status: text("status"), // 'ringing', 'in-progress', 'completed', 'missed', 'voicemail'
  durationSeconds: integer("duration_seconds"),
  recordingUrl: text("recording_url"),
  transcription: text("transcription"),
  aiScore: integer("ai_score"),
  aiSummary: text("ai_summary"),
  aiNextSteps: text("ai_next_steps"),
  notes: text("notes"),
  calledBy: text("called_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// AUTOMATIONS
// ============================================
export const automations = pgTable("automations", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull(), // 'stage_change', 'new_lead', 'tag_added', etc.
  triggerConfig: jsonb("trigger_config"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const automationSteps = pgTable("automation_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  automationId: uuid("automation_id").notNull().references(() => automations.id),
  position: integer("position").notNull(),
  actionType: text("action_type").notNull(), // 'send_sms', 'send_email', 'ai_sms', 'wait', etc.
  actionConfig: jsonb("action_config"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const automationRuns = pgTable("automation_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  automationId: uuid("automation_id").notNull().references(() => automations.id),
  contactId: uuid("contact_id").notNull().references(() => contacts.id),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  currentStep: integer("current_step"),
  status: text("status").default("running"), // 'running', 'completed', 'cancelled', 'failed'
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  error: text("error"),
});

// ============================================
// TEMPLATES
// ============================================
export const templates = pgTable("templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  type: text("type").notNull(), // 'sms', 'email', 'landing_page', 'proposal'
  name: text("name").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  htmlBody: text("html_body"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// CALENDARS & BOOKINGS
// ============================================
export const calendars = pgTable("calendars", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  userId: text("user_id").notNull(), // Clerk user ID
  name: text("name"),
  slug: text("slug"),
  durationMinutes: integer("duration_minutes").default(30),
  bufferMinutes: integer("buffer_minutes").default(15),
  availability: jsonb("availability"), // [{day, start, end}]
  timezone: text("timezone").default("America/New_York"),
  confirmationSms: boolean("confirmation_sms").default(true),
  confirmationEmail: boolean("confirmation_email").default(true),
  reminderMinutes: integer("reminder_minutes").default(60),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  calendarId: uuid("calendar_id").notNull().references(() => calendars.id),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  contactId: uuid("contact_id").references(() => contacts.id),
  guestName: text("guest_name"),
  guestEmail: text("guest_email"),
  guestPhone: text("guest_phone"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  status: text("status").default("confirmed"), // 'confirmed', 'cancelled', 'completed', 'no_show'
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// LANDING PAGES
// ============================================
export const landingPages = pgTable("landing_pages", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  content: jsonb("content"),
  aiChatEnabled: boolean("ai_chat_enabled").default(true),
  aiChatPrompt: text("ai_chat_prompt"),
  calendarId: uuid("calendar_id").references(() => calendars.id),
  formFields: jsonb("form_fields"),
  published: boolean("published").default(false),
  visits: integer("visits").default(0),
  conversions: integer("conversions").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// PROPOSALS
// ============================================
export const proposals = pgTable("proposals", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  dealId: uuid("deal_id").references(() => deals.id),
  contactId: uuid("contact_id").references(() => contacts.id),
  title: text("title"),
  content: jsonb("content"),
  totalValue: numeric("total_value", { precision: 12, scale: 2 }),
  status: text("status").default("draft"), // 'draft', 'sent', 'viewed', 'signed', 'declined'
  sentAt: timestamp("sent_at", { withTimezone: true }),
  viewedAt: timestamp("viewed_at", { withTimezone: true }),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  signatureData: jsonb("signature_data"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// REVIEWS & REPUTATION
// ============================================
export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  platform: text("platform").default("google"),
  reviewerName: text("reviewer_name"),
  rating: integer("rating"),
  text: text("text"),
  reviewId: text("review_id"), // platform's review ID
  reply: text("reply"),
  replyStatus: text("reply_status").default("none"), // 'none', 'drafted', 'posted'
  aiSuggestedReply: text("ai_suggested_reply"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const reviewRequests = pgTable("review_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  contactId: uuid("contact_id").references(() => contacts.id),
  channel: text("channel"), // 'sms', 'email'
  status: text("status").default("sent"), // 'sent', 'clicked', 'reviewed'
  reviewUrl: text("review_url"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  clickedAt: timestamp("clicked_at", { withTimezone: true }),
});

// ============================================
// SUBSCRIPTIONS & CREDITS
// ============================================
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: text("org_id").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  plan: text("plan").notNull(), // 'starter', 'pro', 'agency'
  status: text("status").default("active"),
  creditsIncluded: integer("credits_included"),
  creditsRemaining: integer("credits_remaining").default(0),
  creditsResetAt: timestamp("credits_reset_at", { withTimezone: true }),
  extraWorkspaceCount: integer("extra_workspace_count").default(0),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const creditTransactions = pgTable("credit_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: text("org_id").notNull(),
  workspaceId: uuid("workspace_id"),
  amount: integer("amount").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  type: text("type"), // 'monthly_allotment', 'purchase', 'ai_sms', 'ai_call_score', etc.
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// AFFILIATES
// ============================================
export const affiliates = pgTable("affiliates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  code: text("code").notNull().unique(),
  stripeAccountId: text("stripe_account_id"),
  commissionRate: numeric("commission_rate", { precision: 4, scale: 2 }).default("0.40"),
  totalEarned: numeric("total_earned", { precision: 12, scale: 2 }).default("0"),
  totalPaid: numeric("total_paid", { precision: 12, scale: 2 }).default("0"),
  status: text("status").default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const referrals = pgTable("referrals", {
  id: uuid("id").defaultRandom().primaryKey(),
  affiliateId: uuid("affiliate_id").notNull().references(() => affiliates.id),
  orgId: text("org_id"),
  status: text("status").default("active"),
  monthlyValue: numeric("monthly_value", { precision: 12, scale: 2 }),
  commission: numeric("commission", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const affiliatePayouts = pgTable("affiliate_payouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  affiliateId: uuid("affiliate_id").notNull().references(() => affiliates.id),
  amount: numeric("amount", { precision: 12, scale: 2 }),
  stripeTransferId: text("stripe_transfer_id"),
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  status: text("status").default("pending"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// BUENA ONDA INTEGRATION
// ============================================
export const boConnections = pgTable("bo_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: text("org_id").notNull(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  boApiKey: text("bo_api_key"),
  boUserId: text("bo_user_id"),
  syncEnabled: boolean("sync_enabled").default(true),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// WORKSPACE MEMBERS (team access)
// ============================================
export const workspaceMembers = pgTable("workspace_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  userId: text("user_id").notNull(),
  role: text("role").default("rep"), // 'owner', 'admin', 'manager', 'rep'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ============================================
// PORTAL USERS (white label client login)
// ============================================
export const portalUsers = pgTable("portal_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  email: text("email").notNull(),
  passwordHash: text("password_hash"),
  name: text("name"),
  role: text("role").default("viewer"), // 'admin', 'editor', 'viewer'
  lastLogin: timestamp("last_login", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
