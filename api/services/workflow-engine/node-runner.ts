import { WorkflowItem, ExecutionContext, NodeConfigField } from '../../../src/types/automation.js';

export interface NodeExecuteResult {
  output: WorkflowItem[];
  branches?: Record<string, WorkflowItem[]>;  // handle id → items
}

export interface NodeImplementation {
  type: string;
  category: 'trigger' | 'logic' | 'data' | 'crm' | 'communication' | 'ai' | 'integration';
  displayName: string;
  description: string;
  iconName: string;
  color: string;
  
  outputHandles: Array<{ id: string; label?: string; color?: string }>;
  configSchema: NodeConfigField[];
  
  execute(
    config: Record<string, unknown>,
    items: WorkflowItem[],
    context: ExecutionContext
  ): Promise<NodeExecuteResult> | NodeExecuteResult;
}

export class NodeRegistry {
  private nodes: Map<string, NodeImplementation> = new Map();
  
  register(node: NodeImplementation): void {
    this.nodes.set(node.type, node);
  }
  
  get(type: string): NodeImplementation | undefined {
    return this.nodes.get(type);
  }
  
  getAll(): NodeImplementation[] {
    return Array.from(this.nodes.values());
  }
  
  getByCategory(category: string): NodeImplementation[] {
    return this.getAll().filter(n => n.category === category);
  }
}

export const nodeRegistry = new NodeRegistry();
