import { Play, Pause, XCircle, Mail, Phone, Clock, CheckCircle2, RefreshCw, Zap } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../ui/Toast';

interface Props { contactId: string; }

const STATUS_STYLES: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: 'Active', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: Play },
  paused: { label: 'Paused', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', icon: Pause },
  completed: { label: 'Completed', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', icon: CheckCircle2 },
  unsubscribed: { label: 'Unsubscribed', color: 'text-red-400 bg-red-400/10 border-red-400/20', icon: XCircle },
};

const STEP_ICONS: Record<string, React.ElementType> = {
  email: Mail,
  sms: Phone,
  wait: Clock,
  task: CheckCircle2,
};

export default function ContactSequencesTab({ contactId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: enrollments = [], isLoading } = useQuery<any[]>({
    queryKey: ['sequence-enrollments', contactId],
    queryFn: () =>
      fetch(`/api/crm/contacts/${contactId}/events?type=sequence`)
        .then(r => r.ok ? r.json() : [])
        .then(events => events.filter((e: any) => e.type === 'sequence')),
  });

  const { data: sequences = [] } = useQuery<any[]>({
    queryKey: ['sequences'],
    queryFn: () => fetch('/api/crm/sequences').then(r => r.ok ? r.json() : []),
  });

  const updateStatus = useMutation({
    mutationFn: ({ enrollmentId, status }: { enrollmentId: string; status: string }) =>
      fetch(`/api/crm/sequences/enrollments/${enrollmentId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sequence-enrollments', contactId] });
      toast('success', 'Sequence status updated');
    },
  });

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex justify-center py-10"><RefreshCw className="w-5 h-5 animate-spin text-primary" /></div>
      ) : enrollments.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-[10px]">
          <Zap className="w-10 h-10 mx-auto mb-3 text-text-muted/30" />
          <p className="text-[13px] font-semibold text-text-muted">Not enrolled in any sequences</p>
          <p className="text-[12px] text-text-muted/60 mt-1 max-w-[240px] mx-auto">
            Enroll this contact in a sequence from the Sequences module or via automation
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {enrollments.map((enroll: any) => {
            const statusInfo = STATUS_STYLES[enroll.status] || STATUS_STYLES.active;
            const StatusIcon = statusInfo.icon;
            return (
              <div key={enroll.id} className="bg-bg border border-border rounded-[10px] p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h4 className="text-[14px] font-bold text-text-main">{enroll.sequenceName || 'Unnamed Sequence'}</h4>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Enrolled {new Date(enroll.enrolledAt || enroll.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusInfo.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusInfo.label}
                    </span>
                  </div>
                </div>

                {/* Steps progress bar */}
                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map(step => (
                    <div key={step} className={`h-1.5 flex-1 rounded-full transition-colors ${step <= (enroll.currentStep || 1) ? 'bg-primary' : 'bg-border'}`} />
                  ))}
                  <span className="text-[10px] text-text-muted ml-2 whitespace-nowrap">Step {enroll.currentStep || 1} of 5</span>
                </div>

                {enroll.status === 'active' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateStatus.mutate({ enrollmentId: enroll.id, status: 'paused' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-[6px] text-[11px] font-semibold text-text-muted hover:text-amber-400 hover:border-amber-400/30 transition-colors">
                      <Pause className="w-3 h-3" /> Pause
                    </button>
                    <button
                      onClick={() => updateStatus.mutate({ enrollmentId: enroll.id, status: 'unsubscribed' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-[6px] text-[11px] font-semibold text-text-muted hover:text-red-400 hover:border-red-400/30 transition-colors">
                      <XCircle className="w-3 h-3" /> Unenroll
                    </button>
                  </div>
                )}
                {enroll.status === 'paused' && (
                  <button
                    onClick={() => updateStatus.mutate({ enrollmentId: enroll.id, status: 'active' })}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-[6px] text-[11px] font-semibold text-text-muted hover:text-emerald-400 hover:border-emerald-400/30 transition-colors">
                    <Play className="w-3 h-3" /> Resume
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Available Sequences */}
      {sequences.length > 0 && (
        <div className="border-t border-border/50 pt-4">
          <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-3">Enroll in a Sequence</p>
          <div className="space-y-2">
            {sequences.slice(0, 3).map((seq: any) => (
              <div key={seq.id} className="flex items-center justify-between p-3 bg-bg border border-border rounded-[8px] hover:border-primary/30 transition-colors">
                <div>
                  <p className="text-[13px] font-semibold text-text-main">{seq.name}</p>
                  <p className="text-[11px] text-text-muted capitalize">{seq.status}</p>
                </div>
                <button
                  onClick={() => toast('info', `Enrolling in "${seq.name}"...`)}
                  className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-[6px] text-[11px] font-bold hover:bg-primary/20 transition-colors">
                  Enroll
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
