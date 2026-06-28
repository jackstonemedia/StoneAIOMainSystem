import React, { useState, useEffect } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { ChevronDown, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { apiFetch } from '../../lib/apiClient';

// Using minimal types to avoid massive imports, can refine later
type Pipeline = any;
type Contact = any;

interface OpportunityFormModalProps {
  pipelines: Pipeline[];
  contacts: Contact[];
  onClose: () => void;
  onSave: () => void;
  defaultPipelineId?: string;
  isOpen: boolean;
}

export function OpportunityFormModal({ pipelines, contacts, onClose, onSave, defaultPipelineId, isOpen }: OpportunityFormModalProps) {
  const qc = useQueryClient();
  const [contactSearch, setContactSearch] = useState('');
  const [contactDropOpen, setContactDropOpen] = useState(false);
  const [form, setForm] = useState({ title: '', pipelineId: defaultPipelineId || pipelines[0]?.id || '', stageId: '', status: 'open', amount: '', source: '', contactId: '', phone: '', email: '' });
  const [error, setError] = useState('');

  const selectedPipeline = pipelines.find(p => p.id === form.pipelineId);
  const stages = (selectedPipeline?.stages ?? []).sort((a: any, b: any) => a.order - b.order);

  useEffect(() => { if (stages.length && !form.stageId) setForm(f => ({ ...f, stageId: stages[0].id })); }, [stages.length, form.stageId]);

  const filteredContacts = contacts.filter(c => (c.name || `${c.firstName} ${c.lastName}`).toLowerCase().includes(contactSearch.toLowerCase()));

  const mut = useMutation({
    mutationFn: async (data: any) => {
      const r = await apiFetch('/api/crm/deals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error('Failed');
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deals'] }); onSave(); },
    onError: () => setError('Failed to create opportunity. Please try again.'),
  });

  const [isCreatingContact, setIsCreatingContact] = useState(false);

  const submit = async () => {
    if (!form.title.trim()) { setError('Opportunity name is required.'); return; }
    if (!form.stageId) { setError('Please select a stage.'); return; }
    setError('');

    let finalContactId = form.contactId || null;

    if (!finalContactId && (contactSearch || form.email || form.phone)) {
      setIsCreatingContact(true);
      try {
        const contactReq = await apiFetch('/api/crm/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: contactSearch.trim() || (form.email ? form.email.split('@')[0] : 'Unknown'),
            email: form.email || null,
            phone: form.phone || null,
          }),
        });
        if (contactReq.ok) {
          const contactData = await contactReq.json();
          finalContactId = contactData.id;
          qc.invalidateQueries({ queryKey: ['contacts'] });
        }
      } catch (err) {
        console.error('Failed to auto-create contact', err);
      } finally {
        setIsCreatingContact(false);
      }
    }

    mut.mutate({
      title: form.title,
      amount: parseFloat(form.amount) || 0,
      pipelineStageId: form.stageId,
      contactId: finalContactId,
      source: form.source || null,
      status: form.status,
      priority: 'medium',
      probability: stages.find((s:any) => s.id === form.stageId)?.probability ?? 30
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
        <DialogHeader className="px-6 py-5 border-b border-border bg-muted/30">
          <DialogTitle>Add new opportunity</DialogTitle>
          <DialogDescription>Fill in the details and select a contact to get started.</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[65vh] overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Contact details */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-foreground">Contact details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative space-y-2 col-span-2 sm:col-span-1">
                  <Label>Primary Contact Name</Label>
                  <Input 
                    placeholder="Search or enter new contact" 
                    value={contactSearch}
                    onChange={e => { setContactSearch(e.target.value); setContactDropOpen(true); setForm(f => ({ ...f, contactId: '' })); }}
                    onFocus={() => setContactDropOpen(true)}
                  />
                  <AnimatePresence>
                    {contactDropOpen && filteredContacts.length > 0 && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setContactDropOpen(false)} />
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="absolute top-[calc(100%+4px)] left-0 right-0 bg-popover border border-border rounded-md shadow-xl z-20 max-h-[180px] overflow-y-auto"
                        >
                          {filteredContacts.slice(0, 20).map((c: any) => (
                            <button key={c.id} onClick={() => { setContactSearch(c.name || `${c.firstName} ${c.lastName}`); setForm(f => ({ ...f, contactId: c.id, email: c.email || f.email, phone: c.phone || f.phone })); setContactDropOpen(false); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-accent text-left transition-colors"
                            >
                              <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                                {(c.name || c.firstName || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-xs font-medium">{c.name || `${c.firstName} ${c.lastName}`}</div>
                                {c.email && <div className="text-[10px] text-muted-foreground">{c.email}</div>}
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <Label>Primary Email</Label>
                  <Input type="email" placeholder="Enter Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Primary Phone</Label>
                  <Input type="tel" placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Opportunity Details */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-foreground">Opportunity Details</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Opportunity Name <span className="text-destructive">*</span></Label>
                  <Input placeholder="Enter opportunity name" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Pipeline</Label>
                    <Select value={form.pipelineId} onValueChange={(val) => { const p = pipelines.find(x => x.id === val); setForm(f => ({ ...f, pipelineId: val, stageId: p?.stages?.[0]?.id || '' })); }}>
                      <SelectTrigger><SelectValue placeholder="Select Pipeline" /></SelectTrigger>
                      <SelectContent>
                        {pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Stage</Label>
                    <Select value={form.stageId} onValueChange={(val) => setForm(f => ({ ...f, stageId: val }))}>
                      <SelectTrigger><SelectValue placeholder="Select Stage" /></SelectTrigger>
                      <SelectContent>
                        {stages.map((s:any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(val) => setForm(f => ({ ...f, status: val }))}>
                      <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="won">Won</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                        <SelectItem value="abandoned">Abandoned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Opportunity Value</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">$</span>
                      <Input type="number" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="pl-7" />
                    </div>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label>Opportunity Source</Label>
                    <Select value={form.source} onValueChange={(val) => setForm(f => ({ ...f, source: val }))}>
                      <SelectTrigger><SelectValue placeholder="Select Source" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {['Referral', 'Email Campaign', 'Inbound', 'Outbound', 'Google', 'LinkedIn', 'Conference', 'Cold Call'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-muted/30">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={mut.isPending || isCreatingContact}>
            {mut.isPending || isCreatingContact ? 'Creating...' : 'Create Opportunity'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
