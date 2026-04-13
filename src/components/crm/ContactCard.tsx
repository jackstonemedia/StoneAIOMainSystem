import { Mail, Phone, Building2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LeadScoreRing from './LeadScoreRing';

interface Contact {
  id: string;
  firstName: string;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  company?: { name: string } | null;
  leadScore?: number;
  lastContact?: string;
}

interface ContactCardProps {
  contact: Contact;
}

export default function ContactCard({ contact }: ContactCardProps) {
  const navigate = useNavigate();
  const initials = `${contact.firstName?.charAt(0) || ''}${contact.lastName?.charAt(0) || ''}`.toUpperCase() || 'U';
  const score = contact.leadScore ?? 0;

  // Avatar color based on name
  const colors = [
    'from-violet-500 to-purple-600',
    'from-sky-500 to-blue-600',
    'from-emerald-500 to-green-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
  ];
  const colorIdx = (contact.firstName?.charCodeAt(0) ?? 0) % colors.length;
  const avatarGradient = colors[colorIdx];

  return (
    <div
      onClick={() => navigate(`/business/crm/contacts/${contact.id}`)}
      className="group bg-surface border border-border/60 rounded-2xl p-5 cursor-pointer hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 relative overflow-hidden"
    >
      {/* Subtle gradient glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-transparent transition-all duration-500 pointer-events-none rounded-2xl" />

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center font-bold text-white text-base shadow-md shrink-0`}>
          {initials}
        </div>
        <LeadScoreRing score={score} size={38} strokeWidth={3} />
      </div>

      {/* Name & Title */}
      <div className="mb-3">
        <h3 className="font-semibold text-text-main group-hover:text-primary transition-colors truncate">
          {`${contact.firstName} ${contact.lastName || ''}`.trim()}
        </h3>
        {contact.company?.name && (
          <div className="flex items-center gap-1.5 mt-1 text-xs text-text-muted font-medium">
            <Building2 className="w-3 h-3" />
            <span className="truncate">{contact.company.name}</span>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-border/50 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0">
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 text-[11px] font-medium text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-1 rounded-md hover:bg-sky-500/20 transition-colors"
          >
            <Mail className="w-3 h-3" />
            Email
          </a>
        )}
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 text-[11px] font-medium text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-md hover:bg-green-500/20 transition-colors"
          >
            <Phone className="w-3 h-3" />
            Call
          </a>
        )}
        <button
          onClick={e => { e.stopPropagation(); navigate(`/business/crm/contacts/${contact.id}`); }}
          className="ml-auto flex items-center gap-1 text-[11px] font-medium text-text-muted hover:text-text-main transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          View
        </button>
      </div>

      {/* Score bar */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-border/40 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${score}%`,
              background: score >= 75 ? '#52677D' : score >= 50 ? '#52677D' : score >= 25 ? '#52677D' : '#52677D'
            }}
          />
        </div>
        <span className="text-[10px] text-text-muted">{score}/100</span>
      </div>
    </div>
  );
}
