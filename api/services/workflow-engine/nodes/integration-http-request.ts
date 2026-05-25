'use strict';

import type { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../src/types/automation.js';
import { expressionService } from '../expression.service.js';
import axios, { AxiosRequestConfig } from 'axios';

/**
 * HTTP Request node.
 *
 * Makes HTTP calls to external APIs. Supports GET, POST, PUT, PATCH, DELETE.
 * Uses template expressions in url, query params, headers, and body.
 *
 * Configuration:
 *   - method      (text: GET|POST|PUT|PATCH|DELETE)    — HTTP method
 *   - url         (text, required)                     — Target URL
 *   - headers     (keyvalue)                           — Custom key-value headers
 *   - queryParams (keyvalue)                           — Query string params
 *   - bodyType    (text: json|raw|form)                — Body encoding
 *   - body        (textarea)                           — Request body
 *   - timeout     (number)                             — ms, default 10000
 */
export const integrationHttpRequest: NodeImplementation = {
  type: 'integration.http_request',
  category: 'integration',
  displayName: 'HTTP Request',
  description: 'Make an HTTP request to any external API.',
  iconName: 'send',
  color: '#8B5CF6',
  outputHandles: [
    { id: 'default', label: 'Response', color: '#10B981' },
    { id: 'error', label: 'Error', color: '#EF4444' },
  ],
  configSchema: [
    { key: 'method', label: 'Method', type: 'select', default: 'GET', options: [
      { label: 'GET', value: 'GET' },
      { label: 'POST', value: 'POST' },
      { label: 'PUT', value: 'PUT' },
      { label: 'PATCH', value: 'PATCH' },
      { label: 'DELETE', value: 'DELETE' },
    ]},
    { key: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://api.example.com/endpoint' },
    { key: 'headers', label: 'Headers', type: 'collection', collection: [
      { key: 'name', label: 'Header Name', type: 'text', required: true },
      { key: 'value', label: 'Value', type: 'text', required: true },
    ]},
    { key: 'bodyType', label: 'Body Type', type: 'select', default: 'json', options: [
      { label: 'JSON', value: 'json' },
      { label: 'Raw', value: 'raw' },
      { label: 'Form (URL-encoded)', value: 'form' },
    ]},
    { key: 'body', label: 'Body', type: 'textarea' },
    { key: 'timeout', label: 'Timeout (ms)', type: 'number', default: 10000 },
  ] as NodeConfigField[],

  async execute(config: Record<string, unknown>, items: WorkflowItem[], context: ExecutionContext): Promise<NodeExecuteResult> {
    const method = (config.method as string) ?? 'GET';
    let url = (config.url as string) ?? '';
    const headers = (config.headers as Array<{ name: string; value: string }>) ?? [];
    const bodyType = (config.bodyType as string) ?? 'json';
    let body = config.body as string | undefined;
    const timeout = Number(config.timeout) || 10000;

    if (!url) throw new Error('URL is required for HTTP request.');

    // If there's no input items (e.g., trigger node with no item), use the raw config values.
    // If there are input items, the config has already been resolved by the engine's
    // expressionService.resolveConfig against the first item.
    // For per-item processing (HTTP request per input item), we resolve per item here.
    const itemsToProcess = items.length > 0 ? items : [{ json: {} }];

    const output: WorkflowItem[] = [];

    for (const item of itemsToProcess) {
      let resolvedUrl = url;
      let resolvedBody = body;

      // If we have multiple input items and config wasn't resolved against this specific item,
      // resolve per-item. If items.length === 1, the engine already resolved it.
      if (items.length > 1) {
        resolvedUrl = expressionService.resolveExpression(url, context, item);

        if (body) {
          resolvedBody = expressionService.resolveExpression(body, context, item);
        }

        // Resolve headers per item
        for (const [hi, h] of headers.entries()) {
          headers[hi] = {
            ...h,
            name: expressionService.resolveExpression(h.name, context, item) as string,
            value: expressionService.resolveExpression(h.value, context, item) as string,
          };
        }
      }

      // Build axios config
      const axiosConfig: AxiosRequestConfig = {
        method: method as AxiosRequestConfig['method'],
        url: resolvedUrl,
        headers: {
          'Content-Type': bodyType === 'form' ? 'application/x-www-form-urlencoded' : bodyType === 'json' ? 'application/json' : 'text/plain',
          ...Object.fromEntries(headers.map(h => [h.name, h.value])),
        },
        timeout,
        maxRedirects: 5,
        validateStatus: () => true, // Accept all status codes, let the node handle them
      };

      // Attach body for applicable methods
      if (resolvedBody && method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        if (bodyType === 'json') {
          try {
            axiosConfig.data = typeof resolvedBody === 'string' ? JSON.parse(resolvedBody) : resolvedBody;
          } catch {
            axiosConfig.data = resolvedBody; // Send as-is if not valid JSON
          }
        } else if (bodyType === 'form') {
          axiosConfig.data = new URLSearchParams(resolvedBody).toString();
        } else {
          axiosConfig.data = resolvedBody;
        }
      }

      const startMs = Date.now();

      try {
        const response = await axios(axiosConfig);
        const duration = Date.now() - startMs;

        // Try to parse response body as JSON
        let responseBody: unknown = response.data;
        if (typeof response.data === 'string') {
          try {
            responseBody = JSON.parse(response.data);
          } catch {
            responseBody = response.data;
          }
        }

        output.push({
          json: {
            statusCode: response.status,
            statusText: response.statusText,
            body: responseBody,
            headers: response.headers,
            duration,
            url: resolvedUrl,
          },
        });
      } catch (error: unknown) {
        // Axios errors (network, timeout) also captured
        const duration = Date.now() - startMs;
        const message = error instanceof Error ? error.message : String(error);
        output.push({
          json: {
            statusCode: 0,
            statusText: 'Error',
            body: null,
            headers: {},
            duration,
            url: resolvedUrl,
            _error: message,
          },
        });
      }
    }

    return { output };
  },
};
