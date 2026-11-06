/**
 * Assistant Orchestrator — Stone AIO
 * Spec Section 2.5, 2.7, 2.8, 2.9
 */

import { assistantRepo } from './assistant.repo.js';
import { chatEngine } from '../../../packages/ai/engine/chat-engine.js';
import { buildSystemPrompt } from '../../../packages/ai/prompts/assistant.v1.js';
import { evaluateModeGate, type AccessMode } from './modes.js';
import { toolRegistry } from './tools/registry.js';
import { memoryService } from './memory.service.js';
import type { Response } from 'express';

export interface OrchestratorRunOptions {
  workspaceId: string;
  userId: string;
  userRole?: string;
  userName?: string;
  workspaceName?: string;
  conversationId: string;
  content: string;
  attachments?: Array<{ type: 'image' | 'file'; name: string; mimeType: string; data: string }>;
  thinking?: string;
  mode?: string;
  surface?: string;
  entity?: { type: string; id: string; name?: string };
  res?: Response;
  signal?: AbortSignal;
}

export class AssistantOrchestrator {
  private maxInputChars = Number(process.env.ASSISTANT_MAX_INPUT_CHARS) || 20000;
  private maxToolLoops = 5;

  /**
   * Main execution loop for sending a message, running tool loop, and streaming the reply.
   */
  async streamTurn(options: OrchestratorRunOptions): Promise<void> {
    const {
      workspaceId,
      userId,
      userRole = 'member',
      userName = 'Member',
      workspaceName = 'Stone AIO',
      conversationId,
      content,
      res,
      signal,
    } = options;

    if (!content || !content.trim()) {
      if (res) {
        res.status(400).json({ error: 'Message content cannot be empty' });
      }
      return;
    }

    if (content.length > this.maxInputChars) {
      if (res) {
        res.status(400).json({ error: `Message is too long. Limit is ${this.maxInputChars} characters.` });
      }
      return;
    }

    // 1. Fetch conversation and verify ownership
    const convo = await assistantRepo.getConversation(workspaceId, userId, conversationId);
    if (!convo) {
      if (res) {
        res.status(404).json({ error: 'Conversation not found' });
      }
      return;
    }

    // 2. Fetch user settings & workspace settings
    const settings = await assistantRepo.getSettings(workspaceId, userId);
    const wsSettings = await assistantRepo.getWorkspaceSettings(workspaceId);

    const thinking = options.thinking || convo.thinking || settings.thinking || 'auto';
    const effectiveMode = options.mode || convo.mode || 'read_only';

    // 3. Format user message parts (text + multimodal attachments)
    const userParts: any[] = [{ type: 'text', text: content.trim() }];
    if (options.attachments && Array.isArray(options.attachments)) {
      for (const att of options.attachments) {
        userParts.push({
          type: 'image',
          mimeType: att.mimeType,
          data: att.data,
          name: att.name,
        });
      }
    }

    // Save user message immediately in database
    const userMessage = await assistantRepo.saveUserMessage(workspaceId, userId, conversationId, {
      content: content.trim(),
      parts: userParts,
    });

    // 4. Setup SSE headers on response
    if (res) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      // Send initial message_start event
      this.sendSSE(res, 'message_start', { userMessageId: userMessage.id });
    }

    // 15-second SSE heartbeat comment
    const heartbeat = setInterval(() => {
      if (res && !res.writableEnded) {
        res.write(': ping\n\n');
      }
    }, 15000);

    // 5. Build conversation history for model
    const history = (convo.messages || []).map((m) => ({
      role: m.role as 'user' | 'assistant',
      parts: (m.parts as any) || [{ type: 'text', text: m.searchableText || '' }],
    }));
    history.push({
      role: 'user',
      parts: userParts,
    });

    // 6. Build system prompt & inject memories
    const memoriesBlock = await memoryService.getMemoriesPromptBlock(workspaceId, userId);
    const basePrompt = buildSystemPrompt({
      userName,
      role: userRole,
      workspaceName,
      mode: effectiveMode,
      includeToolParagraph: true,
    });
    let systemPrompt = memoriesBlock ? `${basePrompt}\n${memoriesBlock}` : basePrompt;

    if (options.surface) {
      if (options.entity?.id) {
        systemPrompt += `\n\n[Context: The user is currently viewing ${options.entity.type || 'record'} id "${options.entity.id}"${options.entity.name ? ` (${options.entity.name})` : ''} on the ${options.surface} page.]`;
      } else {
        systemPrompt += `\n\n[Context: The user is currently on the ${options.surface} page.]`;
      }
    }

    // Function declarations for Gemini
    const toolDeclarations = toolRegistry.getGeminiFunctionDeclarations();
    const toolsConfig = toolDeclarations.length > 0 ? [{ functionDeclarations: toolDeclarations }] : undefined;

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let accumulatedText = '';
    let isStopped = false;
    let turnHasUntrustedContent = Boolean(options.attachments && options.attachments.length > 0);

    try {
      // 7. Multi-turn Tool Execution Loop
      for (let loopIndex = 0; loopIndex < this.maxToolLoops; loopIndex++) {
        if (signal?.aborted) {
          isStopped = true;
          break;
        }

        const stream = chatEngine.stream(history, {
          systemPrompt,
          thinking,
          tools: toolsConfig,
          signal,
        });

        const pendingFunctionCalls: Array<{ id?: string; name: string; args: Record<string, unknown>; thoughtSignature?: string }> = [];

        for await (const event of stream) {
          if (signal?.aborted) {
            isStopped = true;
            break;
          }

          if (event.type === 'delta') {
            accumulatedText += event.text;
            if (res) {
              this.sendSSE(res, 'delta', { text: event.text });
            }
          } else if (event.type === 'thought_summary') {
            if (res) {
              this.sendSSE(res, 'thought_summary', { text: event.text });
            }
          } else if (event.type === 'function_call') {
            pendingFunctionCalls.push(event);
          } else if (event.type === 'done') {
            totalInputTokens += event.inputTokens;
            totalOutputTokens += event.outputTokens;
            if (event.functionCalls && pendingFunctionCalls.length === 0) {
              pendingFunctionCalls.push(...event.functionCalls);
            }
          } else if (event.type === 'error') {
            if (res) {
              this.sendSSE(res, 'error', {
                code: event.code,
                message: event.message,
                retryable: event.retryable,
              });
            }
            clearInterval(heartbeat);
            if (res && !res.writableEnded) res.end();
            return;
          }
        }

        if (isStopped || signal?.aborted) {
          break;
        }

        // If no function calls made, turn is complete
        if (pendingFunctionCalls.length === 0) {
          break;
        }

        // Handle each function call through the Mode Gate
        let pauseTurnAfterCall = false;

        for (const fc of pendingFunctionCalls) {
          const tool = toolRegistry.getTool(fc.name);
          if (!tool) {
            // Tool not found
            history.push({
              role: 'assistant',
              parts: [{ type: 'function_call', name: fc.name, args: fc.args }],
            });
            history.push({
              role: 'user',
              parts: [{ type: 'function_response', name: fc.name, response: { error: `Tool ${fc.name} not found.` } }],
            });
            continue;
          }

          // Evaluate authorization and mode gating
          const decision = evaluateModeGate({
            chatMode: effectiveMode as AccessMode,
            workspaceMaxMode: wsSettings.maxMode as AccessMode,
            userRole,
            toolRisk: tool.risk,
            minimumRole: tool.minimumRole,
            affectedRecordsCount: tool.affectedRecordsCount ? tool.affectedRecordsCount(fc.args) : 1,
            bulkThreshold: wsSettings.bulkThreshold || 25,
            requiresExplicitApproval: tool.requiresExplicitApproval,
            hasUntrustedContent: turnHasUntrustedContent,
            isPaused: !wsSettings.enabled,
          });

          if (decision.action === 'execute') {
            // Flag turn as possessing untrusted content if this tool fetches external/inbound data
            if (tool.isUntrustedContentSource) {
              turnHasUntrustedContent = true;
            }

            // 1. Create tool call in DB as running
            const toolCallRecord = await assistantRepo.createToolCall(workspaceId, userId, {
              conversationId,
              toolName: fc.name,
              risk: tool.risk,
              args: fc.args,
              status: 'running',
            });

            if (res) {
              this.sendSSE(res, 'tool_start', {
                toolCallId: toolCallRecord.id,
                toolName: fc.name,
                args: fc.args,
              });
            }

            // 2. Execute tool
            const execResult = await toolRegistry.execute(fc.name, fc.args, {
              workspaceId,
              userId,
              userRole,
              userName,
              conversationId,
            });

            // 3. Update DB record
            await assistantRepo.updateToolCall(workspaceId, toolCallRecord.id, {
              status: execResult.error ? 'failed' : 'done',
              result: execResult.result,
              error: execResult.error,
              executedAt: new Date(),
            });

            if (res) {
              this.sendSSE(res, 'tool_result', {
                toolCallId: toolCallRecord.id,
                toolName: fc.name,
                result: execResult.result,
                error: execResult.error,
              });
            }

            // 4. Feed back to model history
            history.push({
              role: 'assistant',
              parts: [{
                type: 'function_call',
                name: fc.name,
                args: fc.args,
                ...(fc.thoughtSignature ? { thoughtSignature: fc.thoughtSignature } : {}),
              }],
            });
            history.push({
              role: 'user',
              parts: [
                {
                  type: 'function_response',
                  name: fc.name,
                  response: { output: execResult.result || { error: execResult.error } },
                },
              ],
            });
          } else if (decision.action === 'proposal') {
            // Save as pending proposal for user approval
            const toolCallRecord = await assistantRepo.createToolCall(workspaceId, userId, {
              conversationId,
              toolName: fc.name,
              risk: tool.risk,
              args: fc.args,
              status: 'pending',
            });

            if (res) {
              this.sendSSE(res, 'proposal', {
                toolCallId: toolCallRecord.id,
                toolName: fc.name,
                args: fc.args,
                reason: decision.reason || 'Draft proposal',
              });
            }
            pauseTurnAfterCall = true;
          } else if (decision.action === 'needs_approval') {
            // High risk / hard stop requiring explicit approval
            const toolCallRecord = await assistantRepo.createToolCall(workspaceId, userId, {
              conversationId,
              toolName: fc.name,
              risk: tool.risk,
              args: fc.args,
              status: 'pending',
            });

            if (res) {
              this.sendSSE(res, 'needs_approval', {
                toolCallId: toolCallRecord.id,
                toolName: fc.name,
                args: fc.args,
                reason: decision.reason,
              });
            }
            pauseTurnAfterCall = true;
          } else if (decision.action === 'mode_prompt') {
            // User mode is unset
            if (res) {
              this.sendSSE(res, 'mode_prompt', {
                toolName: fc.name,
              });
            }
            pauseTurnAfterCall = true;
          } else if (decision.action === 'blocked') {
            await assistantRepo.createToolCall(workspaceId, userId, {
              conversationId,
              toolName: fc.name,
              risk: tool.risk,
              args: fc.args,
              status: 'blocked',
              error: decision.reason,
            });

            if (res) {
              this.sendSSE(res, 'blocked', {
                toolName: fc.name,
                reason: decision.reason,
              });
            }

            history.push({
              role: 'assistant',
              parts: [{ type: 'function_call', name: fc.name, args: fc.args }],
            });
            history.push({
              role: 'user',
              parts: [
                {
                  type: 'function_response',
                  name: fc.name,
                  response: { output: { error: decision.reason } },
                },
              ],
            });
          } else if (decision.action === 'no_permission') {
            await assistantRepo.createToolCall(workspaceId, userId, {
              conversationId,
              toolName: fc.name,
              risk: tool.risk,
              args: fc.args,
              status: 'blocked',
              error: 'Insufficient permissions',
            });

            if (res) {
              this.sendSSE(res, 'no_permission', {
                toolName: fc.name,
                requiredRole: decision.requiredRole,
                currentRole: decision.currentRole,
              });
            }

            history.push({
              role: 'assistant',
              parts: [{ type: 'function_call', name: fc.name, args: fc.args }],
            });
            history.push({
              role: 'user',
              parts: [
                {
                  type: 'function_response',
                  name: fc.name,
                  response: {
                    output: {
                      error: `You do not have permission to run this action. Required role: ${decision.requiredRole}.`,
                    },
                  },
                },
              ],
            });
          }
        }

        // If turn was paused by a proposal or approval gate, stop outer loop
        if (pauseTurnAfterCall) {
          break;
        }
      }

      // 8. Persist assistant message
      if (accumulatedText.trim() || isStopped) {
        const assistantMessage = await assistantRepo.saveAssistantMessage(workspaceId, userId, conversationId, {
          parts: [{ type: 'text', text: accumulatedText }],
          model: process.env.GEMINI_CHAT_MODEL || 'gemini-3.8-flash',
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          status: isStopped ? 'stopped' : 'complete',
        });

        // 9. Generate title if this was the first exchange
        const exchangeCount = (convo.messages || []).length;
        if (exchangeCount <= 1 && convo.title === 'New Conversation') {
          const generatedTitle = await chatEngine.generateTitle(content);
          if (generatedTitle && generatedTitle !== convo.title) {
            await assistantRepo.updateConversation(workspaceId, userId, conversationId, {
              title: generatedTitle,
            });
            if (res) {
              this.sendSSE(res, 'title', { title: generatedTitle });
            }
          }
        }

        // 10. Increment daily usage & extract memory facts
        await assistantRepo.incrementUsage(workspaceId, userId, {
          messages: 1,
          tokens: totalInputTokens + totalOutputTokens,
        });

        // Trigger memory extraction in background
        memoryService.maybeExtractMemories(workspaceId, userId, content).catch((err) => {
          console.warn('[AssistantMemory] Background memory extraction failed:', err);
        });

        if (res) {
          this.sendSSE(res, 'done', {
            assistantMessageId: assistantMessage.id,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
          });
        }
      }
    } catch (err: unknown) {
      console.error('[Orchestrator error]:', err);
      if (res) {
        this.sendSSE(res, 'error', {
          code: 'provider_error',
          message: 'Something went wrong. Please try again.',
          retryable: true,
        });
      }
    } finally {
      clearInterval(heartbeat);
      if (res && !res.writableEnded) {
        res.end();
      }
    }
  }

  private sendSSE(res: Response, eventName: string, data: Record<string, unknown>): void {
    if (!res.writableEnded) {
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  }
}

export const assistantOrchestrator = new AssistantOrchestrator();
