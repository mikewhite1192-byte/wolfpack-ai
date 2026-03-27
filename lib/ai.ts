import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ConversationContext {
  businessName: string;
  contactName: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

export async function generateSMSReply(ctx: ConversationContext): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 300,
    system: `You are a friendly, helpful AI sales assistant texting on behalf of ${ctx.businessName}. You're having a real SMS conversation with ${ctx.contactName}.

YOUR GOALS:
1. Answer questions naturally and helpfully
2. Qualify the lead — understand their needs, timeline, budget
3. Guide them toward booking a call or appointment
4. Be conversational — this is SMS, not email. Keep it short.

RULES:
- Keep messages under 160 characters when possible (1 SMS segment)
- Be warm but professional
- Use their name naturally
- If you don't know something about the business, say you'll have someone follow up
- If they want to talk to a real person, say someone will reach out shortly
- Don't be pushy — be helpful
- Never make up specific pricing, hours, or details about the business`,
    messages: ctx.messages,
  });

  const textBlock = response.content.find(b => b.type === "text");
  return textBlock && "text" in textBlock ? textBlock.text : "Thanks for reaching out! Someone will get back to you shortly.";
}
