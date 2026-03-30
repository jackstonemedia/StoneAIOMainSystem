import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, FileText, Trash2, Edit2, Eye, BarChart3,
  Type, AlignLeft, Mail, Phone, CheckSquare, List,
  Star, Calendar, ArrowUp, ArrowDown, GripVertical, X
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';

const API = '/api/business';
const getForms = () => fetch(`${API}/forms`).then(r => r.ok ? r.json() : []);

const FIELD_TYPES = [
  { type:'text',     label:'Short Text', icon:Type },
  { type:'textarea', label:'Long Text',  icon:AlignLeft },
  { type:'email',    label:'Email',      icon:Mail },
  { type:'phone',    label:'Phone',      icon:Phone },
  { type:'checkbox', label:'Checkbox',   icon:CheckSquare },
  { type:'select',   label:'Dropdown',   icon:List },
  { type:'rating',   label:'Rating',     icon:Star },
  { type:'date',     label:'Date',       icon:Calendar },
];

interface Field { id: string; type: string; label: string; required: boolean; placeholder?: string; }

function FormFieldPreview({ field }: { field: Field }) {
  return (
    <div className="p-4 bg-surface border border-border rounded-xl">
      <label className="text-sm font-medium text-text-main mb-1.5 block">
        {field.label}{field.required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {field.type === 'text'     && <div className="h-9 bg-bg border border-border rounded-lg px-3 flex items-center text-xs text-text-muted">{field.placeholder||'Your answer…'}</div>}
      {field.type === 'textarea' && <div className="h-20 bg-bg border border-border rounded-lg px-3 py-2 text-xs text-text-muted">{field.placeholder||'Your answer…'}</div>}
      {field.type === 'email'    && <div className="h-9 bg-bg border border-border rounded-lg px-3 flex items-center text-xs text-text-muted">you@example.com</div>}
      {field.type === 'phone'    && <div className="h-9 bg-bg border border-border rounded-lg px-3 flex items-center text-xs text-text-muted">+1 (555) 000-0000</div>}
      {field.type === 'checkbox' && <div className="flex items-center gap-2 text-xs text-text-muted"><div className="w-4 h-4 rounded border border-border"/>{field.placeholder||'Option'}</div>}
      {field.type === 'select'   && <div className="h-9 bg-bg border border-border rounded-lg px-3 flex items-center justify-between text-xs text-text-muted"><span>{field.placeholder||'Select an option'}</span><span>▾</span></div>}
      {field.type === 'rating'   && <div className="flex gap-1">{[1,2,3,4,5].map(i=><Star key={i} className="w-6 h-6 text-border"/>)}</div>}
      {field.type === 'date'     && <div className="h-9 bg-bg border border-border rounded-lg px-3 flex items-center text-xs text-text-muted">mm/dd/yyyy</div>}
    </div>
  );
}

export default function Forms() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<'list'|'builder'|'submissions'>('list');
  const [selectedForm, setSelectedForm] = useState<any>(null);
  const [fields, setFields] = useState<Field[]>([
    { id:'f1', type:'text',  label:'Full Name',   required:true  },
    { id:'f2', type:'email', label:'Email',        required:true  },
    { id:'f3', type:'phone', label:'Phone Number', required:false },
    { id:'f4', type:'textarea',label:'Message',   required:false, placeholder:'Tell us how we can help…' },
  ]);

  const { data: forms = [], isLoading } = useQuery<any[]>({ queryKey:['forms'], queryFn:getForms });

  const addField = (type: string) => {
    const ft = FIELD_TYPES.find(f=>f.type===type);
    setFields(prev => [...prev, { id:Date.now().toString(), type, label:ft?.label??type, required:false }]);
  };

  const removeField = (id: string) => setFields(prev=>prev.filter(f=>f.id!==id));
  const moveField   = (id: string, dir: -1|1) => {
    setFields(prev => {
      const idx = prev.findIndex(f=>f.id===id);
      if (idx+dir<0 || idx+dir>=prev.length) return prev;
      const a=[...prev]; [a[idx],a[idx+dir]]=[a[idx+dir],a[idx]]; return a;
    });
  };

  const MOCK_SUBMISSIONS = [
    { name:'Sarah Mitchell',  email:'sarah@example.com', phone:'+1 (555) 000-1111', message:'Interested in enterprise pricing.',  date:'2025-11-28' },
    { name:'James OBrien',    email:'james@example.com', phone:'+1 (555) 000-2222', message:'Need a demo for our team of 50.',    date:'2025-11-27' },
    { name:'Priya Sharma',    email:'priya@example.com', phone:'+1 (555) 000-3333', message:'Can you help migrate from HubSpot?', date:'2025-11-26' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Forms"
        subtitle="Build and manage lead capture forms"
        breadcrumb={['Business','Forms']}
        tabs={[
          {id:'list',    label:'All Forms',      count:forms.length},
          {id:'builder', label:'Form Builder'},
          {id:'submissions',label:'Submissions', count: selectedForm ? (selectedForm.submissions?.length ?? 0) : undefined},
        ]}
        activeTab={tab}
        onTabChange={t=>setTab(t as any)}
        actions={
          <button className="btn-primary text-sm py-2 px-4" onClick={()=>setTab('builder')}>
            <Plus className="w-4 h-4"/> New Form
          </button>
        }
      />

      {/* LIST */}
      {tab === 'list' && (
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            {isLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {[0,1,2].map(i=><div key={i} className="card-surface p-5"><div className="skeleton h-5 w-40 mb-3"/><div className="skeleton h-3 w-24"/></div>)}
              </div>
            ) : forms.length === 0 ? (
              <div className="text-center py-20">
                <FileText className="w-12 h-12 mx-auto text-border mb-4"/>
                <h3 className="font-semibold text-text-main mb-2">No forms yet</h3>
                <p className="text-sm text-text-muted mb-6">Create your first form to start capturing leads</p>
                <button className="btn-primary text-sm py-2 px-5" onClick={()=>setTab('builder')}><Plus className="w-4 h-4"/>Create Form</button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-5">
                {forms.map((form:any)=>{
                  const subCount = form.submissions?.length ?? 0;
                  const convRate = form.visits ? Math.round((subCount/form.visits)*100) : 0;
                  return (
                    <div key={form.id} className="glass-card-hover p-5 group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary"/>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={()=>{setSelectedForm(form);setTab('submissions');}} className="p-1.5 text-text-muted hover:text-primary rounded-lg hover:bg-primary/10 transition-colors"><BarChart3 className="w-3.5 h-3.5"/></button>
                          <button onClick={()=>setTab('builder')} className="p-1.5 text-text-muted hover:text-blue-400 rounded-lg hover:bg-blue-400/10 transition-colors"><Edit2 className="w-3.5 h-3.5"/></button>
                        </div>
                      </div>
                      <h3 className="font-semibold text-text-main mb-1">{form.name}</h3>
                      <p className="text-xs text-text-muted mb-4">Updated {new Date(form.updatedAt).toLocaleDateString()}</p>
                      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
                        {[
                          {label:'Views',label2:form.visits?.toLocaleString()??'0'},
                          {label:'Submits',label2:subCount},
                          {label:'Conv.',label2:`${convRate}%`},
                        ].map(s=>(
                          <div key={s.label} className="text-center">
                            <div className="text-base font-bold text-text-main">{s.label2}</div>
                            <div className="text-[10px] text-text-muted">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* BUILDER */}
      {tab === 'builder' && (
        <div className="flex-1 flex overflow-hidden">
          {/* Field palette */}
          <aside className="w-56 shrink-0 border-r border-border overflow-y-auto p-4">
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Add Fields</div>
            <div className="grid grid-cols-2 gap-2">
              {FIELD_TYPES.map(f=>(
                <button key={f.type} onClick={()=>addField(f.type)}
                  className="glass-card-hover flex flex-col items-center gap-1.5 p-2.5 text-center">
                  <f.icon className="w-4 h-4 text-primary"/>
                  <span className="text-[10px] font-medium text-text-muted">{f.label}</span>
                </button>
              ))}
            </div>
          </aside>

          {/* Canvas */}
          <div className="flex-1 overflow-y-auto p-8 bg-surface-hover/20 flex flex-col items-center">
            <div className="w-full max-w-lg space-y-4">
              <div className="card-surface rounded-2xl p-6 mb-2">
                <input defaultValue="Contact Us" className="text-xl font-bold text-text-main bg-transparent border-none outline-none w-full mb-1 focus:ring-0"/>
                <input defaultValue="Fill out the form and we'll be in touch within 24 hours." className="text-sm text-text-muted bg-transparent border-none outline-none w-full focus:ring-0"/>
              </div>

              {fields.map((field,i)=>(
                <div key={field.id} className="group relative">
                  <div className="absolute left-0 top-1/2 -translate-x-6 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={()=>moveField(field.id,-1)} className="text-text-muted hover:text-text-main transition-colors"><ArrowUp className="w-3.5 h-3.5"/></button>
                    <button onClick={()=>moveField(field.id,1)} className="text-text-muted hover:text-text-main transition-colors"><ArrowDown className="w-3.5 h-3.5"/></button>
                  </div>
                  <div className="relative">
                    <FormFieldPreview field={field}/>
                    <button onClick={()=>removeField(field.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-lg bg-surface border border-border text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-all">
                      <X className="w-3 h-3"/>
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={()=>{toast('success','Form saved','Your form has been published and is now live.');}}
                className="btn-primary w-full py-3 text-sm mt-4"
              >
                Save & Publish Form
              </button>
            </div>
          </div>

          {/* Right settings */}
          <aside className="w-56 shrink-0 border-l border-border overflow-y-auto p-4 space-y-5">
            <div>
              <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Form Settings</div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-text-muted mb-1 block">Submit Button</label>
                  <input className="input-luxury text-sm" defaultValue="Submit"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted mb-1 block">Success Message</label>
                  <textarea rows={2} className="input-luxury text-sm resize-none" defaultValue="Thank you! We'll be in touch shortly."/>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted mb-1 block">Redirect URL</label>
                  <input className="input-luxury text-sm" placeholder="https://…"/>
                </div>
              </div>
            </div>
            <div className="border-t border-border pt-4">
              <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">CRM Mapping</div>
              {fields.filter(f=>['text','email','phone'].includes(f.type)).map(f=>(
                <div key={f.id} className="mb-2">
                  <label className="text-[10px] text-text-muted block mb-1">{f.label}</label>
                  <select className="input-luxury text-xs py-1.5">
                    <option>— Don't map —</option>
                    <option>name</option>
                    <option>email</option>
                    <option>phone</option>
                    <option>company</option>
                  </select>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}

      {/* SUBMISSIONS */}
      {tab === 'submissions' && (
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            <h3 className="font-semibold text-lg mb-5">Submissions · {selectedForm?.name ?? 'Select a form'}</h3>
            <div className="card-surface overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left">
                <thead className="border-b border-border bg-surface/80">
                  <tr>
                    {['Name','Email','Phone','Message','Date'].map(h=>(
                      <th key={h} className="px-5 py-3.5 text-label-caps text-text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {MOCK_SUBMISSIONS.map((s,i)=>(
                    <tr key={i} className="hover:bg-surface-hover transition-colors">
                      <td className="px-5 py-3.5 text-sm font-medium text-text-main">{s.name}</td>
                      <td className="px-5 py-3.5 text-sm text-text-muted">{s.email}</td>
                      <td className="px-5 py-3.5 text-sm text-text-muted">{s.phone}</td>
                      <td className="px-5 py-3.5 text-sm text-text-muted max-w-xs truncate">{s.message}</td>
                      <td className="px-5 py-3.5 text-sm text-text-muted">{s.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
