import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

const router = Router();

// Node registry summary for the system prompt
const NODE_REGISTRY = `
Available Workflow Nodes (use these exact IDs):

TRIGGERS:
- trigger-webhook: Webhook (receive HTTP requests). Keys: method, path, auth, secret, responseCode, responseBody
- trigger-schedule: Schedule/Cron (run on schedule). Keys: mode, interval, cronExpression, timezone
- trigger-email-received: Email Received. Keys: provider, fromFilter, subjectFilter, hasAttachment, markAsRead, folder
- trigger-crm-event: CRM Event (entity changes). Keys: entity, event, filters
- trigger-form: Form Submitted. Keys: formId, includeFields

AI & LOGIC:
- ai-llm: LLM Call (call AI model). Keys: model, systemPrompt, userPrompt, temperature, maxTokens, outputFormat, jsonSchema, retryOnFail, retryCount
- ai-sentiment: Sentiment Analysis. Keys: inputField, model, outputType, labels, confidenceThreshold
- ai-extract: Data Extractor (extract structured data). Keys: inputField, extractionSchema, model, instructions, multipleResults
- logic-if: If/Else (conditional branch). Keys: mode, field, operator, value, expression. Outputs: true, false
- logic-switch: Switch (multi-branch). Keys: field, cases, defaultCase. Outputs: case_1, case_2, case_3, default
- logic-loop: Loop (iterate array). Keys: inputArray, batchSize, maxIterations, failOnError, delayBetween
- logic-delay: Wait/Delay. Keys: mode, duration, unit, untilDate

DATA & CRM:
- data-code: Custom Code (JavaScript/Python). Keys: language, code, timeout, packages
- data-json: JSON Parser. Keys: action, inputField, jmesPath, pickFields, mergeWith
- crm-contact: Manage Contact. Keys: action, matchField, mappings, tags, assignTo
- crm-task: Manage Task. Keys: action, title, dueDate, priority, linkedContact
- db-query: Database Query. Keys: dbType, connectionString, query, parameters, timeout
- data-filter: Filter Data. Keys: inputArray, property, operator, value, logic

COMMUNICATION:
- comm-email: Send Email. Keys: provider, to, subject, body, from, replyTo, cc, bcc, trackOpens, trackClicks
- comm-sms: Send SMS. Keys: to, message, from, mediaUrl
- comm-voice: Make Voice Call. Keys: agentId, phoneNumber, firstMessage, maxDuration, recordCall
- comm-slack: Slack Message. Keys: channel, message, asBot, threadTs, blocks

INTEGRATIONS:
- int-http: HTTP Request. Keys: method, url, headers, body, auth, bearerToken, timeout, retryOnFail, retryCount, parseResponse
- int-stripe: Stripe. Keys: action, amount, currency, customerId, description, metadata
- int-shopify: Shopify. Keys: action, resourceId, fields, limit
- int-github: GitHub. Keys: action, repo, title, body, labels, assignees
- int-twitter: Twitter/X. Keys: action, text, mediaUrl, replyToId, searchQuery
- int-linkedin: LinkedIn. Keys: action, text, mediaUrl, visibility
- int-drive: Google Drive. Keys: action, filePath, folderId, mimeType, fileName
`;

const SYSTEM_PROMPT = `You are an expert workflow architect for Stone AIO. The user will describe what they want in natural language, and you generate a complete workflow as a JSON structure.

${NODE_REGISTRY}

RULES:
1. Always respond with a valid JSON object wrapped in \`\`\`json code fences.
2. The JSON must have this shape:
{
  "explanation": "Brief explanation of what this workflow does",
  "nodes": [
    {
      "id": "unique_string",
      "nodeDefId": "one of the node IDs above",
      "label": "human-readable label",
      "config": { ...key-value pairs from that node's Keys... }
    }
  ],
  "edges": [
    { "source": "node_id", "target": "node_id", "sourceHandle": "optional_handle" }
  ]
}
3. Every workflow MUST start with exactly one trigger node.
4. Use {{input}} or {{input.fieldName}} for referencing upstream data in templates.
5. For If/Else nodes, use sourceHandle "true" or "false" for edges from the true/false outputs.
6. For Switch nodes, use sourceHandle "case_1", "case_2", etc.
7. Position nodes logically — triggers first, then processing, then output.
8. Keep configs realistic and functional — fill in actual prompts, conditions, and templates.
9. If the user asks to MODIFY an existing workflow, they'll provide the current nodes/edges. Return the full updated workflow.
10. Always explain what the workflow does in the "explanation" field.
11. Make workflows ROBUST — add error handling, retries, and proper conditions where appropriate.`;

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { prompt, existingWorkflow, apiKey } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Use provided API key or env var
    const key = apiKey || process.env.GOOGLE_AI_API_KEY;
    if (!key) {
      return res.status(400).json({ 
        error: 'API key required',
        message: 'Set GOOGLE_AI_API_KEY environment variable or pass apiKey in the request body.'
      });
    }

    const ai = new GoogleGenAI({ apiKey: key });

    let userMessage = prompt;
    if (existingWorkflow) {
      userMessage += `\n\nCurrent workflow to modify:\n\`\`\`json\n${JSON.stringify(existingWorkflow, null, 2)}\n\`\`\``;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: userMessage }] }
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.3,
        maxOutputTokens: 4096,
      }
    });

    const text = response.text || '';
    
    // Extract JSON from response
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    if (!jsonMatch) {
      // Try parsing the entire response as JSON
      try {
        const parsed = JSON.parse(text);
        return res.json(parsed);
      } catch {
        return res.json({ explanation: text, nodes: [], edges: [] });
      }
    }

    const workflow = JSON.parse(jsonMatch[1]);
    return res.json(workflow);

  } catch (error: any) {
    console.error('Workflow AI error:', error);
    return res.status(500).json({ 
      error: 'Generation failed', 
      message: error.message || 'Unknown error' 
    });
  }
});

export default router;
