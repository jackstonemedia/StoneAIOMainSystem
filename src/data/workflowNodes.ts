import { 
  Zap, Clock, Users, Mail, MessageSquare, Phone, Globe, FormInput,
  Bot, GitBranch, Repeat, Search, Split, Combine, Filter, Code,
  Database, HardDrive, Share2, Layers, ListFilter,
  Slack, Twitter, Github, Linkedin, CreditCard, ShoppingCart
} from 'lucide-react';

export type WorkflowNodeCategory = 'Triggers' | 'AI & Logic' | 'Communication' | 'Data & CRM' | 'Integrations';

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'toggle' | 'code'
      | 'json' | 'keyvalue' | 'cron' | 'template' | 'tags';
  default: any;
  placeholder?: string;
  options?: { label: string; value: string }[];
  language?: string;
  required?: boolean;
  advanced?: boolean;
  helpText?: string;
  validation?: { min?: number; max?: number; pattern?: string };
  dependsOn?: { field: string; value: any };
}

export interface WorkflowNodeDefinition {
  id: string;
  category: WorkflowNodeCategory;
  name: string;
  description: string;
  type: string;
  icon: any;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  configFields: ConfigField[];
  outputs: string[];
}

// ────────────────────────────────────────────────────────
//  TRIGGERS
// ────────────────────────────────────────────────────────

const triggerWebhook: WorkflowNodeDefinition = {
  id: 'trigger-webhook', category: 'Triggers', name: 'Webhook', description: 'Receive HTTP POST/GET requests',
  type: 'trigger', icon: Zap,
  colorClass: 'text-primary', bgClass: 'bg-primary/10', borderClass: 'hover:border-primary/50',
  outputs: ['data'],
  configFields: [
    { key: 'method', label: 'HTTP Method', type: 'select', default: 'POST', options: [
      { label: 'GET', value: 'GET' }, { label: 'POST', value: 'POST' },
      { label: 'PUT', value: 'PUT' }, { label: 'DELETE', value: 'DELETE' }
    ], helpText: 'HTTP method this webhook listens for' },
    { key: 'path', label: 'Path', type: 'text', default: '/incoming', placeholder: '/my-webhook', helpText: 'URL path appended to your webhook base URL' },
    { key: 'auth', label: 'Authentication', type: 'select', default: 'none', advanced: true, options: [
      { label: 'None', value: 'none' }, { label: 'Bearer Token', value: 'bearer' },
      { label: 'Basic Auth', value: 'basic' }, { label: 'HMAC Signature', value: 'hmac' }
    ] },
    { key: 'secret', label: 'Secret / Token', type: 'text', default: '', advanced: true, placeholder: 'sk_...', dependsOn: { field: 'auth', value: 'bearer' } },
    { key: 'responseCode', label: 'Response Code', type: 'number', default: 200, advanced: true, validation: { min: 100, max: 599 } },
    { key: 'responseBody', label: 'Response Body', type: 'textarea', default: '{"ok": true}', advanced: true },
  ]
};

const triggerSchedule: WorkflowNodeDefinition = {
  id: 'trigger-schedule', category: 'Triggers', name: 'Schedule / Cron', description: 'Run on a recurring schedule',
  type: 'trigger', icon: Clock,
  colorClass: 'text-primary', bgClass: 'bg-primary/10', borderClass: 'hover:border-primary/50',
  outputs: ['tick'],
  configFields: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'interval', options: [
      { label: 'Simple Interval', value: 'interval' }, { label: 'Cron Expression', value: 'cron' }
    ] },
    { key: 'interval', label: 'Interval', type: 'select', default: 'daily', options: [
      { label: 'Every minute', value: '1m' }, { label: 'Every 5 minutes', value: '5m' },
      { label: 'Every 15 minutes', value: '15m' }, { label: 'Every hour', value: '1h' },
      { label: 'Every 6 hours', value: '6h' }, { label: 'Daily', value: 'daily' }, { label: 'Weekly', value: 'weekly' }
    ], dependsOn: { field: 'mode', value: 'interval' } },
    { key: 'cronExpression', label: 'Cron Expression', type: 'cron', default: '0 9 * * 1-5', advanced: false, dependsOn: { field: 'mode', value: 'cron' }, helpText: 'Standard cron syntax (min hour day month weekday)' },
    { key: 'timezone', label: 'Timezone', type: 'select', default: 'America/New_York', advanced: true, options: [
      { label: 'Eastern (US)', value: 'America/New_York' }, { label: 'Central (US)', value: 'America/Chicago' },
      { label: 'Pacific (US)', value: 'America/Los_Angeles' }, { label: 'UTC', value: 'UTC' },
      { label: 'London', value: 'Europe/London' }, { label: 'Berlin', value: 'Europe/Berlin' },
      { label: 'Tokyo', value: 'Asia/Tokyo' }
    ] },
  ]
};

const triggerEmailReceived: WorkflowNodeDefinition = {
  id: 'trigger-email-received', category: 'Triggers', name: 'Email Received', description: 'Trigger when a new email arrives',
  type: 'trigger', icon: Mail,
  colorClass: 'text-primary', bgClass: 'bg-primary/10', borderClass: 'hover:border-primary/50',
  outputs: ['email'],
  configFields: [
    { key: 'provider', label: 'Email Provider', type: 'select', default: 'gmail', options: [
      { label: 'Gmail', value: 'gmail' }, { label: 'Outlook', value: 'outlook' }, { label: 'IMAP', value: 'imap' }
    ] },
    { key: 'fromFilter', label: 'From Filter', type: 'text', default: '', placeholder: 'sender@example.com', helpText: 'Only trigger for emails from this address' },
    { key: 'subjectFilter', label: 'Subject Contains', type: 'text', default: '', placeholder: 'Invoice' },
    { key: 'hasAttachment', label: 'Must Have Attachment', type: 'toggle', default: false, advanced: true },
    { key: 'markAsRead', label: 'Mark as Read', type: 'toggle', default: true, advanced: true },
    { key: 'folder', label: 'Folder', type: 'text', default: 'INBOX', advanced: true },
  ]
};

const triggerCrmEvent: WorkflowNodeDefinition = {
  id: 'trigger-crm-event', category: 'Triggers', name: 'CRM Event', description: 'Trigger on CRM entity changes',
  type: 'trigger', icon: Users,
  colorClass: 'text-primary', bgClass: 'bg-primary/10', borderClass: 'hover:border-primary/50',
  outputs: ['record'],
  configFields: [
    { key: 'entity', label: 'Entity', type: 'select', default: 'contact', options: [
      { label: 'Contact', value: 'contact' }, { label: 'Company', value: 'company' },
      { label: 'Deal', value: 'deal' }, { label: 'Activity', value: 'activity' }
    ] },
    { key: 'event', label: 'Event', type: 'select', default: 'created', options: [
      { label: 'Created', value: 'created' }, { label: 'Updated', value: 'updated' },
      { label: 'Deleted', value: 'deleted' }, { label: 'Stage Changed', value: 'stage_changed' }
    ] },
    { key: 'filters', label: 'Filters (JSON)', type: 'json', default: '', advanced: true, helpText: 'Optional filter conditions' },
  ]
};

const triggerForm: WorkflowNodeDefinition = {
  id: 'trigger-form', category: 'Triggers', name: 'Form Submitted', description: 'Trigger on new form response',
  type: 'trigger', icon: FormInput,
  colorClass: 'text-primary', bgClass: 'bg-primary/10', borderClass: 'hover:border-primary/50',
  outputs: ['submission'],
  configFields: [
    { key: 'formId', label: 'Form', type: 'select', default: '', options: [ { label: '(Select a form)', value: '' } ], helpText: 'Choose from your created forms' },
    { key: 'includeFields', label: 'Include Fields', type: 'tags', default: [], advanced: true, helpText: 'Leave empty for all fields' },
  ]
};

// ────────────────────────────────────────────────────────
//  AI & LOGIC
// ────────────────────────────────────────────────────────

const aiLlm: WorkflowNodeDefinition = {
  id: 'ai-llm', category: 'AI & Logic', name: 'LLM Call', description: 'Call an AI language model',
  type: 'llm', icon: Bot,
  colorClass: 'text-amber', bgClass: 'bg-amber/10', borderClass: 'hover:border-amber/50',
  outputs: ['response'],
  configFields: [
    { key: 'model', label: 'Model', type: 'select', default: 'gemini-2.0-flash', required: true, options: [
      { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
      { label: 'GPT-4o', value: 'gpt-4o' },
      { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
      { label: 'Claude 3.5 Sonnet', value: 'claude-3.5-sonnet' },
    ] },
    { key: 'systemPrompt', label: 'System Prompt', type: 'textarea', default: '', placeholder: 'You are a helpful assistant that...', helpText: 'Sets the AI behavior and personality' },
    { key: 'userPrompt', label: 'User Prompt', type: 'template', default: 'Summarize: {{input}}', placeholder: 'Process this data: {{input.field}}', helpText: 'Use {{variable}} to reference upstream data' },
    { key: 'temperature', label: 'Temperature', type: 'number', default: 0.7, advanced: true, validation: { min: 0, max: 2 }, helpText: '0 = deterministic, 2 = creative' },
    { key: 'maxTokens', label: 'Max Tokens', type: 'number', default: 2000, advanced: true, validation: { min: 1, max: 128000 } },
    { key: 'outputFormat', label: 'Output Format', type: 'select', default: 'text', advanced: true, options: [
      { label: 'Text', value: 'text' }, { label: 'JSON', value: 'json' }, { label: 'Markdown', value: 'markdown' }
    ] },
    { key: 'jsonSchema', label: 'JSON Schema', type: 'code', default: '', language: 'json', advanced: true, dependsOn: { field: 'outputFormat', value: 'json' }, helpText: 'Expected JSON output shape' },
    { key: 'retryOnFail', label: 'Retry on Failure', type: 'toggle', default: true, advanced: true },
    { key: 'retryCount', label: 'Retry Count', type: 'number', default: 2, advanced: true, validation: { min: 0, max: 5 } },
  ]
};

const aiSentiment: WorkflowNodeDefinition = {
  id: 'ai-sentiment', category: 'AI & Logic', name: 'Sentiment Analysis', description: 'Analyze text sentiment',
  type: 'llm', icon: Search,
  colorClass: 'text-amber', bgClass: 'bg-amber/10', borderClass: 'hover:border-amber/50',
  outputs: ['result'],
  configFields: [
    { key: 'inputField', label: 'Input', type: 'text', default: '{{input}}', placeholder: '{{input.text}}' },
    { key: 'model', label: 'Model', type: 'select', default: 'gpt-4o-mini', options: [
      { label: 'GPT-4o Mini', value: 'gpt-4o-mini' }, { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' }
    ] },
    { key: 'outputType', label: 'Output Type', type: 'select', default: 'label', advanced: true, options: [
      { label: 'Label (positive/negative/neutral)', value: 'label' }, { label: 'Score (0-1)', value: 'score' }, { label: 'Both', value: 'both' }
    ] },
    { key: 'labels', label: 'Custom Labels', type: 'tags', default: ['positive', 'negative', 'neutral'], advanced: true },
    { key: 'confidenceThreshold', label: 'Confidence Threshold', type: 'number', default: 0.7, advanced: true, validation: { min: 0, max: 1 } },
  ]
};

const aiExtract: WorkflowNodeDefinition = {
  id: 'ai-extract', category: 'AI & Logic', name: 'Data Extractor', description: 'Extract structured data with AI',
  type: 'llm', icon: Layers,
  colorClass: 'text-amber', bgClass: 'bg-amber/10', borderClass: 'hover:border-amber/50',
  outputs: ['extracted'],
  configFields: [
    { key: 'inputField', label: 'Input', type: 'text', default: '{{input}}' },
    { key: 'extractionSchema', label: 'Extraction Schema', type: 'code', default: '{\n  "name": "",\n  "email": "",\n  "amount": 0\n}', language: 'json', helpText: 'JSON shape to extract from input' },
    { key: 'model', label: 'Model', type: 'select', default: 'gemini-2.0-flash', advanced: true, options: [
      { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' }, { label: 'GPT-4o', value: 'gpt-4o' }
    ] },
    { key: 'instructions', label: 'Extra Instructions', type: 'textarea', default: '', advanced: true, placeholder: 'Also look for...' },
    { key: 'multipleResults', label: 'Multiple Results', type: 'toggle', default: false, advanced: true, helpText: 'Return an array if multiple items found' },
  ]
};

const logicIf: WorkflowNodeDefinition = {
  id: 'logic-if', category: 'AI & Logic', name: 'If / Else', description: 'Branch based on a condition',
  type: 'tool', icon: GitBranch,
  colorClass: 'text-purple', bgClass: 'bg-purple/10', borderClass: 'hover:border-purple/50',
  outputs: ['true', 'false'],
  configFields: [
    { key: 'mode', label: 'Condition Mode', type: 'select', default: 'simple', options: [
      { label: 'Simple Comparison', value: 'simple' }, { label: 'JavaScript Expression', value: 'expression' }
    ] },
    { key: 'field', label: 'Field', type: 'text', default: '{{input.score}}', dependsOn: { field: 'mode', value: 'simple' }, helpText: 'Value to compare' },
    { key: 'operator', label: 'Operator', type: 'select', default: 'greater_than', dependsOn: { field: 'mode', value: 'simple' }, options: [
      { label: 'Equals', value: 'equals' }, { label: 'Not Equals', value: 'not_equals' },
      { label: 'Greater Than', value: 'greater_than' }, { label: 'Less Than', value: 'less_than' },
      { label: 'Contains', value: 'contains' }, { label: 'Is Empty', value: 'is_empty' },
      { label: 'Matches Regex', value: 'regex' }
    ] },
    { key: 'value', label: 'Compare To', type: 'text', default: '7', dependsOn: { field: 'mode', value: 'simple' } },
    { key: 'expression', label: 'Expression', type: 'code', default: 'return input.score > 7;', language: 'javascript', dependsOn: { field: 'mode', value: 'expression' }, helpText: 'JS expression returning true or false' },
  ]
};

const logicSwitch: WorkflowNodeDefinition = {
  id: 'logic-switch', category: 'AI & Logic', name: 'Switch', description: 'Route to multiple branches',
  type: 'tool', icon: Split,
  colorClass: 'text-purple', bgClass: 'bg-purple/10', borderClass: 'hover:border-purple/50',
  outputs: ['case_1', 'case_2', 'case_3', 'default'],
  configFields: [
    { key: 'field', label: 'Field to Match', type: 'text', default: '{{input.category}}' },
    { key: 'cases', label: 'Cases', type: 'keyvalue', default: {}, helpText: 'Label → Value pairs for each branch' },
    { key: 'defaultCase', label: 'Include Default Branch', type: 'toggle', default: true, advanced: true },
  ]
};

const logicLoop: WorkflowNodeDefinition = {
  id: 'logic-loop', category: 'AI & Logic', name: 'Loop', description: 'Iterate over an array',
  type: 'tool', icon: Repeat,
  colorClass: 'text-purple', bgClass: 'bg-purple/10', borderClass: 'hover:border-purple/50',
  outputs: ['item', 'done'],
  configFields: [
    { key: 'inputArray', label: 'Input Array', type: 'text', default: '{{input.items}}', helpText: 'Reference to array from upstream node' },
    { key: 'batchSize', label: 'Batch Size', type: 'number', default: 1, advanced: true, validation: { min: 1, max: 100 }, helpText: 'Process N items at a time' },
    { key: 'maxIterations', label: 'Max Iterations', type: 'number', default: 1000, advanced: true, validation: { min: 1 } },
    { key: 'failOnError', label: 'Stop on Error', type: 'toggle', default: false, advanced: true },
    { key: 'delayBetween', label: 'Delay Between (ms)', type: 'number', default: 0, advanced: true, validation: { min: 0 } },
  ]
};

const logicDelay: WorkflowNodeDefinition = {
  id: 'logic-delay', category: 'AI & Logic', name: 'Wait / Delay', description: 'Pause execution for a duration',
  type: 'tool', icon: Clock,
  colorClass: 'text-purple', bgClass: 'bg-purple/10', borderClass: 'hover:border-purple/50',
  outputs: ['continued'],
  configFields: [
    { key: 'mode', label: 'Wait Mode', type: 'select', default: 'fixed', options: [
      { label: 'Fixed Duration', value: 'fixed' }, { label: 'Until Date/Time', value: 'until' }
    ] },
    { key: 'duration', label: 'Duration', type: 'number', default: 60, dependsOn: { field: 'mode', value: 'fixed' } },
    { key: 'unit', label: 'Unit', type: 'select', default: 'minutes', dependsOn: { field: 'mode', value: 'fixed' }, options: [
      { label: 'Seconds', value: 'seconds' }, { label: 'Minutes', value: 'minutes' },
      { label: 'Hours', value: 'hours' }, { label: 'Days', value: 'days' }
    ] },
    { key: 'untilDate', label: 'Date Expression', type: 'text', default: '', advanced: true, dependsOn: { field: 'mode', value: 'until' }, placeholder: '2025-01-15T09:00:00Z' },
  ]
};

// ────────────────────────────────────────────────────────
//  DATA & CRM
// ────────────────────────────────────────────────────────

const dataCode: WorkflowNodeDefinition = {
  id: 'data-code', category: 'Data & CRM', name: 'Custom Code', description: 'Execute JavaScript or Python',
  type: 'tool', icon: Code,
  colorClass: 'text-teal', bgClass: 'bg-teal/10', borderClass: 'hover:border-teal/50',
  outputs: ['result'],
  configFields: [
    { key: 'language', label: 'Language', type: 'select', default: 'javascript', options: [
      { label: 'JavaScript', value: 'javascript' }, { label: 'Python', value: 'python' }
    ] },
    { key: 'code', label: 'Code', type: 'code', default: '// Access input via `input` variable\nreturn { result: input.data };', language: 'javascript', helpText: 'Return value becomes the node output' },
    { key: 'timeout', label: 'Timeout (ms)', type: 'number', default: 30000, advanced: true, validation: { min: 1000, max: 120000 } },
    { key: 'packages', label: 'NPM Packages', type: 'tags', default: [], advanced: true, helpText: 'Additional packages to install' },
  ]
};

const dataJson: WorkflowNodeDefinition = {
  id: 'data-json', category: 'Data & CRM', name: 'JSON Parser', description: 'Parse, transform, or filter JSON',
  type: 'tool', icon: Code,
  colorClass: 'text-teal', bgClass: 'bg-teal/10', borderClass: 'hover:border-teal/50',
  outputs: ['result'],
  configFields: [
    { key: 'action', label: 'Action', type: 'select', default: 'parse', options: [
      { label: 'Parse', value: 'parse' }, { label: 'Stringify', value: 'stringify' },
      { label: 'Transform (JMESPath)', value: 'transform' }, { label: 'Pick Fields', value: 'pick' },
      { label: 'Merge Objects', value: 'merge' }
    ] },
    { key: 'inputField', label: 'Input', type: 'text', default: '{{input}}' },
    { key: 'jmesPath', label: 'JMESPath Expression', type: 'text', default: '', advanced: true, dependsOn: { field: 'action', value: 'transform' }, placeholder: 'data[?status==`active`]' },
    { key: 'pickFields', label: 'Fields to Pick', type: 'tags', default: [], advanced: true, dependsOn: { field: 'action', value: 'pick' } },
    { key: 'mergeWith', label: 'Merge With', type: 'json', default: '', advanced: true, dependsOn: { field: 'action', value: 'merge' } },
  ]
};

const crmContact: WorkflowNodeDefinition = {
  id: 'crm-contact', category: 'Data & CRM', name: 'Manage Contact', description: 'Find, create, or update CRM contacts',
  type: 'tool', icon: Users,
  colorClass: 'text-pink-500', bgClass: 'bg-pink-500/10', borderClass: 'hover:border-pink-500/50',
  outputs: ['contact'],
  configFields: [
    { key: 'action', label: 'Action', type: 'select', default: 'upsert', options: [
      { label: 'Find', value: 'find' }, { label: 'Create', value: 'create' },
      { label: 'Update', value: 'update' }, { label: 'Upsert (find or create)', value: 'upsert' },
      { label: 'Delete', value: 'delete' }
    ] },
    { key: 'matchField', label: 'Match By', type: 'select', default: 'email', options: [
      { label: 'Email', value: 'email' }, { label: 'Phone', value: 'phone' }, { label: 'ID', value: 'id' }
    ] },
    { key: 'mappings', label: 'Field Mappings', type: 'keyvalue', default: {}, helpText: 'Map CRM fields to upstream variables' },
    { key: 'tags', label: 'Tags', type: 'tags', default: [], advanced: true },
    { key: 'assignTo', label: 'Assign To', type: 'text', default: '', advanced: true, placeholder: 'Team member name' },
  ]
};

const crmTask: WorkflowNodeDefinition = {
  id: 'crm-task', category: 'Data & CRM', name: 'Manage Task', description: 'Create or update CRM tasks',
  type: 'tool', icon: ListFilter,
  colorClass: 'text-pink-500', bgClass: 'bg-pink-500/10', borderClass: 'hover:border-pink-500/50',
  outputs: ['task'],
  configFields: [
    { key: 'action', label: 'Action', type: 'select', default: 'create', options: [
      { label: 'Create', value: 'create' }, { label: 'Update', value: 'update' },
      { label: 'Complete', value: 'complete' }, { label: 'Delete', value: 'delete' }
    ] },
    { key: 'title', label: 'Title', type: 'template', default: '', placeholder: 'Follow up with {{input.name}}' },
    { key: 'dueDate', label: 'Due Date', type: 'text', default: '', placeholder: 'tomorrow, +3days, 2025-03-01' },
    { key: 'priority', label: 'Priority', type: 'select', default: 'medium', advanced: true, options: [
      { label: 'Low', value: 'low' }, { label: 'Medium', value: 'medium' },
      { label: 'High', value: 'high' }, { label: 'Urgent', value: 'urgent' }
    ] },
    { key: 'linkedContact', label: 'Linked Contact', type: 'text', default: '{{input.contactId}}', advanced: true },
  ]
};

const dbQuery: WorkflowNodeDefinition = {
  id: 'db-query', category: 'Data & CRM', name: 'Database Query', description: 'Execute a database query',
  type: 'tool', icon: Database,
  colorClass: 'text-teal', bgClass: 'bg-teal/10', borderClass: 'hover:border-teal/50',
  outputs: ['rows'],
  configFields: [
    { key: 'dbType', label: 'Database Type', type: 'select', default: 'postgres', options: [
      { label: 'PostgreSQL', value: 'postgres' }, { label: 'MySQL', value: 'mysql' },
      { label: 'MongoDB', value: 'mongodb' }, { label: 'Supabase', value: 'supabase' }
    ] },
    { key: 'connectionString', label: 'Connection', type: 'text', default: '', placeholder: 'From secrets vault', helpText: 'Reference a saved database connection' },
    { key: 'query', label: 'Query', type: 'code', default: 'SELECT * FROM users WHERE id = $1', language: 'sql' },
    { key: 'parameters', label: 'Parameters', type: 'json', default: '[]', advanced: true },
    { key: 'timeout', label: 'Timeout (ms)', type: 'number', default: 15000, advanced: true, validation: { min: 1000 } },
  ]
};

const dataFilter: WorkflowNodeDefinition = {
  id: 'data-filter', category: 'Data & CRM', name: 'Filter Data', description: 'Filter arrays by conditions',
  type: 'tool', icon: Filter,
  colorClass: 'text-teal', bgClass: 'bg-teal/10', borderClass: 'hover:border-teal/50',
  outputs: ['filtered'],
  configFields: [
    { key: 'inputArray', label: 'Input Array', type: 'text', default: '{{input.items}}' },
    { key: 'property', label: 'Property', type: 'text', default: 'amount', helpText: 'Field name to compare' },
    { key: 'operator', label: 'Operator', type: 'select', default: 'greater_than', options: [
      { label: 'Equals', value: 'equals' }, { label: 'Not Equals', value: 'not_equals' },
      { label: 'Greater Than', value: 'greater_than' }, { label: 'Less Than', value: 'less_than' },
      { label: 'Contains', value: 'contains' }, { label: 'Is Empty', value: 'is_empty' }
    ] },
    { key: 'value', label: 'Value', type: 'text', default: '100' },
    { key: 'logic', label: 'Logic', type: 'select', default: 'all', advanced: true, options: [
      { label: 'ALL conditions match', value: 'all' }, { label: 'ANY condition matches', value: 'any' }
    ] },
  ]
};

// ────────────────────────────────────────────────────────
//  COMMUNICATION
// ────────────────────────────────────────────────────────

const commEmail: WorkflowNodeDefinition = {
  id: 'comm-email', category: 'Communication', name: 'Send Email', description: 'Send an email via SMTP or API',
  type: 'output', icon: Mail,
  colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', borderClass: 'hover:border-blue-500/50',
  outputs: [],
  configFields: [
    { key: 'provider', label: 'Provider', type: 'select', default: 'sendgrid', options: [
      { label: 'SendGrid', value: 'sendgrid' }, { label: 'Resend', value: 'resend' }, { label: 'SMTP', value: 'smtp' }
    ] },
    { key: 'to', label: 'To', type: 'template', default: '{{input.email}}', required: true, placeholder: '{{contact.email}}' },
    { key: 'subject', label: 'Subject', type: 'template', default: '', required: true, placeholder: 'Your order #{{input.orderId}} is confirmed' },
    { key: 'body', label: 'Body', type: 'textarea', default: '', placeholder: 'Write your email content here...' },
    { key: 'from', label: 'From Email', type: 'text', default: 'noreply@stoneaio.com', advanced: true },
    { key: 'replyTo', label: 'Reply-To', type: 'text', default: '', advanced: true },
    { key: 'cc', label: 'CC', type: 'text', default: '', advanced: true },
    { key: 'bcc', label: 'BCC', type: 'text', default: '', advanced: true },
    { key: 'trackOpens', label: 'Track Opens', type: 'toggle', default: true, advanced: true },
    { key: 'trackClicks', label: 'Track Clicks', type: 'toggle', default: true, advanced: true },
  ]
};

const commSms: WorkflowNodeDefinition = {
  id: 'comm-sms', category: 'Communication', name: 'Send SMS', description: 'Send an SMS via Twilio',
  type: 'output', icon: MessageSquare,
  colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', borderClass: 'hover:border-blue-500/50',
  outputs: [],
  configFields: [
    { key: 'to', label: 'To (Phone)', type: 'template', default: '{{input.phone}}', required: true, placeholder: '+1234567890' },
    { key: 'message', label: 'Message', type: 'template', default: '', required: true, placeholder: 'Hi {{input.name}}, your appointment is tomorrow at...', helpText: '160 chars recommended for single segment' },
    { key: 'from', label: 'From (Twilio Number)', type: 'text', default: '', advanced: true },
    { key: 'mediaUrl', label: 'Media URL (MMS)', type: 'text', default: '', advanced: true, placeholder: 'https://...' },
  ]
};

const commVoice: WorkflowNodeDefinition = {
  id: 'comm-voice', category: 'Communication', name: 'Make Voice Call', description: 'Trigger an outbound voice call',
  type: 'output', icon: Phone,
  colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', borderClass: 'hover:border-blue-500/50',
  outputs: ['callResult'],
  configFields: [
    { key: 'agentId', label: 'Voice Agent', type: 'select', default: '', options: [ { label: '(Select agent)', value: '' } ], helpText: 'Choose from your voice agents' },
    { key: 'phoneNumber', label: 'Phone Number', type: 'template', default: '{{input.phone}}', required: true },
    { key: 'firstMessage', label: 'Opening Message', type: 'template', default: '', advanced: true, placeholder: 'Hi, this is...' },
    { key: 'maxDuration', label: 'Max Duration (min)', type: 'number', default: 10, advanced: true, validation: { min: 1, max: 60 } },
    { key: 'recordCall', label: 'Record Call', type: 'toggle', default: true, advanced: true },
  ]
};

const commSlack: WorkflowNodeDefinition = {
  id: 'comm-slack', category: 'Communication', name: 'Slack Message', description: 'Post a message to Slack',
  type: 'output', icon: Slack,
  colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', borderClass: 'hover:border-blue-500/50',
  outputs: [],
  configFields: [
    { key: 'channel', label: 'Channel', type: 'text', default: '#general', required: true, placeholder: '#sales-alerts' },
    { key: 'message', label: 'Message', type: 'template', default: '', required: true, placeholder: 'New lead: {{input.name}} ({{input.email}})' },
    { key: 'asBot', label: 'Send as Bot', type: 'toggle', default: true, advanced: true },
    { key: 'threadTs', label: 'Thread ID', type: 'text', default: '', advanced: true, helpText: 'Reply in a specific thread' },
    { key: 'blocks', label: 'Block Kit JSON', type: 'code', default: '', language: 'json', advanced: true, helpText: 'Slack Block Kit message format' },
  ]
};

// ────────────────────────────────────────────────────────
//  INTEGRATIONS
// ────────────────────────────────────────────────────────

const intHttp: WorkflowNodeDefinition = {
  id: 'int-http', category: 'Integrations', name: 'HTTP Request', description: 'Make an HTTP request to any API',
  type: 'tool', icon: Globe,
  colorClass: 'text-green', bgClass: 'bg-green/10', borderClass: 'hover:border-green/50',
  outputs: ['response'],
  configFields: [
    { key: 'method', label: 'Method', type: 'select', default: 'GET', options: [
      { label: 'GET', value: 'GET' }, { label: 'POST', value: 'POST' }, { label: 'PUT', value: 'PUT' },
      { label: 'PATCH', value: 'PATCH' }, { label: 'DELETE', value: 'DELETE' }
    ] },
    { key: 'url', label: 'URL', type: 'template', default: '', required: true, placeholder: 'https://api.example.com/v1/{{input.resource}}' },
    { key: 'headers', label: 'Headers', type: 'keyvalue', default: {} },
    { key: 'body', label: 'Body', type: 'code', default: '', language: 'json', dependsOn: { field: 'method', value: 'POST' } },
    { key: 'auth', label: 'Authentication', type: 'select', default: 'none', advanced: true, options: [
      { label: 'None', value: 'none' }, { label: 'Bearer Token', value: 'bearer' },
      { label: 'Basic Auth', value: 'basic' }, { label: 'OAuth 2.0', value: 'oauth2' }
    ] },
    { key: 'bearerToken', label: 'Bearer Token', type: 'text', default: '', advanced: true, dependsOn: { field: 'auth', value: 'bearer' } },
    { key: 'timeout', label: 'Timeout (ms)', type: 'number', default: 30000, advanced: true, validation: { min: 1000 } },
    { key: 'retryOnFail', label: 'Retry on Failure', type: 'toggle', default: false, advanced: true },
    { key: 'retryCount', label: 'Retry Count', type: 'number', default: 3, advanced: true, validation: { min: 1, max: 10 } },
    { key: 'parseResponse', label: 'Parse Response', type: 'select', default: 'auto', advanced: true, options: [
      { label: 'Auto-detect', value: 'auto' }, { label: 'JSON', value: 'json' },
      { label: 'Text', value: 'text' }, { label: 'Binary', value: 'binary' }
    ] },
  ]
};

const intStripe: WorkflowNodeDefinition = {
  id: 'int-stripe', category: 'Integrations', name: 'Stripe', description: 'Charges, invoices, and subscriptions',
  type: 'tool', icon: CreditCard,
  colorClass: 'text-green', bgClass: 'bg-green/10', borderClass: 'hover:border-green/50',
  outputs: ['result'],
  configFields: [
    { key: 'action', label: 'Action', type: 'select', default: 'create_charge', options: [
      { label: 'Create Charge', value: 'create_charge' }, { label: 'Create Invoice', value: 'create_invoice' },
      { label: 'Create Customer', value: 'create_customer' }, { label: 'List Payments', value: 'list_payments' },
      { label: 'Create Subscription', value: 'create_subscription' }, { label: 'Refund', value: 'refund' }
    ] },
    { key: 'amount', label: 'Amount (cents)', type: 'template', default: '{{input.amount}}', placeholder: '2999' },
    { key: 'currency', label: 'Currency', type: 'select', default: 'usd', options: [
      { label: 'USD', value: 'usd' }, { label: 'EUR', value: 'eur' }, { label: 'GBP', value: 'gbp' },
      { label: 'CAD', value: 'cad' }, { label: 'AUD', value: 'aud' }
    ] },
    { key: 'customerId', label: 'Customer ID', type: 'template', default: '{{input.stripeCustomerId}}', advanced: true },
    { key: 'description', label: 'Description', type: 'template', default: '', advanced: true },
    { key: 'metadata', label: 'Metadata', type: 'keyvalue', default: {}, advanced: true },
  ]
};

const intShopify: WorkflowNodeDefinition = {
  id: 'int-shopify', category: 'Integrations', name: 'Shopify', description: 'Orders, products, and inventory',
  type: 'tool', icon: ShoppingCart,
  colorClass: 'text-green', bgClass: 'bg-green/10', borderClass: 'hover:border-green/50',
  outputs: ['result'],
  configFields: [
    { key: 'action', label: 'Action', type: 'select', default: 'get_order', options: [
      { label: 'Get Order', value: 'get_order' }, { label: 'Create Order', value: 'create_order' },
      { label: 'Update Order', value: 'update_order' }, { label: 'List Products', value: 'list_products' },
      { label: 'Update Inventory', value: 'update_inventory' }, { label: 'Create Fulfillment', value: 'create_fulfillment' }
    ] },
    { key: 'resourceId', label: 'Resource ID', type: 'template', default: '{{input.orderId}}' },
    { key: 'fields', label: 'Fields', type: 'tags', default: [], advanced: true, helpText: 'Specific fields to return' },
    { key: 'limit', label: 'Limit', type: 'number', default: 50, advanced: true, validation: { min: 1, max: 250 } },
  ]
};

const intGithub: WorkflowNodeDefinition = {
  id: 'int-github', category: 'Integrations', name: 'GitHub', description: 'Issues, PRs, and repositories',
  type: 'tool', icon: Github,
  colorClass: 'text-green', bgClass: 'bg-green/10', borderClass: 'hover:border-green/50',
  outputs: ['result'],
  configFields: [
    { key: 'action', label: 'Action', type: 'select', default: 'create_issue', options: [
      { label: 'Create Issue', value: 'create_issue' }, { label: 'Close Issue', value: 'close_issue' },
      { label: 'Create PR', value: 'create_pr' }, { label: 'Add Comment', value: 'add_comment' },
      { label: 'List Issues', value: 'list_issues' }, { label: 'Create Release', value: 'create_release' }
    ] },
    { key: 'repo', label: 'Repository', type: 'text', default: '', required: true, placeholder: 'owner/repo' },
    { key: 'title', label: 'Title', type: 'template', default: '', placeholder: 'Bug: {{input.errorMessage}}' },
    { key: 'body', label: 'Body', type: 'template', default: '', placeholder: 'Detailed description...' },
    { key: 'labels', label: 'Labels', type: 'tags', default: [], advanced: true },
    { key: 'assignees', label: 'Assignees', type: 'tags', default: [], advanced: true },
  ]
};

const intTwitter: WorkflowNodeDefinition = {
  id: 'int-twitter', category: 'Integrations', name: 'Twitter / X', description: 'Post tweets and monitor mentions',
  type: 'tool', icon: Twitter,
  colorClass: 'text-green', bgClass: 'bg-green/10', borderClass: 'hover:border-green/50',
  outputs: ['result'],
  configFields: [
    { key: 'action', label: 'Action', type: 'select', default: 'post_tweet', options: [
      { label: 'Post Tweet', value: 'post_tweet' }, { label: 'Reply to Tweet', value: 'reply' },
      { label: 'Search Tweets', value: 'search' }, { label: 'Get Mentions', value: 'get_mentions' }
    ] },
    { key: 'text', label: 'Tweet Text', type: 'template', default: '', placeholder: '{{input.summary}}', helpText: '280 character limit' },
    { key: 'mediaUrl', label: 'Media URL', type: 'text', default: '', advanced: true },
    { key: 'replyToId', label: 'Reply To Tweet ID', type: 'text', default: '', advanced: true, dependsOn: { field: 'action', value: 'reply' } },
    { key: 'searchQuery', label: 'Search Query', type: 'text', default: '', advanced: true, dependsOn: { field: 'action', value: 'search' } },
  ]
};

const intLinkedin: WorkflowNodeDefinition = {
  id: 'int-linkedin', category: 'Integrations', name: 'LinkedIn', description: 'Create posts and share articles',
  type: 'tool', icon: Linkedin,
  colorClass: 'text-green', bgClass: 'bg-green/10', borderClass: 'hover:border-green/50',
  outputs: ['result'],
  configFields: [
    { key: 'action', label: 'Action', type: 'select', default: 'create_post', options: [
      { label: 'Create Post', value: 'create_post' }, { label: 'Share Article', value: 'share_article' },
      { label: 'Send Message', value: 'send_message' }
    ] },
    { key: 'text', label: 'Content', type: 'template', default: '', placeholder: 'Exciting update: {{input.announcement}}' },
    { key: 'mediaUrl', label: 'Media URL', type: 'text', default: '', advanced: true },
    { key: 'visibility', label: 'Visibility', type: 'select', default: 'public', advanced: true, options: [
      { label: 'Public', value: 'public' }, { label: 'Connections Only', value: 'connections' }
    ] },
  ]
};

const intDrive: WorkflowNodeDefinition = {
  id: 'int-drive', category: 'Integrations', name: 'Google Drive', description: 'Upload, download, and manage files',
  type: 'tool', icon: HardDrive,
  colorClass: 'text-green', bgClass: 'bg-green/10', borderClass: 'hover:border-green/50',
  outputs: ['file'],
  configFields: [
    { key: 'action', label: 'Action', type: 'select', default: 'upload', options: [
      { label: 'Upload File', value: 'upload' }, { label: 'Download File', value: 'download' },
      { label: 'List Files', value: 'list' }, { label: 'Create Folder', value: 'create_folder' },
      { label: 'Move File', value: 'move' }, { label: 'Delete File', value: 'delete' }
    ] },
    { key: 'filePath', label: 'File Path / Name', type: 'template', default: '', placeholder: '{{input.fileName}}' },
    { key: 'folderId', label: 'Folder ID', type: 'text', default: 'root', advanced: true },
    { key: 'mimeType', label: 'MIME Type', type: 'text', default: '', advanced: true },
    { key: 'fileName', label: 'Rename To', type: 'template', default: '', advanced: true },
  ]
};

// ────────────────────────────────────────────────────────
//  EXPORT: single flat array for the sidebar / node library
// ────────────────────────────────────────────────────────

export const WORKFLOW_NODES: WorkflowNodeDefinition[] = [
  // Triggers
  triggerWebhook, triggerSchedule, triggerEmailReceived, triggerCrmEvent, triggerForm,
  // AI & Logic
  aiLlm, aiSentiment, aiExtract, logicIf, logicSwitch, logicLoop, logicDelay,
  // Data & CRM
  dataCode, dataJson, crmContact, crmTask, dbQuery, dataFilter,
  // Communication
  commEmail, commSms, commVoice, commSlack,
  // Integrations
  intHttp, intStripe, intShopify, intGithub, intTwitter, intLinkedin, intDrive,
];

/**
 * Helper: get default config values from a node definition.
 * Used when dragging a new node onto the canvas.
 */
export function getNodeDefaults(nodeId: string): Record<string, any> {
  const def = WORKFLOW_NODES.find(n => n.id === nodeId);
  if (!def) return {};
  const defaults: Record<string, any> = {};
  for (const field of def.configFields) {
    defaults[field.key] = field.default;
  }
  return defaults;
}
