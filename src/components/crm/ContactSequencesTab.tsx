import { Play, Pause, XCircle, Mail, Phone, Clock, CheckCircle2, RefreshCw, Zap } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../ui/Toast';

interface Props { contactId: string; workspaceId?: string; }

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
    queryKey: ['sequence-enrollments-by-contact', contactId],
    queryFn: async () => {
      // Fetch all sequences, then their enrollments
      const sequences = await fetch('/api/business/sequences').then(r => r.ok ? r.json() : []);
      const allEnrollments: any[] = [];
      for (const seq of sequences) {
        const enrolls = await fetch(`/api/business/sequences/${seq.id}/enrollments`)
          .then(r => r.ok ? r.json() : []);
        const filtered = enrolls
          .filter((e: any) => e.contactId === contactId)
          .map((e: any) => ({
            ...e,
            sequenceName: seq.name,
            steps: JSON.parse(seq.stepsJson || '[]'),
            progress: JSON.parse(e.sequenceData || '{}'),
          }));
        allEnrollments.push(...filtered);
      }
      return allEnrollments;
    },
  });

  const { data: sequences = [] } = useQuery<any[]>({
    queryKey: ['sequences'],
    queryFn: () => fetch('/api/business/sequences').then(r => r.ok ? r.json() : []),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ enrollmentId, status }: { enrollmentId: string; status: string }) => {
      const res = await fetch(`/api/business/sequences/enrollments/${enrollmentId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sequence-enrollments-by-contact', contactId] });
      toast('success', 'Sequence status updated');
    },
  });

  const enrollContact = useMutation({
    mutationFn: async (sequenceId: string) => {
      const res = await fetch(`/api/business/sequences/${sequenceId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_, seqId) => {
      const seq = sequences.find((s: any) => s.id === seqId);
      qc.invalidateQueries({ queryKey: ['sequence-enrollments-by-contact', contactId] });
      toast('success', `Enrolled in "${seq?.name}"`);
    },
    onError: (err: Error) => {
      toast('error', err.message || 'Failed to enroll');
    },
  });

  const enrolledIds = new Set(enrollments.map((e: any) => e.sequenceId));

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex justify-center py-10"><RefreshCw className="w-5 h-5 animate-spin text-primary" /></div>
      ) : enrollments.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-[10px]">
          <Zap className="w-10 h-10 mx-auto mb-3 text-text-muted/30" />
          <p className="text-[13px] font-semibold text-text-muted">Not enrolled in any sequences</p>
          <p className="text-[12px] text-text-muted/60 mt-1 max-w-[240px] mx-auto">
            Enroll this contact in a sequence from the lists below
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {enrollments.map((enroll: any) => {
            const statusInfo = STATUS_STYLES[enroll.status] || STATUS_STYLES.active;
            const StatusIcon = statusInfo.icon;
            const steps = enroll.steps || [];
            const progress = enroll.progress || {};
            const currentStep = progress.currentStepIndex ?? 0;
            const totalSteps = steps.length;

            return (
              <div key={enroll.id} className="bg-bg border border-border rounded-[10px] p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h4 className="text-[14px] font-bold text-text-main">{enroll.sequenceName || 'Unnamed Sequence'}</h4>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Enrolled {new Date(enroll.enrolledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusInfo.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusInfo.label}
                    </span>
                  </div>
                </div>

                {/* Steps indicator */}
                <div className="flex items-center gap-2 mb-3">
                  {steps.map((step: any, idx: number) => {
                    const StepIcon = STEP_ICONS[step.type] || Clock;
                    const isCompleted = idx < currentStep;
                    const isCurrent = idx === currentStep && enroll.status === 'active';
                    return (
                      <div key={step.id} className="flex items-center flex-1">
                        <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 text-[10px] ${
                          isCompleted ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' :
                          isCurrent ? 'bg-primary/20 border-primary text-primary animate-pulse' :
                          'bg-border/20 border-border text-text-muted/40'
                        }`}>
                          <StepIcon className="w-3 h-3" />
                        </div>
                        {idx < steps.length - 1 && (
                          <div className={`h-0.5 flex-1 mx-1 ${isCompleted ? 'bg-emerald-500/40' : 'bg-border/40'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                {enroll.status === 'active' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateStatus.mutate({ enrollmentId: enroll.id, status: 'paused' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-[6px] text-[11px] font-semibold text-text-muted hover:text-amber-400 hover:border-amber-400/30 transition-colors"
                      disabled={updateStatus.isPending}
                    >
                      <Pause className="w-3 h-3" /> Pause
                    </button>
                    <button
                      onClick={() => updateStatus.mutate({ enrollmentId: enroll.id, status: 'unsubscribed' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-[6px] text-[11px] font-semibold text-text-muted hover:text-red-400 hover:border-red-400/30 transition-colors"
                      disabled={updateStatus.isPending}
                    >
                      <XCircle className="w-3 h-3" /> Unenroll
                    </button>
                  </div>
                )}
                {enroll.status === 'paused' && (
                  <button
                    onClick={() => updateStatus.mutate({ enrollmentId: enroll.id, status: 'active' })}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-[6px] text-[11px] font-semibold text-text-muted hover:text-emerald-400 hover:border-emerald-400/30 transition-colors"
                    disabled={updateStatus.isPending}
                  >
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
            {sequences
              .filter((seq: any) => seq.status === 'active' && !enrolledIds.has(seq.id))
              .map((seq: any) => {
                const steps = JSON.parse(seq.stepsJson || '[]') as any[];
                return (
                  <div key={seq.id} className="flex items-center justify-between p-3 bg-bg border border-border rounded-[8px]">
                    <div>
                      <p className="text-[13px] font-semibold text-text-main">{seq.name}</p>
                      <p className="text-[11px] text-text-muted">
                        {steps.length} steps: {steps.filter(s => s.type === 'email').length} email, {steps.filter(s => s.type === 'sms').length} SMS
                      </p>
                    </div>
                    <button
                      onClick={() => enrollContact.mutate(seq.id)}
                      disabled={enrollContact.isPending}
                      className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-[6px] text-[11px] font-bold hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                      {enrollContact.isPending ? 'Enrolling...' : 'Enroll'}
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
