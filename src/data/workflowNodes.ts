import { 
  Zap, Clock, Users, Mail, MessageSquare, Phone, Globe, FormInput,
  Bot, GitBranch, Repeat, Search, Split, Combine, Filter, Code,
  Database, HardDrive, Share2, Layers, ListFilter,
  Slack, Twitter, Github, Linkedin, CreditCard, ShoppingCart
} from 'lucide-react';

export type WorkflowNodeCategory = 'Triggers' | 'AI & Logic' | 'Communication' | 'Data & CRM' | 'Integrations';

export interface WorkflowNodeDefinition {
  id: string;
  category: WorkflowNodeCategory;
  name: string;
  type: string; // ReactFlow node type mapping: 'trigger', 'llm', 'tool', 'output'
  icon: any;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  defaults: Record<string, any>;
}

export const WORKFLOW_NODES: WorkflowNodeDefinition[] = [
  // --- TRIGGERS ---
  {
    id: 'trigger-webhook', category: 'Triggers', name: 'Webhook', type: 'trigger', icon: Zap,
    colorClass: 'text-primary', bgClass: 'bg-primary/10', borderClass: 'hover:border-primary/50',
    defaults: { description: 'HTTP POST/GET' }
  },
  {
    id: 'trigger-schedule', category: 'Triggers', name: 'Schedule / Cron', type: 'trigger', icon: Clock,
    colorClass: 'text-primary', bgClass: 'bg-primary/10', borderClass: 'hover:border-primary/50',
    defaults: { description: 'Run on a schedule' }
  },
  {
    id: 'trigger-email-received', category: 'Triggers', name: 'Email Received', type: 'trigger', icon: Mail,
    colorClass: 'text-primary', bgClass: 'bg-primary/10', borderClass: 'hover:border-primary/50',
    defaults: { description: 'When new email arrives' }
  },
  {
    id: 'trigger-crm-event', category: 'Triggers', name: 'CRM Event', type: 'trigger', icon: Users,
    colorClass: 'text-primary', bgClass: 'bg-primary/10', borderClass: 'hover:border-primary/50',
    defaults: { description: 'Contact created/updated' }
  },
  {
    id: 'trigger-form', category: 'Triggers', name: 'Form Submitted', type: 'trigger', icon: FormInput,
    colorClass: 'text-primary', bgClass: 'bg-primary/10', borderClass: 'hover:border-primary/50',
    defaults: { description: 'New form response' }
  },

  // --- AI & LOGIC ---
  {
    id: 'ai-llm', category: 'AI & Logic', name: 'LLM Call', type: 'llm', icon: Bot,
    colorClass: 'text-amber', bgClass: 'bg-amber/10', borderClass: 'hover:border-amber/50',
    defaults: { model: 'claude-3-5-sonnet', prompt: 'Summarize this data...' }
  },
  {
    id: 'ai-sentiment', category: 'AI & Logic', name: 'Sentiment Analysis', type: 'llm', icon: Search,
    colorClass: 'text-amber', bgClass: 'bg-amber/10', borderClass: 'hover:border-amber/50',
    defaults: { model: 'gpt-4o', task: 'sentiment' }
  },
  {
    id: 'ai-extract', category: 'AI & Logic', name: 'Data Extractor', type: 'llm', icon: Layers,
    colorClass: 'text-amber', bgClass: 'bg-amber/10', borderClass: 'hover:border-amber/50',
    defaults: { task: 'extraction', format: 'JSON' }
  },
  {
    id: 'logic-if', category: 'AI & Logic', name: 'If / Else', type: 'tool', icon: GitBranch,
    colorClass: 'text-purple', bgClass: 'bg-purple/10', borderClass: 'hover:border-purple/50',
    defaults: { condition: 'true' }
  },
  {
    id: 'logic-switch', category: 'AI & Logic', name: 'Switch', type: 'tool', icon: Split,
    colorClass: 'text-purple', bgClass: 'bg-purple/10', borderClass: 'hover:border-purple/50',
    defaults: { paths: 3 }
  },
  {
    id: 'logic-loop', category: 'AI & Logic', name: 'Loop', type: 'tool', icon: Repeat,
    colorClass: 'text-purple', bgClass: 'bg-purple/10', borderClass: 'hover:border-purple/50',
    defaults: { target: 'items array' }
  },
  {
    id: 'logic-delay', category: 'AI & Logic', name: 'Wait / Delay', type: 'tool', icon: Clock,
    colorClass: 'text-purple', bgClass: 'bg-purple/10', borderClass: 'hover:border-purple/50',
    defaults: { duration: '1 hour' }
  },

  // --- DATA & CRM ---
  {
    id: 'data-code', category: 'Data & CRM', name: 'Custom Code', type: 'tool', icon: Code,
    colorClass: 'text-teal', bgClass: 'bg-teal/10', borderClass: 'hover:border-teal/50',
    defaults: { language: 'javascript' }
  },
  {
    id: 'data-json', category: 'Data & CRM', name: 'JSON Parser', type: 'tool', icon: Code,
    colorClass: 'text-teal', bgClass: 'bg-teal/10', borderClass: 'hover:border-teal/50',
    defaults: { action: 'parse' }
  },
  {
    id: 'crm-contact', category: 'Data & CRM', name: 'Manage Contact', type: 'tool', icon: Users,
    colorClass: 'text-pink-500', bgClass: 'bg-pink-500/10', borderClass: 'hover:border-pink-500/50',
    defaults: { action: 'Find or Create' }
  },
  {
    id: 'crm-task', category: 'Data & CRM', name: 'Manage Task', type: 'tool', icon: ListFilter,
    colorClass: 'text-pink-500', bgClass: 'bg-pink-500/10', borderClass: 'hover:border-pink-500/50',
    defaults: { action: 'Create Task' }
  },
  {
    id: 'db-query', category: 'Data & CRM', name: 'Database Query', type: 'tool', icon: Database,
    colorClass: 'text-teal', bgClass: 'bg-teal/10', borderClass: 'hover:border-teal/50',
    defaults: { dbType: 'postgres' }
  },
  {
    id: 'data-filter', category: 'Data & CRM', name: 'Filter Data', type: 'tool', icon: Filter,
    colorClass: 'text-teal', bgClass: 'bg-teal/10', borderClass: 'hover:border-teal/50',
    defaults: { property: 'amount', op: 'greater_than' }
  },

  // --- COMMUNICATION ---
  {
    id: 'comm-email', category: 'Communication', name: 'Send Email', type: 'output', icon: Mail,
    colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', borderClass: 'hover:border-blue-500/50',
    defaults: { provider: 'SMTP' }
  },
  {
    id: 'comm-sms', category: 'Communication', name: 'Send SMS', type: 'output', icon: MessageSquare,
    colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', borderClass: 'hover:border-blue-500/50',
    defaults: { provider: 'Twilio' }
  },
  {
    id: 'comm-voice', category: 'Communication', name: 'Make Voice Call', type: 'output', icon: Phone,
    colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', borderClass: 'hover:border-blue-500/50',
    defaults: { provider: 'Retell' }
  },
  {
    id: 'comm-slack', category: 'Communication', name: 'Slack Message', type: 'output', icon: Slack,
    colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', borderClass: 'hover:border-blue-500/50',
    defaults: { target: '#general' }
  },

  // --- INTEGRATIONS ---
  {
    id: 'int-http', category: 'Integrations', name: 'HTTP Request', type: 'tool', icon: Globe,
    colorClass: 'text-green', bgClass: 'bg-green/10', borderClass: 'hover:border-green/50',
    defaults: { method: 'GET' }
  },
  {
    id: 'int-stripe', category: 'Integrations', name: 'Stripe', type: 'tool', icon: CreditCard,
    colorClass: 'text-green', bgClass: 'bg-green/10', borderClass: 'hover:border-green/50',
    defaults: { action: 'Charge' }
  },
  {
    id: 'int-shopify', category: 'Integrations', name: 'Shopify', type: 'tool', icon: ShoppingCart,
    colorClass: 'text-green', bgClass: 'bg-green/10', borderClass: 'hover:border-green/50',
    defaults: { action: 'Get Order' }
  },
  {
    id: 'int-github', category: 'Integrations', name: 'GitHub', type: 'tool', icon: Github,
    colorClass: 'text-green', bgClass: 'bg-green/10', borderClass: 'hover:border-green/50',
    defaults: { action: 'Create Issue' }
  },
  {
    id: 'int-twitter', category: 'Integrations', name: 'Twitter / X', type: 'tool', icon: Twitter,
    colorClass: 'text-green', bgClass: 'bg-green/10', borderClass: 'hover:border-green/50',
    defaults: { action: 'Post Tweet' }
  },
  {
    id: 'int-linkedin', category: 'Integrations', name: 'LinkedIn', type: 'tool', icon: Linkedin,
    colorClass: 'text-green', bgClass: 'bg-green/10', borderClass: 'hover:border-green/50',
    defaults: { action: 'Create Post' }
  },
  {
    id: 'int-drive', category: 'Integrations', name: 'Google Drive', type: 'tool', icon: HardDrive,
    colorClass: 'text-green', bgClass: 'bg-green/10', borderClass: 'hover:border-green/50',
    defaults: { action: 'Upload File' }
  }
];
