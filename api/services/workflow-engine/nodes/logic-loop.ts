 import type { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
 import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../../src/types/automation.js';
 
 export const logicLoop: NodeImplementation = {
   type: 'logic.loop',
   category: 'logic',
   displayName: 'Loop',
   description: 'Iterate over an array of items',
   iconName: 'repeat',
   color: '#8B5CF6',
   outputHandles: [
     { id: 'item', label: 'Item', color: '#8B5CF6' },
     { id: 'done', label: 'Done', color: '#9CA3AF' },
   ],
   configSchema: [
     {
       key: 'inputArray',
       label: 'Input Array',
       type: 'expression',
       required: true,
       placeholder: '{{$node.some_node}}',
     },
   ] as NodeConfigField[],
 
   async execute(
     config: Record<string, unknown>,
     _items: WorkflowItem[],
     _context: ExecutionContext,
   ): Promise<NodeExecuteResult> {
     let arr: unknown = (config as any).inputArray;
 
     if (typeof arr === 'string') {
       try {
         arr = JSON.parse(arr);
       } catch {
         // ignore parse errors; fall through to non-array handling
       }
     }
 
     if (!Array.isArray(arr)) {
       return { output: [], branches: { item: [], done: [] } };
     }
 
     const asArray = arr as unknown[];
 
     const outputItems: WorkflowItem[] = asArray.map((val, index) => ({
       json:
         typeof val === 'object' && val !== null
           ? (val as Record<string, unknown>)
           : { value: val },
       pairedItem: { item: index },
     }));
 
     return {
       output: outputItems,
       branches: {
         item: outputItems,
         done: [{ json: { total: asArray.length } }],
       },
     };
   },
 };
