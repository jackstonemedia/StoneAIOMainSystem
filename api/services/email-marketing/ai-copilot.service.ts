/**
 * AI Campaign Copilot Service — Email Marketing Module
 *
 * Structured 8-question intake that works like a marketing agency discovery call.
 * The AI follows a defined question sequence EVERY time before generating anything.
 * A/B testing is never assumed — it is explicitly asked as one of the 8 questions.
 * Output includes a full week-by-week email preview alongside the campaign JSON.
 */

import { getAIClient, DEFAULT_MODEL } from '../../../packages/ai/client.js';
import { db } from '../../../infrastructure/database/client.js';
import { EmailEventType } from '@prisma/client';

export interface HistoricalPerformanceSummary {
  totalCampaignsSent: number;
  avgOpenRate: number;
  avgClickRate: number;
  topSubjectLines: { subject: string; openRate: number; variant?: string }[];
  abTestInsights: {
    totalAbTests: number;
    winningMetric: string;
    keyLearnings: string[];
  };
}

/**
 * Gathers and analyzes historical email marketing performance data for a workspace
 */
export async function getWorkspaceHistoricalPerformance(workspaceId: string): Promise<HistoricalPerformanceSummary> {
  const campaigns = await db.campaign.findMany({
    where: { workspaceId, status: 'SENT' },
    include: { recipients: true },
    take: 20,
    orderBy: { createdAt: 'desc' },
  });

  if (campaigns.length === 0) {
    return {
      totalCampaignsSent: 0,
      avgOpenRate: 0,
      avgClickRate: 0,
      topSubjectLines: [],
      abTestInsights: {
        totalAbTests: 0,
        winningMetric: 'open_rate',
        keyLearnings: ['No previous campaign history. Defaulting to industry best practices.'],
      },
    };
  }

  let totalRecipients = 0;
  let totalOpens = 0;
  let totalClicks = 0;
  let abTestCount = 0;
  const subjectStats: { subject: string; openRate: number }[] = [];
  const keyLearnings: string[] = [];

  for (const campaign of campaigns) {
    const recCount = campaign.recipients.length;
    if (recCount === 0) continue;
    totalRecipients += recCount;

    const events = await db.emailEvent.findMany({
      where: { campaignId: campaign.id },
      select: { eventType: true },
    });

    const opens = events.filter(e => e.eventType === EmailEventType.OPENED).length;
    const clicks = events.filter(e => e.eventType === EmailEventType.CLICKED).length;
    totalOpens += opens;
    totalClicks += clicks;

    subjectStats.push({ subject: campaign.subject, openRate: opens / recCount });

    const ab = campaign.abTestConfig as any;
    if (ab?.enabled) {
      abTestCount++;
      if (ab.winnerVariant) {
        keyLearnings.push(
          `Variant ${ab.winnerVariant} won in "${campaign.name}" (${ab.winnerMetric === 'click_rate' ? 'higher CTR' : 'higher open rate'})`
        );
      }
    }
  }

  subjectStats.sort((a, b) => b.openRate - a.openRate);

  return {
    totalCampaignsSent: campaigns.length,
    avgOpenRate: Number((totalRecipients > 0 ? totalOpens / totalRecipients : 0).toFixed(3)),
    avgClickRate: Number((totalRecipients > 0 ? totalClicks / totalRecipients : 0).toFixed(3)),
    topSubjectLines: subjectStats.slice(0, 5),
    abTestInsights: {
      totalAbTests: abTestCount,
      winningMetric: 'open_rate',
      keyLearnings: keyLearnings.length > 0
        ? keyLearnings
        : ['Past A/B tests indicate personalized, curiosity-driven subjects perform highest.'],
    },
  };
}

/**
 * Runs the structured campaign intake interview or generates the final campaign.
 *
 * QUESTION ORDER (never skip, never reorder):
 *  Q1 — Campaign goal & what you're selling/offering
 *  Q2 — Target audience: role, industry, company size
 *  Q3 — Preferred tone: professional, casual, direct, consultative
 *  Q4 — How many emails in the sequence total?
 *  Q5 — Follow-up cadence: how many days between each email?
 *  Q6 — Non-responder handling: max emails before stopping, and what triggers a stop (reply, click, or both)
 *  Q7 — A/B split testing: does the user want it, and if so, what to test (subject line, opening hook, CTA)?
 *  Q8 — Any specific CTA, offer, or landing page to include?
 *
 * After Q8 is answered → generate full campaign with week-by-week preview.
 */
export async function runCampaignCopilotInterview(
  workspaceId: string,
  userMessage: string,
  chatHistory: Array<{ role: 'user' | 'model'; content: string }> = [],
  currentDraft?: any
): Promise<{
  reply: string;
  isComplete: boolean;
  generatedCampaign?: any;
}> {
  const historyStats = await getWorkspaceHistoricalPerformance(workspaceId);

  const systemInstruction = `
You are the Stone AIO Email Marketing Strategist — an expert marketing agency consultant who runs a structured discovery call with every client before creating any campaign.

Your role is to ask a precise set of 8 intake questions, in ORDER, one or two at a time. NEVER skip ahead, NEVER assume answers, and NEVER generate a campaign until ALL 8 questions have been answered.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY INTAKE QUESTIONS — FOLLOW THIS ORDER EVERY TIME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Q1. What is the goal of this campaign, and what are you promoting or offering?
     (e.g., book a demo, get a free trial, sell a product, drive event registrations)

Q2. Who is your target audience?
     (job title/role, industry, company size, seniority level — be specific)

Q3. What tone should these emails have?
     (e.g., professional & direct, casual & conversational, consultative, urgent, educational)

Q4. How many emails do you want in this sequence, and what is the overall length in days?
     (e.g., 3 emails over 10 days, 5 emails over 21 days)

Q5. What should the follow-up cadence look like between emails?
     (e.g., Day 0, Day 3, Day 7 — or every 2 days, weekly, etc.)

Q6. What should happen when someone doesn't respond?
     (How many no-reply emails before stopping? Should the sequence stop on a reply, a click, or both?)

Q7. Do you want A/B split testing on this campaign?
     If yes — what do you want to test? (subject line, opening hook, CTA wording, email length)

Q8. What is the specific CTA (call-to-action) you want recipients to take, and is there a link, landing page, or offer to include?
     (e.g., "Book a 15-min call at calendly.com/you", "Start free trial at app.yourproduct.com")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTAKE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Ask at most 2 questions per message. Group Q1+Q2 together for the opening.
- After each user answer, acknowledge briefly (1 sentence max), then ask the next question(s).
- NEVER ask all 8 at once.
- NEVER generate the campaign before all 8 are answered.
- NEVER assume the user wants A/B testing — Q7 is where you ask.
- If the user gives a vague or partial answer, ask a brief follow-up before moving on.
- Keep your messages warm, direct, and consultative — like a real marketing strategist.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WORKSPACE HISTORICAL INTELLIGENCE (use to inform your advice)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Total Sent Campaigns: ${historyStats.totalCampaignsSent}
- Avg Open Rate: ${(historyStats.avgOpenRate * 100).toFixed(1)}%
- Avg Click Rate: ${(historyStats.avgClickRate * 100).toFixed(1)}%
- Top Subjects: ${historyStats.topSubjectLines.map(s => `"${s.subject}" (${(s.openRate * 100).toFixed(1)}% open)`).join(', ') || 'None yet'}
- A/B Learnings: ${historyStats.abTestInsights.keyLearnings.join('; ')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GENERATING THE CAMPAIGN (only after ALL 8 questions are answered)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When all 8 questions are answered:

1. Write a brief 2–3 sentence strategy summary that confirms the plan back to the user.
2. Show a "📅 Week-by-Week Email Preview" as a readable, human-friendly breakdown BEFORE the JSON. For each step, show:
   - Day number, step title, subject line
   - A 3–4 sentence preview of the email body (not the full body, just a preview)
   - The CTA for that step
   - Whether it stops on reply
3. Then output the full JSON in a markdown \`\`\`json block.

DELIVERABILITY REQUIREMENTS (always apply):
- Use personalization tokens: {{first_name}}, {{business_name}}
- Write in a conversational, human tone — no corporate jargon
- One clear CTA per email
- Short paragraphs (2–3 lines max)
- Include {{unsubscribe_link}} in every body
- No spam trigger words: "free", "guaranteed", "act now", "limited time offer" in subject lines

JSON FORMAT (use exactly this structure):
\`\`\`json
{
  "campaignName": "string",
  "strategySummary": "string",
  "targetAudience": "string",
  "abTest": {
    "enabled": false,
    "hypothesis": null,
    "subjectA": null,
    "subjectB": null,
    "previewTextA": null,
    "previewTextB": null,
    "bodyHtmlA": null,
    "bodyHtmlB": null
  },
  "dripSteps": [
    {
      "stepNumber": 1,
      "title": "string",
      "delayDays": 0,
      "delayHours": 0,
      "subject": "string",
      "body": "Hi {{first_name}},\\n\\nComplete full-length email message copy with greeting, paragraphs, bullet points, call to action, and sign-off.\\n\\nBest,\\n{{name}}",
      "threadWithPrevious": false,
      "stopOnReply": true
    }
  ],
  "sequenceSummary": {
    "totalEmails": 3,
    "totalDays": 10,
    "stopCondition": "reply_or_click",
    "maxEmailsIfNoReply": 3
  },
  "deliverySettings": {
    "humanJitterEnabled": true,
    "sendingWindowEnabled": true,
    "startHour": 8,
    "endHour": 18
  }
}
\`\`\`

CRITICAL COPYWRITING RULE:
Every single step inside \`dripSteps\` in the JSON MUST have the COMPLETE, FULL-LENGTH email body in the \`"body"\` field — written in full, ready to send immediately. Do NOT write placeholders, summaries, or leave body empty.
If A/B testing is enabled, populate \`abTest.bodyHtmlA\` and \`abTest.bodyHtmlB\` with full complete email text as well.

`;

  const contents: any[] = [];
  for (const msg of chatHistory) {
    contents.push({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }

  const promptWithContext = [
    currentDraft && `Current Campaign Draft: ${JSON.stringify(currentDraft)}`,
    `User: ${userMessage}`,
  ].filter(Boolean).join('\n\n');

  contents.push({
    role: 'user',
    parts: [{ text: promptWithContext }],
  });

  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents,
    config: {
      systemInstruction,
      temperature: 0.65,
    },
  });

  const text = (response.text || '').trim();

  // Extract JSON block if present
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      // Everything before the json block is the conversational part (strategy summary + weekly preview)
      const conversationalPart = text.replace(/```json[\s\S]*?```/gi, '').trim()
        || 'Here is your custom-tailored campaign sequence built from your brief.';
      return {
        reply: conversationalPart,
        isComplete: true,
        generatedCampaign: parsed,
      };
    } catch {
      // Fall through — JSON parse failed, treat as conversational
    }
  }

  return {
    reply: text,
    isComplete: false,
  };
}
