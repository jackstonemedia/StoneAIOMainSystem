import { Link } from 'react-router-dom';
import { Mail, Phone, ChevronRight } from 'lucide-react';
import type { Contact } from '../../../types/crm';
import { DashboardFadeIn } from './DashboardPanel';

interface DataTableProps {
  contacts: Contact[];
  isLoading: boolean;
}

function statusBadge(status: string | null | undefined) {
  const s = (status || 'Lead').toLowerCase();
  if (s.includes('won') || s.includes('active') || s.includes('customer')) return 'badge-success';
  if (s.includes('lost') || s.includes('churn')) return 'badge-danger';
  if (s.includes('qualified') || s.includes('proposal')) return 'badge-info';
  return 'badge-neutral';
}

export function DataTable({ contacts, isLoading }: DataTableProps) {
  const recent = [...contacts]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return (
    <DashboardFadeIn delay={0.18}>
      {/* Section header — matches contacts toolbar style */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4 px-0.5">
        <div>
          <span className="text-label-caps mb-1.5 block">CRM</span>
          <h3 className="text-[15px] font-semibold tracking-tight text-text-main">Recent contacts</h3>
          <p className="mt-1 text-[12px] text-text-muted">Latest people added to your workspace.</p>
        </div>
        <Link
          to="/crm/contacts"
          className="btn-secondary w-fit"
        >
          View all
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Glass table — exactly the contacts table container */}
      <div className="rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            {/* Frosted sticky header — matches contacts thead */}
            <thead className="sticky top-0 z-10 border-b border-border/50 bg-surface/80 backdrop-blur-md shadow-sm">
              <tr>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap">Contact</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap hidden md:table-cell">Phone</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap hidden lg:table-cell">Email</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap hidden sm:table-cell">Added</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-4 py-3" colSpan={5}>
                      <div className="flex items-center gap-3">
                        <div className="skeleton skeleton-avatar w-7 h-7" />
                        <div className="skeleton skeleton-text w-32" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <p className="text-[13px] font-medium text-text-muted mb-3">No contacts yet.</p>
                    <Link to="/crm/contacts" className="btn-primary inline-flex">
                      Add your first contact
                    </Link>
                  </td>
                </tr>
              ) : (
                recent.map((contact) => {
                  const name =
                    [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unknown';
                  const initials = `${contact.firstName?.charAt(0) || ''}${contact.lastName?.charAt(0) || ''}`.toUpperCase() || 'U';
                  return (
                    <tr
                      key={contact.id}
                      className="border-b border-border/50 transition-colors hover:bg-surface-hover/50"
                    >
                      <td className="px-4 py-3">
                        <Link to={`/crm/contacts/${contact.id}`} className="flex items-center gap-3 group">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-bg shadow-sm shrink-0"
                            style={{ backgroundColor: contact.color || 'var(--primary)' }}
                          >
                            {initials}
                          </div>
                          <span className="text-[13px] font-medium text-text-main group-hover:text-primary transition-colors truncate">
                            {name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {contact.phone ? (
                          <div className="flex items-center gap-2 text-[13px] font-medium text-text-main">
                            <Phone className="w-3.5 h-3.5 text-text-muted shrink-0" />
                            {contact.phone}
                          </div>
                        ) : (
                          <span className="text-text-muted text-[12px]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {contact.email ? (
                          <div className="flex items-center gap-2 text-[13px] font-medium text-text-main max-w-[200px]">
                            <Mail className="w-3.5 h-3.5 text-text-muted shrink-0" />
                            <span className="truncate">{contact.email}</span>
                          </div>
                        ) : (
                          <span className="text-text-muted text-[12px]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${statusBadge(contact.status)}`}>{contact.status || 'Lead'}</span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-[11px] font-medium text-text-muted whitespace-nowrap opacity-60">
                        {new Date(contact.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer — matches contacts paginator bar */}
        {!isLoading && recent.length > 0 && (
          <div className="px-4 py-3 border-t border-border/50 bg-surface flex items-center justify-between text-[12px]">
            <span className="font-semibold text-text-muted flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary/60" />
              Showing {recent.length} of {contacts.length}
            </span>
            <Link to="/crm/contacts" className="text-primary font-semibold hover:underline">
              See full list
            </Link>
          </div>
        )}
      </div>
    </DashboardFadeIn>
  );
}
