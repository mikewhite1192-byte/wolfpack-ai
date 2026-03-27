import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// AI Sales Agent configuration stored in workspace.ai_config
export interface AgentConfig {
  businessName: string;
  businessType: string;         // "roofing", "hvac", "fitness", etc.
  services: string;             // what you offer
  serviceArea: string;          // geographic area
  uniqueValue: string;          // what makes you different
  pricing: string;              // pricing guidance (ranges, "free estimates", etc.)
  bookingLink?: string;         // calendar booking URL
  bookingInstructions?: string; // "We offer free in-home estimates"
  businessHours: string;        // "Mon-Fri 8am-6pm, Sat 9am-2pm"
  tone: "professional" | "friendly" | "casual";
  ownerName: string;
  commonObjections?: string;    // known objections + how to handle
  qualifyingQuestions?: string; // what info to gather
  enabled: boolean;
  followUpEnabled: boolean;
  followUpHours: number[];      // e.g. [24, 72, 168, 336] = 1d, 3d, 7d, 14d
}

export const DEFAULT_CONFIG: AgentConfig = {
  businessName: "",
  businessType: "",
  services: "",
  serviceArea: "",
  uniqueValue: "",
  pricing: "Contact us for a free estimate",
  bookingLink: "",
  bookingInstructions: "",
  businessHours: "Monday-Friday 8am-6pm",
  tone: "friendly",
  ownerName: "",
  commonObjections: "",
  qualifyingQuestions: "",
  enabled: true,
  followUpEnabled: true,
  followUpHours: [24, 72, 168, 336],
};

// What the AI tracks about each lead
export interface LeadQualification {
  name?: string;
  needs?: string;           // what they're looking for
  timeline?: string;        // when they need it
  budget?: string;          // budget/price sensitivity
  decisionMaker?: boolean;  // are they the decision maker
  address?: string;         // service address
  objections?: string[];    // objections raised
  engagementLevel?: "hot" | "warm" | "cold" | "dead";
  appointmentOffered?: boolean;
  appointmentBooked?: boolean;
  readyToClose?: boolean;
  notes?: string;           // AI's internal notes
}

// Conversation stages the AI tracks
export type ConversationStage =
  | "new"              // just started
  | "gathering_info"   // asking questions, learning needs
  | "qualifying"       // determining fit and timeline
  | "educating"        // sharing info about services
  | "handling_objection" // addressing concerns
  | "booking"          // trying to schedule appointment
  | "booked"           // appointment confirmed
  | "follow_up"        // re-engaging after silence
  | "nurture"          // long-term follow up
  | "closed"           // done (won or lost)
  | "handed_off";      // escalated to human

interface AgentContext {
  config: AgentConfig;
  contactName: string;
  contactPhone: string;
  source: string;
  qualification: LeadQualification;
  conversationStage: ConversationStage;
  messages: { role: "user" | "assistant"; content: string }[];
  hoursSinceLastContact: number;
  followUpCount: number;
  isFollowUp: boolean;
  learnings?: string;  // accumulated learnings from past conversations
}

export async function runSalesAgent(ctx: AgentContext): Promise<{
  reply: string;
  updatedQualification: LeadQualification;
  updatedStage: ConversationStage;
  suggestedScore: number;
  shouldFollowUp: boolean;
  nextFollowUpHours: number | null;
  appointmentDetected: string | null;
}> {
  const toneGuide = {
    professional: "Professional and polished. Use proper grammar. Respectful but confident.",
    friendly: "Warm and approachable. Use their first name. Conversational but still professional.",
    casual: "Super casual and relatable. Like texting a friend. Use abbreviations naturally. Keep it real.",
  };

  const systemPrompt = `You are an expert AI sales assistant working for ${ctx.config.businessName}. You are texting with a potential customer via SMS.

BUSINESS CONTEXT:
- Business: ${ctx.config.businessName} (${ctx.config.businessType})
- Services: ${ctx.config.services}
- Service Area: ${ctx.config.serviceArea}
- What Makes Us Different: ${ctx.config.uniqueValue}
- Pricing: ${ctx.config.pricing}
- Business Hours: ${ctx.config.businessHours}
- Owner: ${ctx.config.ownerName}
${ctx.config.bookingLink ? `- Booking Link: ${ctx.config.bookingLink}` : ""}
${ctx.config.bookingInstructions ? `- Booking Info: ${ctx.config.bookingInstructions}` : ""}
${ctx.config.commonObjections ? `\nKNOWN OBJECTIONS & RESPONSES:\n${ctx.config.commonObjections}` : ""}

CONTACT INFO:
- Name: ${ctx.contactName}
- Phone: ${ctx.contactPhone}
- Source: ${ctx.source}
- Current Stage: ${ctx.conversationStage}
- Follow-up Count: ${ctx.followUpCount}

WHAT WE KNOW ABOUT THIS LEAD:
${JSON.stringify(ctx.qualification, null, 2)}

TONE: ${toneGuide[ctx.config.tone]}

${ctx.isFollowUp ? `THIS IS A PROACTIVE FOLLOW-UP. The lead hasn't responded in ${Math.round(ctx.hoursSinceLastContact)} hours. This is follow-up attempt #${ctx.followUpCount + 1}. Be creative — don't just repeat your last message. Try a different angle.` : ""}

YOUR SALES METHODOLOGY:
1. BUILD RAPPORT — Be genuine. Acknowledge what they said. Mirror their energy.
2. DISCOVER — Ask open-ended questions to understand their needs. Don't interrogate — weave questions into natural conversation. Key things to learn:
   ${ctx.config.qualifyingQuestions || "- What do they need?\n   - What's their timeline?\n   - What's their budget range?\n   - Are they the decision maker?\n   - What's their address/location?"}
3. QUALIFY — Based on what you learn, assess how ready they are.
4. EDUCATE — Share relevant benefits and social proof. Don't dump info — share what's relevant to THEIR situation.
5. HANDLE OBJECTIONS — Never argue. Use feel-felt-found or acknowledge-reframe-redirect. Common techniques:
   - Price objection → reframe as investment, break down value, mention financing/payment plans if applicable
   - "Need to think about it" → "Totally understand. What specifically would help you decide?"
   - "Talking to competitors" → "That's smart. What matters most to you when comparing?"
   - "Not the right time" → "When would be better? I'll follow up then."
   - "Need to talk to spouse/partner" → "Of course! Would it help if I put together some info they could look at?"
6. CLOSE — When they seem ready, offer specific appointment times. Be direct but not pushy: "Would Tuesday at 2pm or Thursday at 10am work better for you?"
7. FOLLOW UP — If they go quiet:
   - 1st follow-up: Casual check-in, reference something from the conversation
   - 2nd follow-up: Add value — share a tip, testimonial, or relevant info
   - 3rd follow-up: Create urgency (limited availability, seasonal pricing, etc.)
   - 4th follow-up: Break-up text ("Just want to make sure I'm not bugging you...")

RULES:
- This is SMS. Keep messages SHORT — 1-3 sentences max. No novels.
- One question per message. Don't overwhelm.
- Never make up specific info you don't have (prices, dates, etc.)
- If they ask something you can't answer, say "${ctx.config.ownerName || 'the team'} can get you those details"
- If they explicitly say "stop" or "not interested", respect it immediately
- If they want a human, say someone will call/text them shortly
- Don't use emojis excessively — max 1 per message if the tone calls for it
- Never reveal you are AI. You are a member of the ${ctx.config.businessName} team.
- Match the lead's energy and communication style
- If the lead mentions an appointment time or agrees to meet, extract the date/time
${ctx.learnings || ""}

RESPOND WITH JSON (and nothing else):
{
  "thinking": "Your internal reasoning about where this lead is, what you still need to learn, and your strategy for this message",
  "reply": "Your SMS response to send",
  "qualification": {
    "name": "their name if known",
    "needs": "what they need",
    "timeline": "their timeline",
    "budget": "budget info",
    "decisionMaker": true/false/null,
    "address": "their address if shared",
    "objections": ["any objections raised"],
    "engagementLevel": "hot|warm|cold|dead",
    "appointmentOffered": true/false,
    "appointmentBooked": true/false,
    "readyToClose": true/false,
    "notes": "your internal notes about this lead"
  },
  "stage": "new|gathering_info|qualifying|educating|handling_objection|booking|booked|follow_up|nurture|closed|handed_off",
  "score": 0-100,
  "shouldFollowUp": true/false,
  "nextFollowUpHours": number or null,
  "appointmentDetected": "ISO datetime string if lead agreed to a specific appointment time, otherwise null"
}`;

  const response = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 1000,
    system: systemPrompt,
    messages: ctx.messages.length > 0 ? ctx.messages : [
      { role: "user", content: "(New lead just came in — send the first message to introduce yourself and start the conversation)" }
    ],
  });

  const textBlock = response.content.find(b => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "";

  // Parse the JSON response
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    const parsed = JSON.parse(jsonMatch[0]);

    console.log(`[ai-agent] Thinking: ${parsed.thinking}`);
    console.log(`[ai-agent] Stage: ${parsed.stage} | Score: ${parsed.score} | Follow-up: ${parsed.shouldFollowUp}`);

    return {
      reply: parsed.reply || "Thanks for reaching out! Someone from our team will get back to you shortly.",
      updatedQualification: {
        ...ctx.qualification,
        ...parsed.qualification,
        objections: [
          ...(ctx.qualification.objections || []),
          ...(parsed.qualification?.objections || []),
        ].filter((v, i, a) => a.indexOf(v) === i), // dedupe
      },
      updatedStage: parsed.stage || ctx.conversationStage,
      suggestedScore: typeof parsed.score === "number" ? parsed.score : 50,
      shouldFollowUp: parsed.shouldFollowUp ?? true,
      nextFollowUpHours: parsed.nextFollowUpHours ?? 24,
      appointmentDetected: parsed.appointmentDetected || null,
    };
  } catch {
    console.error("[ai-agent] Failed to parse JSON response, using raw text");
    return {
      reply: raw.length > 10 ? raw.substring(0, 300) : "Thanks for reaching out! Someone from our team will get back to you shortly.",
      updatedQualification: ctx.qualification,
      updatedStage: ctx.conversationStage,
      suggestedScore: 50,
      shouldFollowUp: true,
      nextFollowUpHours: 24,
      appointmentDetected: null,
    };
  }
}

// Generate a proactive first message for a new lead
export async function generateFirstTouch(config: AgentConfig, contactName: string, source: string): Promise<string> {
  const ctx: AgentContext = {
    config,
    contactName,
    contactPhone: "",
    source,
    qualification: {},
    conversationStage: "new",
    messages: [],
    hoursSinceLastContact: 0,
    followUpCount: 0,
    isFollowUp: false,
  };

  const result = await runSalesAgent(ctx);
  return result.reply;
}

// Determine follow-up timing based on engagement
export function getNextFollowUpHours(followUpCount: number, config: AgentConfig): number | null {
  const schedule = config.followUpHours || [24, 72, 168, 336];
  if (followUpCount >= schedule.length) return null; // stop following up
  return schedule[followUpCount];
}
