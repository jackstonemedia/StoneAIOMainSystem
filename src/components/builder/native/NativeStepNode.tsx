import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Zap, Mail, MessageSquare, GitBranch, Database,
  Globe, Clock, RotateCcw, Tag, FileText, Bell,
  UserPlus, UserCheck, Briefcase, StickyNote, CheckSquare,
  Bot, Code, Repeat, Timer, Webhook, CheckCircle2, XCircle,
  Loader2,
} from 'lucide-react';

// Map node type strings to Lucide icons
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  'trigger.crm_event':        Zap,
  'trigger.webhook':          Webhook,
  'trigger.schedule':         Clock,
  'trigger.manual':           Zap,
  'communication.send_email': Mail,
  'communication.send_sms':   MessageSquare,
  'notification.send_internal': Bell,
  'crm.create_contact':       UserPlus,
  'crm.update_contact':       UserCheck,
  'crm.create_deal':          Briefcase,
  'crm.update_deal':          Briefcase,
  'crm.create_task':          CheckSquare,
  'crm.create_note':          StickyNote,
  'crm.add_tag':              Tag,
  'crm.remove_tag':           Tag,
  'logic.if_else':            GitBranch,
  'logic.loop':               Repeat,
  'logic.wait':               Timer,
  'logic.transform':          Code,
  'data.http_request':        Globe,
  'data.parse_json':          FileText,
  'ai.llm':                   Bot,
  'workflow.run_workflow':     RotateCcw,
};

function getIcon(type: string) {
  return ICON_MAP[type] ?? Database;
}

// Minimal handle — invisible until hovered or during connection
function SourceHandle({ id, color }: { id: string; color: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Handle
      type="source"
      position={Position.Bottom}
      id={id}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: hovered ? 10 : 8,
        height: hovered ? 10 : 8,
        background: hovered ? color : 'var(--color-bg)',
        border: `1.5px solid ${hovered ? color : '#3a3f52'}`,
        borderRadius: '50%',
        transition: 'all 0.12s ease',
        cursor: 'crosshair',
        bottom: -5,
        zIndex: 10,
      }}
    />
  );
}

function TargetHandle({ color }: { color: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Handle
      type="target"
      position={Position.Top}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: hovered ? 10 : 8,
        height: hovered ? 10 : 8,
        background: hovered ? color : 'var(--color-bg)',
        border: `1.5px solid ${hovered ? color : '#3a3f52'}`,
        borderRadius: '50%',
        transition: 'all 0.12s ease',
        cursor: 'crosshair',
        top: -5,
        zIndex: 10,
      }}
    />
  );
}

export const NativeStepNode = memo(({ data, selected }: NodeProps) => {
  const node = data.node as any;
  const nodeImpl = data.nodeImpl as any;
  const runStatus = data.runStatus as string | undefined;

  if (!node || !node.type) {
    return (
      <div style={{ width: 220, padding: '12px 14px', borderRadius: 10, background: '#16192a', border: '1px solid #252840', opacity: 0.5 }}>
        <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Loading…</p>
        <Handle type="source" position={Position.Bottom} style={{ width: 8, height: 8 }} />
      </div>
    );
  }

  const isTrigger = node.type?.startsWith('trigger.');
  const color = nodeImpl?.color ?? (isTrigger ? '#a78bfa' : '#94a3b8');
  const Icon = getIcon(node.type);
  const category = nodeImpl?.category ?? (isTrigger ? 'trigger' : 'action');
  const outputHandles: any[] = nodeImpl?.outputHandles ?? [];

  // Status indicator
  let statusDot = null;
  if (runStatus === 'SUCCEEDED') statusDot = <CheckCircle2 style={{ width: 13, height: 13, color: '#4ade80', flexShrink: 0 }} />;
  else if (runStatus === 'FAILED')    statusDot = <XCircle    style={{ width: 13, height: 13, color: '#f87171', flexShrink: 0 }} />;
  else if (runStatus === 'RUNNING')   statusDot = <Loader2    style={{ width: 13, height: 13, color: '#facc15', flexShrink: 0, animation: 'spin 1s linear infinite' }} />;

  return (
    <div
      style={{
        width: 220,
        borderRadius: 10,
        background: selected ? '#1a1d2e' : '#15172a',
        border: selected
          ? `1px solid ${color}60`
          : '1px solid #1e2235',
        boxShadow: selected
          ? `0 0 0 2px ${color}25, 0 4px 24px rgba(0,0,0,0.4)`
          : '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        cursor: 'default',
        position: 'relative',
        opacity: node.disabled ? 0.45 : 1,
      }}
    >
      {/* Target handle */}
      {!isTrigger && <TargetHandle color={color} />}

      {/* Body */}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Icon */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${color}14`,
            flexShrink: 0,
          }}
        >
          <Icon style={{ width: 15, height: 15, color }} />
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 10,
            fontWeight: 500,
            color: '#475569',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            margin: '0 0 2px 0',
            lineHeight: 1,
          }}>
            {category}
          </p>
          <p style={{
            fontSize: 13,
            fontWeight: 500,
            color: '#cbd5e1',
            margin: 0,
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textDecoration: node.disabled ? 'line-through' : 'none',
          }}>
            {node.label || nodeImpl?.displayName || node.type}
          </p>
        </div>

        {/* Status */}
        {statusDot}
      </div>

      {/* Source handles */}
      {outputHandles.length > 1 ? (
        // Multi-output: show labels in a thin footer row
        <div style={{
          borderTop: '1px solid #1e2235',
          display: 'flex',
          position: 'relative',
          height: 28,
        }}>
          {outputHandles.map((handle: any, i: number) => {
            const leftPct = outputHandles.length === 1
              ? 50
              : 15 + (70 * i) / (outputHandles.length - 1);
            return (
              <div
                key={handle.id}
                style={{
                  position: 'absolute',
                  left: `${leftPct}%`,
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  bottom: 0,
                  gap: 2,
                }}
              >
                <span style={{
                  fontSize: 9,
                  color: handle.color ?? color,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  lineHeight: 1,
                  paddingTop: 5,
                }}>
                  {handle.label}
                </span>
                <SourceHandle id={handle.id} color={handle.color ?? color} />
              </div>
            );
          })}
        </div>
      ) : (
        // Single output — just the handle, no footer
        <SourceHandle id={outputHandles[0]?.id ?? 'default'} color={color} />
      )}
    </div>
  );
});
