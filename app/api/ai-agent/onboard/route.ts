import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";
import Anthropic from "@anthropic-ai/sdk";

const sql = neon(process.env.DATABASE_URL!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ONBOARDING_QUESTIONS = [
  { key: "businessName", question: "What's your business name?" },
  { key: "businessType", question: "What type of business is it? (e.g. roofing, HVAC, fitness, real estate, etc.)" },
  { key: "services", question: "What services do you offer? List the main ones." },
  { key: "serviceArea", question: "What area do you serve? (city, region, etc.)" },
  { key: "uniqueValue", question: "What makes your business different from competitors? What do customers love about you?" },
  { key: "pricing", question: "How should the AI talk about pricing? (e.g. 'free estimates', price ranges, 'contact us for a quote')" },
  { key: "ownerName", question: "What's your name? (The AI will text as a member of your team)" },
  { key: "commonObjections", question: "What are the most common objections you hear from leads? And how do you handle them?" },
  { key: "tone", question: "How should your AI sound? Professional and polished, friendly and warm, or super casual like texting a friend?" },
];

// POST /api/ai-agent/onboard — process onboarding chat message
export async function POST(req: Request) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { message, skip } = await req.json();

    // Handle skip
    if (skip) {
      await sql`UPDATE workspaces SET onboarding_complete = true, onboarding_step = ${ONBOARDING_QUESTIONS.length} WHERE id = ${workspace.id}`;
      return NextResponse.json({ done: true, botMessage: "Skipped! You can set up your AI agent in Settings." });
    }

    const currentStep = workspace.onboarding_step || 0;
    const aiConfig = workspace.ai_config || {};

    if (currentStep >= ONBOARDING_QUESTIONS.length) {
      return NextResponse.json({ done: true, aiConfig });
    }

    // Use Claude to extract the answer from the user's natural language response
    const currentQuestion = ONBOARDING_QUESTIONS[currentStep];

    const extractResponse = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 300,
      system: `You are helping set up an AI sales agent. The user was asked: "${currentQuestion.question}"
Their response is below. Extract the relevant information and return JSON:
{
  "value": "the extracted answer (clean and usable as a config value)",
  "followUp": "optional follow-up question if the answer was unclear or incomplete, otherwise null"
}

For the "tone" question, map their answer to one of: "professional", "friendly", or "casual".
For objections, format as: "Objection → How to handle it" (one per line).
Keep values concise but complete.`,
      messages: [{ role: "user", content: message }],
    });

    const textBlock = extractResponse.content.find(b => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";

    let value = message;
    let followUp: string | null = null;

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        value = parsed.value || message;
        followUp = parsed.followUp || null;
      }
    } catch { /* use raw message */ }

    // Save the answer
    const updatedConfig = { ...aiConfig, [currentQuestion.key]: value };
    const nextStep = followUp ? currentStep : currentStep + 1;

    await sql`
      UPDATE workspaces SET
        ai_config = ${JSON.stringify(updatedConfig)}::jsonb,
        onboarding_step = ${nextStep}
      WHERE id = ${workspace.id}
    `;

    // Determine next message
    let botMessage: string;
    const done = nextStep >= ONBOARDING_QUESTIONS.length;

    if (followUp) {
      botMessage = followUp;
    } else if (done) {
      // Mark onboarding complete and enable the agent
      const finalConfig = { ...updatedConfig, enabled: true, followUpEnabled: true, followUpHours: [24, 72, 168, 336] };
      await sql`
        UPDATE workspaces SET
          ai_config = ${JSON.stringify(finalConfig)}::jsonb,
          onboarding_complete = true
        WHERE id = ${workspace.id}
      `;
      botMessage = `Your AI Sales Agent is ready! Here's what I set up:\n\n` +
        `Business: ${finalConfig.businessName}\n` +
        `Type: ${finalConfig.businessType}\n` +
        `Services: ${finalConfig.services}\n` +
        `Area: ${finalConfig.serviceArea}\n` +
        `Tone: ${finalConfig.tone}\n\n` +
        `Your agent will start handling leads automatically. You can fine-tune everything in Settings → AI Sales Agent.`;
    } else {
      // Fun transitions between questions
      const transitions = [
        "Got it!",
        "Perfect.",
        "Love it.",
        "Nice!",
        "Great, that helps a lot.",
        "Awesome.",
        "Good stuff.",
        "That's helpful.",
      ];
      const transition = transitions[nextStep % transitions.length];
      botMessage = `${transition} ${ONBOARDING_QUESTIONS[nextStep].question}`;
    }

    return NextResponse.json({
      botMessage,
      done,
      step: nextStep,
      totalSteps: ONBOARDING_QUESTIONS.length,
      savedKey: currentQuestion.key,
      savedValue: value,
    });
  } catch (err) {
    console.error("[onboard] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// GET /api/ai-agent/onboard — get onboarding status
export async function GET() {
  try {
    const workspace = await getOrCreateWorkspace();
    const step = workspace.onboarding_step || 0;
    const done = workspace.onboarding_complete || false;

    return NextResponse.json({
      done,
      step,
      totalSteps: ONBOARDING_QUESTIONS.length,
      currentQuestion: step < ONBOARDING_QUESTIONS.length ? ONBOARDING_QUESTIONS[step].question : null,
      firstMessage: step === 0 ? `Hey! I'm going to set up your AI Sales Agent. I just need to ask you a few quick questions about your business so I know how to sell for you.\n\n${ONBOARDING_QUESTIONS[0].question}` : null,
    });
  } catch (err) {
    console.error("[onboard-status] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
