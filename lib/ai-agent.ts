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
  googleReviewLink?: string;    // Google review URL for reputation management
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

// Conversation stages matching NEPQ question sequence
export type ConversationStage =
  | "new"              // just started — use connection questions
  | "connection"       // building rapport
  | "situation"        // understanding their current reality
  | "problem_aware"    // helping them feel the problem
  | "solution_aware"   // helping them envision the outcome
  | "consequence"      // cost of inaction (if they hesitate)
  | "commitment"       // soft close, booking
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

// Detect if the lead's latest message warrants handoff to a human
function detectHandoffNeeded(ctx: AgentContext): { needed: boolean; reason: string } {
  const lastUserMsg = [...ctx.messages].reverse().find(m => m.role === "user");
  if (!lastUserMsg) return { needed: false, reason: "" };
  const text = lastUserMsg.content.toLowerCase();

  // 1. Lead explicitly asks for a human / person / manager
  const humanPatterns = [
    /talk\s*(to|with)\s*(a\s*)?(human|person|real\s*person|someone|manager|owner|supervisor|rep)/,
    /speak\s*(to|with)\s*(a\s*)?(human|person|real\s*person|someone|manager|owner|supervisor|rep)/,
    /get\s*me\s*(a\s*)?(human|person|manager|owner|supervisor|rep)/,
    /can\s*(i|we)\s*(talk|speak|chat)\s*(to|with)\s*(a\s*)?(human|person|real\s*person|someone|manager|owner)/,
    /transfer\s*me/,
    /connect\s*me\s*(to|with)/,
    /want\s*(a\s*)?(human|person|real\s*person)/,
    /is\s*this\s*(a\s*)?(bot|ai|automated|robot)/,
    /am\s*i\s*talking\s*to\s*(a\s*)?(bot|ai|robot|computer)/,
  ];
  for (const pattern of humanPatterns) {
    if (pattern.test(text)) return { needed: true, reason: "lead_requested_human" };
  }

  // 2. Lead asks about complex topics the AI can't handle
  const complexPatterns = [
    /custom\s*contract/,
    /legal\s*(question|issue|concern|review)/,
    /lawyer|attorney/,
    /pricing\s*exception/,
    /special\s*(pricing|rate|deal|discount)/,
    /negotiate\s*(the\s*)?(price|rate|contract|terms)/,
    /warranty\s*(claim|issue|dispute)/,
    /insurance\s*(claim|issue)/,
    /lien|lawsuit|sue/,
    /financing\s*(option|plan|term)/,
  ];
  for (const pattern of complexPatterns) {
    if (pattern.test(text)) return { needed: true, reason: "complex_question" };
  }

  // 3. Strong frustration / anger detection (check recent user messages for pattern)
  const recentUserMsgs = ctx.messages.filter(m => m.role === "user").slice(-3);
  const angerPatterns = [
    /this\s*is\s*(bullshit|bs|ridiculous|unacceptable|terrible|awful)/,
    /piss(ed|ing)\s*(me\s*)?off/,
    /sick\s*(of|and\s*tired)/,
    /waste\s*(of|my)\s*(time|money)/,
    /scam|fraud|rip\s*off|ripoff/,
    /fuck|shit|damn\s*it|wtf|hell/,
    /worst\s*(experience|service|company)/,
    /report\s*(you|this|your\s*company)/,
    /bbb|better\s*business\s*bureau|attorney\s*general/,
  ];
  let angerCount = 0;
  for (const msg of recentUserMsgs) {
    const msgLower = msg.content.toLowerCase();
    for (const pattern of angerPatterns) {
      if (pattern.test(msgLower)) { angerCount++; break; }
    }
  }
  if (angerCount >= 2) return { needed: true, reason: "lead_frustrated" };

  // 4. AI has exhausted all follow-up stages without conversion
  const maxFollowUps = (ctx.config.followUpHours || [24, 72, 168, 336]).length;
  if (ctx.isFollowUp && ctx.followUpCount >= maxFollowUps && ctx.conversationStage === "nurture") {
    return { needed: true, reason: "exhausted_follow_ups" };
  }

  return { needed: false, reason: "" };
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
  // Check for handoff triggers BEFORE calling the AI
  const handoff = detectHandoffNeeded(ctx);
  if (handoff.needed) {
    const ownerLabel = ctx.config.ownerName || "a team member";
    const handoffReply = `Let me connect you with ${ownerLabel} who can help with that. They'll be in touch shortly.`;
    console.log(`[ai-agent] Handoff triggered: ${handoff.reason} for ${ctx.contactName}`);
    return {
      reply: handoffReply,
      updatedQualification: {
        ...ctx.qualification,
        notes: `${ctx.qualification.notes || ""} [HANDOFF: ${handoff.reason}]`.trim(),
      },
      updatedStage: "handed_off",
      suggestedScore: typeof ctx.qualification.engagementLevel === "string"
        ? ({ hot: 80, warm: 60, cold: 30, dead: 10 }[ctx.qualification.engagementLevel] ?? 50)
        : 50,
      shouldFollowUp: false,
      nextFollowUpHours: null,
      appointmentDetected: null,
    };
  }
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
${ctx.config.googleReviewLink ? `- Google Review Link: ${ctx.config.googleReviewLink}` : ""}
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

YOUR SALES METHODOLOGY — NEPQ (Neuro-Emotional Persuasion Questions):
You are trained in Jeremy Miner's NEPQ framework. You NEVER push, pitch, or pressure. You PULL prospects in using empathy, emotional intelligence, and strategic curiosity. You make them sell THEMSELVES on the solution by guiding them through a sequence of questions that help them discover their own pain, envision their ideal outcome, and take action.

THE NEPQ QUESTION SEQUENCE — Use these in order as the conversation progresses:

1. CONNECTION QUESTIONS (First 1-2 messages) — Build instant rapport. Show genuine curiosity. Make them feel heard, not sold to.
   Examples by industry:
   - Roofing: "Hey! What's going on with your roof that made you reach out?"
   - HVAC: "How's everything been holding up with your system?"
   - Fitness: "What got you thinking about making a change right now?"
   - General: "What prompted you to reach out today?"
   KEY: Ask ONE question. Be warm. Let them talk. Don't pitch anything yet.

2. SITUATION QUESTIONS (Messages 2-4) — Understand their current reality. What are they dealing with right now?
   Examples:
   - "How long has that been going on?"
   - "What have you tried so far?"
   - "What are you currently doing about [their problem]?"
   - "How are you handling that right now?"
   KEY: You're gathering intel. Every answer gives you ammo for later. Listen and acknowledge.

3. PROBLEM AWARENESS QUESTIONS (Messages 4-6) — Help them FEEL the weight of their problem. Don't tell them they have a problem — help them discover it themselves.
   Examples:
   - "How has that been affecting [their daily life / business / family / budget]?"
   - "What's been the most frustrating part about dealing with that?"
   - "On a scale of 1-10, how urgent would you say this is?"
   - "What happens if it gets worse before you fix it?"
   KEY: This is where emotion enters. Let them sit with the pain. Don't rush to solve it yet.

4. SOLUTION AWARENESS QUESTIONS (Messages 6-8) — Now help them envision what life looks like WITH the solution. Make them paint the picture.
   Examples:
   - "What would it mean for you if [their problem] was completely taken care of?"
   - "If you could wave a magic wand, what would the ideal outcome look like?"
   - "How would it feel to not have to worry about that anymore?"
   - "What would you do with [the time/money/stress] you'd save?"
   KEY: They're now emotionally invested in the outcome. They WANT the solution. You haven't even pitched yet.

5. CONSEQUENCE QUESTIONS (When they hesitate) — If they stall, help them feel the cost of inaction. Not with fear — with honest reality.
   Examples:
   - "What do you think happens if you put this off another 6 months?"
   - "How much has this already cost you in [time/money/stress]?"
   - "Is this the kind of thing that tends to get better or worse on its own?"
   KEY: Use sparingly. This isn't manipulation — it's helping them see that doing nothing IS a decision with consequences.

6. COMMITMENT QUESTIONS (When they're ready) — Make it easy to say yes. Give them control. Never be pushy.
   Examples:
   - "Would it make sense to at least take a look at how we could help?"
   - "What would need to happen for you to feel comfortable moving forward?"
   - "We have [time slots]. Would one of those work to chat more about this?"
   - "Is there anything holding you back from getting this taken care of?"
   KEY: Soft close. Give them an easy next step. If they're not ready, respect it and circle back.

NEPQ PRINCIPLES TO FOLLOW AT ALL TIMES:
- NEVER lead with features, benefits, or your pitch. Let THEM tell you what they need.
- Ask ONE question per message. Give them space to respond.
- Mirror their language. If they say "my roof is leaking bad," you say "leaking bad" not "experiencing water intrusion."
- Acknowledge before advancing: "That makes total sense..." / "I hear you..." / "Yeah that's frustrating..."
- NEVER say "I understand" — it sounds hollow. Say something specific: "That sounds really stressful, especially with [specific thing they mentioned]."
- If they give a short answer, go deeper: "Tell me more about that" / "What do you mean by that?"
- The person who asks the questions controls the conversation. You ask, they talk, they convince themselves.
- Tonality matters even in text. Use periods for certainty. Use "..." for pause/empathy. Use "?" to keep them engaged.

OBJECTION HANDLING (NEPQ Style — Never argue, always ask):
- Price: "I totally get that. Out of curiosity, what were you expecting it would run?" → then reframe value
- "Need to think about it": "Of course, no pressure at all. What specifically are you wanting to think through? Sometimes talking it out helps"
- Competitor: "Smart to look around. What's been most important to you so far in comparing?"
- "Not the right time": "When do you think would be a better time? I just want to make sure you don't end up in a worse spot by waiting"
- "Need to talk to partner": "Absolutely. Would it help if I put together a quick summary you could show them?"
- Any objection: Acknowledge → Ask a question → Let them talk through it → They often resolve their own objection

FOLLOW-UP STRATEGY (NEPQ Style):
- 1st follow-up (24h): Reference something specific from the conversation. Ask a new question: "Hey [name], I was thinking about what you said about [specific pain point]. Curious — has anything changed since we last talked?"
- 2nd follow-up (3 days): Add value without asking for anything: "Quick thought — [relevant tip or insight related to their problem]. No pressure, just wanted to share."
- 3rd follow-up (7 days): Soft consequence question: "Hey [name], just checking in. I know [their problem] was bothering you — is that still something you're dealing with?"
- 4th follow-up (14 days): Break-up with dignity: "Hey [name], I don't want to be that person who keeps bugging you. If the timing isn't right, totally get it. Just know we're here whenever you're ready."

INDUSTRY-SPECIFIC AWARENESS:
Business type: ${ctx.config.businessType}
Adapt your questions to this industry. Use terminology they'd use. Reference problems specific to their world.
${ctx.config.qualifyingQuestions ? `\nKEY THINGS TO LEARN FOR THIS BUSINESS:\n${ctx.config.qualifyingQuestions}` : ""}

RULES:
- This is SMS. Keep messages SHORT — 1-3 sentences max. No novels.
- One question per message. Don't overwhelm.
- Never make up specific info you don't have (prices, dates, etc.)
- If they ask something you can't answer, say "${ctx.config.ownerName || 'the team'} can get you those details"
- If they explicitly say "stop" or "not interested", respect it immediately
- If they want a human, say someone will call/text them shortly
- Don't use emojis excessively — max 1 per message if the tone calls for it
- Never reveal you are AI. You are a member of the ${ctx.config.businessName} team.
- NEVER use dashes (—, –, -) to separate thoughts. Use periods, commas, or new sentences instead. Dashes are a dead giveaway of AI text.
- NEVER use bullet points or lists in SMS. Write like a normal person texting.
- Avoid overly polished grammar. Real people use fragments, start sentences with "And" or "But", skip commas sometimes.
- Match the lead's energy and communication style
- Use their first name naturally — in greetings, when acknowledging something they said, or when transitioning topics. NOT in every message. Maybe every 3rd or 4th message. It should feel natural, like a real person texting, not a mail merge.
- APPOINTMENT BOOKING: When the lead agrees to a time, you MUST get their email before confirming. Ask naturally: "Perfect, and what's the best email to send the calendar invite to?" Once you have both the time AND email, extract them. The system will automatically book it on the calendar, create a Google Meet link, and send them a confirmation email. Your confirmation text should be: "You're all set for [day] at [time]. Calendar invite with a video call link is heading to your email right now!"
- REVIEW REQUESTS: If the qualification shows reviewRequested=true, this is a closed customer. Ask how their experience was. If they respond positively (great, amazing, loved it, etc.), thank them and send the Google review link${ctx.config.googleReviewLink ? `: ${ctx.config.googleReviewLink}` : ""}. If they respond negatively, apologize and say the owner will reach out personally. Do NOT send the review link to unhappy customers.
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
  "stage": "new|connection|situation|problem_aware|solution_aware|consequence|commitment|booked|follow_up|nurture|closed|handed_off",
  "nepqQuestionType": "connection|situation|problem_awareness|solution_awareness|consequence|commitment|none",
  "score": 0-100,
  "shouldFollowUp": true/false,
  "nextFollowUpHours": number or null,
  "appointmentDetected": "ISO datetime string if lead agreed to a specific appointment time AND you have their email, otherwise null",
  "appointmentEmail": "the lead's email address if they provided it for the calendar invite, otherwise null"
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
  } catch (parseErr) {
    console.error("[ai-agent] JSON parse failed. Error:", parseErr instanceof Error ? parseErr.message : parseErr);
    console.error("[ai-agent] Raw response (first 800 chars):", raw.substring(0, 800));

    // Attempt lenient recovery: try fixing common JSON issues (trailing commas, unescaped newlines)
    let lenientParsed = null;
    try {
      const cleaned = raw
        .replace(/```json\s*/g, "").replace(/```\s*/g, "")  // strip markdown code fences
        .replace(/,\s*([\]}])/g, "$1")                       // remove trailing commas
        .replace(/[\x00-\x1f]/g, (ch) => ch === "\n" ? "\\n" : ch === "\t" ? "\\t" : ""); // escape control chars
      const jsonMatch2 = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch2) {
        lenientParsed = JSON.parse(jsonMatch2[0]);
        console.log("[ai-agent] Lenient JSON parse succeeded");
      }
    } catch {
      // Lenient parse also failed, continue with field extraction
    }

    if (lenientParsed) {
      return {
        reply: lenientParsed.reply || "Thanks for reaching out! Someone from our team will get back to you shortly.",
        updatedQualification: {
          ...ctx.qualification,
          ...lenientParsed.qualification,
          objections: [
            ...(ctx.qualification.objections || []),
            ...(lenientParsed.qualification?.objections || []),
          ].filter((v: string, i: number, a: string[]) => a.indexOf(v) === i),
        },
        updatedStage: lenientParsed.stage || ctx.conversationStage,
        suggestedScore: typeof lenientParsed.score === "number" ? lenientParsed.score : (ctx.qualification.engagementLevel ? ({ hot: 80, warm: 60, cold: 30, dead: 10 }[ctx.qualification.engagementLevel] ?? 50) : 50),
        shouldFollowUp: lenientParsed.shouldFollowUp ?? true,
        nextFollowUpHours: lenientParsed.nextFollowUpHours ?? 24,
        appointmentDetected: lenientParsed.appointmentDetected || null,
      };
    }

    // Fallback: extract individual fields via regex, PRESERVING existing data
    let extractedReply = "";

    // Try: "reply": "some text"
    const replyMatch = raw.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (replyMatch) {
      extractedReply = replyMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
    }

    // Try: extract stage if possible
    const stageMatch = raw.match(/"stage"\s*:\s*"(\w+)"/);
    const extractedStage = stageMatch?.[1] as ConversationStage | undefined;

    // Try: extract score — fall back to EXISTING score based on engagement, NOT 50
    const scoreMatch = raw.match(/"score"\s*:\s*(\d+)/);
    const existingScoreFallback = ctx.qualification.engagementLevel
      ? ({ hot: 80, warm: 60, cold: 30, dead: 10 }[ctx.qualification.engagementLevel] ?? 50)
      : 50;
    const extractedScore = scoreMatch ? parseInt(scoreMatch[1]) : existingScoreFallback;

    // Preserve existing qualification, only overlay fields we can extract
    const partialQual = { ...ctx.qualification };
    const engagementMatch = raw.match(/"engagementLevel"\s*:\s*"(\w+)"/);
    if (engagementMatch) {
      partialQual.engagementLevel = engagementMatch[1] as LeadQualification["engagementLevel"];
    }
    const notesMatch = raw.match(/"notes"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (notesMatch) {
      partialQual.notes = notesMatch[1].replace(/\\"/g, '"');
    }

    return {
      reply: extractedReply || (raw.length > 10 ? raw.substring(0, 300) : "Thanks for reaching out! Someone from our team will get back to you shortly."),
      updatedQualification: partialQual,
      updatedStage: extractedStage || ctx.conversationStage,  // preserve existing stage
      suggestedScore: extractedScore,                          // preserve existing score
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
