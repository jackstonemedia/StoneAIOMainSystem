import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Plus, Layers, FileText, Table, Mail,
  Sparkles, Download, Copy, Check, Trash2, Edit3, Eye,
  Clock, X, ChevronRight, FileDown, ExternalLink, RefreshCw
} from 'lucide-react';
import { MarkdownRenderer } from '../../components/assistant/MarkdownRenderer';

export type ArtifactType = 'document' | 'proposal' | 'email' | 'table' | 'research';

export interface ArtifactItem {
  id: string;
  title: string;
  type: ArtifactType;
  content: string;
  version: number;
  versions?: Array<{ version: number; content: string; createdAt: string }>;
  createdAt: string;
  updatedAt: string;
  conversationId?: string;
  tags?: string[];
}

const STARTER_ARTIFACTS: ArtifactItem[] = [
  {
    id: 'art-1',
    title: 'Enterprise Cloud Migration Proposal',
    type: 'proposal',
    version: 2,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    tags: ['Sales', 'Enterprise', 'Closing'],
    content: `# Enterprise Cloud Migration & Pipeline Proposal

**Client**: Apex Cloud Systems  
**Prepared By**: Stone AI Strategic Solutions  
**Target Execution Date**: Q1 2027  

---

### Executive Summary

Apex Cloud Systems is transitioning 4 enterprise workloads to a high-availability multi-tenant cloud architecture. This proposal outlines the phased execution strategy, infrastructure requirements, and commercial pricing model.

### Key Objectives
1. **Zero Downtime Migration**: Migrate 14TB of active production transactional data with zero customer disruption.
2. **Security Compliance**: Ensure SOC-2 Type II, HIPAA, and ISO 27001 data isolation at rest and in transit.
3. **Pipeline Velocity**: Integrate automated CRM deal synchronization across team leads.

### Commercial Investment Breakdown

| Phase | Milestone Deliverables | Timeline | Investment |
| :--- | :--- | :--- | :--- |
| **Phase 1: Discovery** | Architecture audit & compliance validation | Weeks 1-3 | $25,000 |
| **Phase 2: Staging** | Shadow replication & load testing | Weeks 4-7 | $45,000 |
| **Phase 3: Cutover** | Final production sync & failover certification | Weeks 8-10 | $50,000 |
| **Total** | **Full Turnkey Deployment** | **10 Weeks** | **$120,000** |

---

### Acceptance & Next Milestones
- Mutual NDA & Security Schedule execution by Friday
- Technical stakeholder discovery workshop scheduled for Monday at 10:00 AM EST`,
    versions: [
      {
        version: 1,
        content: '# Draft Proposal\nInitial baseline proposal for Apex Cloud.',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
      {
        version: 2,
        content: `# Enterprise Cloud Migration & Pipeline Proposal\n\nFull revised commercial proposal.`,
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
    ],
  },
  {
    id: 'art-2',
    title: 'Q4 Pipeline Velocity & Revenue Audit Table',
    type: 'table',
    version: 1,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    tags: ['Pipeline', 'Finance', 'Revenue'],
    content: `# Active Pipeline Performance Snapshot

| Deal Name | Account | Stage | Value | Probability | Expected Close | Owner |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Enterprise Cloud Migration** | Apex Cloud Systems | Closing | $120,000 | 85% | Nov 18, 2026 | J. Stone |
| **Omnichannel Fleet Sync** | Horizon Logistics | Proposal | $85,000 | 60% | Nov 24, 2026 | M. Vance |
| **Quarterly Retention Automation** | Vanguard Global | Negotiation | $75,000 | 75% | Dec 02, 2026 | S. Jenkins |
| **Retail AI Copilot Pilot** | Nexa Retail Solutions | Demo Done | $45,000 | 40% | Dec 15, 2026 | E. Rostova |
| **Automated Inbound Lead Routing** | Summit Partners | Discovery | $32,000 | 30% | Jan 08, 2027 | J. Stone |

### Summary Statistics
- **Total Pipeline**: $357,000
- **Weighted Forecast**: $251,800
- **Closing Velocity**: 24.2 days average deal cycle`,
  },
  {
    id: 'art-3',
    title: 'High-Touch Executive Re-engagement Sequence',
    type: 'email',
    version: 1,
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    tags: ['Outreach', 'Sequences'],
    content: `### Email 1: The Insight-Led Reconnect
**Subject**: Quick thoughts on accelerating your enterprise deal velocity

Hi {{firstName}},

I noticed your recent announcement regarding the expansion of {{company}}'s operations into new regional hubs. Congratulations on that momentum.

When teams scale distributed units at this pace, coordinating multi-channel outreach without increasing administrative overhead becomes a major hurdle. 

We recently worked with a comparable organization in your space to consolidate their sales engagement and lead intelligence, which cut their lead response time from 4 hours to 9 minutes.

Would you be open to a 10-minute introductory conversation this Thursday or Friday to benchmark your current setup?

Best regards,  
**Jack Stone**  
Stone AI Solutions

---

### Email 2: The Practical Proof Point (Send +4 Days)
**Subject**: 3 quick metrics from our latest audit

Hi {{firstName}},

Following up on my previous note. I wanted to share a concrete framework our clients use to audit deal stalls:

1. **First-touch velocity**: Responding within 5 minutes increases conversion rates by 8x.
2. **Context-aware reminders**: 62% of enterprise deals stall due to generic follow-ups.
3. **Automated approval workflows**: Eliminates 3-day internal sign-off delays.

If you have 10 minutes next week, let's connect. Feel free to grab a slot directly on my calendar here: {{bookingLink}}`,
  },
  {
    id: 'art-4',
    title: 'Prospect Intelligence Dossier: Nexa Retail Solutions',
    type: 'research',
    version: 1,
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    tags: ['Deep Research', 'Accounts'],
    content: `# Prospect Intelligence Dossier: Nexa Retail Solutions

### Company Overview
- **Legal Entity**: Nexa Retail Technologies, Inc.
- **Headquarters**: Chicago, IL
- **Headcount**: 185 employees (LinkedIn estimated)
- **Estimated Annual Revenue**: $28M - $35M ARR
- **Primary Domain**: nexaretail.example.com

### Key Decision Makers
1. **Elena Rostova** — Chief Commercial Officer (Champion, attended initial discovery)
2. **David Chen** — VP of Retail Technology (Technical Decision Maker)
3. **Karen Miller** — Director of Revenue Operations (Evaluator)

### Technology Stack Detected
- **CRM**: Salesforce Sales Cloud (Legacy setup, migrating to modern stack)
- **Marketing Automation**: HubSpot Marketing Hub
- **Customer Support**: Zendesk Enterprise
- **Cloud Infrastructure**: AWS (us-east-1)

### Pain Points & Buying Triggers
- High churn among first-time omnichannel shoppers.
- Disconnected customer service and sales notes requiring manual data re-entry.
- Looking to launch an AI automated assistant across store manager tablets in Q1 2027.`,
  },
];

const TYPE_CONFIG: Record<ArtifactType, { label: string; color: string; icon: any }> = {
  document: { label: 'Document', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30', icon: FileText },
  proposal: { label: 'Proposal', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: Sparkles },
  email: { label: 'Email Draft', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30', icon: Mail },
  table: { label: 'Data Table', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30', icon: Table },
  research: { label: 'Deep Research', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30', icon: Layers },
};

export default function AssistantArtifactsPage() {
  const navigate = useNavigate();

  const [artifacts, setArtifacts] = useState<ArtifactItem[]>(() => {
    try {
      const saved = localStorage.getItem('assistant_artifacts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    return STARTER_ARTIFACTS;
  });

  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<ArtifactType | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('assistant_artifacts', JSON.stringify(artifacts));
  }, [artifacts]);

  const filteredArtifacts = useMemo(() => {
    return artifacts.filter((item) => {
      if (selectedType !== 'all' && item.type !== selectedType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchContent = item.content.toLowerCase().includes(q);
        const matchTags = (item.tags || []).some((t) => t.toLowerCase().includes(q));
        return matchTitle || matchContent || matchTags;
      }
      return true;
    });
  }, [artifacts, selectedType, searchQuery]);

  const handleOpenArtifact = (art: ArtifactItem) => {
    setSelectedArtifact(art);
    setEditContent(art.content);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (!selectedArtifact) return;
    const newVersion = selectedArtifact.version + 1;
    const nowIso = new Date().toISOString();
    const updated: ArtifactItem = {
      ...selectedArtifact,
      content: editContent,
      version: newVersion,
      updatedAt: nowIso,
      versions: [
        ...(selectedArtifact.versions || [
          {
            version: selectedArtifact.version,
            content: selectedArtifact.content,
            createdAt: selectedArtifact.createdAt,
          },
        ]),
        { version: newVersion, content: editContent, createdAt: nowIso },
      ],
    };

    setArtifacts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setSelectedArtifact(updated);
    setIsEditing(false);
  };

  const handleDeleteArtifact = (id: string) => {
    setArtifacts((prev) => prev.filter((a) => a.id !== id));
    if (selectedArtifact?.id === id) {
      setSelectedArtifact(null);
    }
  };

  const handleCopyContent = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadFile = (item: ArtifactItem) => {
    const ext = item.type === 'table' ? 'csv' : 'md';
    const blob = new Blob([item.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#1E1E1E] text-[#ECECEC] font-inter overflow-hidden select-none">
      {/* Top Header Bar */}
      <div className="h-14 border-b border-[#2C2C2C] px-6 flex items-center justify-between shrink-0 bg-[#191919]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/assistant')}
            className="p-1.5 rounded-lg text-[#8A8A8D] hover:text-white hover:bg-[#282828] transition-colors cursor-pointer"
            title="Back to Chat"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h1 className="text-sm font-semibold text-white tracking-tight">Artifacts</h1>
            <span className="text-xs text-[#8A8A8D] px-2 py-0.5 rounded-full bg-[#242424] border border-[#2F2F2F]">
              {artifacts.length} items
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const newArt: ArtifactItem = {
                id: `art-${Date.now()}`,
                title: 'Untitled Document',
                type: 'document',
                version: 1,
                content: '# Untitled Document\n\nStart drafting your content here...',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                tags: ['Draft'],
              };
              setArtifacts((prev) => [newArt, ...prev]);
              handleOpenArtifact(newArt);
              setIsEditing(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Artifact</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Filter & List */}
        <div className={`flex flex-col h-full border-r border-[#2C2C2C] transition-all ${selectedArtifact ? 'w-[360px] md:w-[420px]' : 'w-full max-w-5xl mx-auto px-6 py-6'}`}>
          {/* Search & Filter Header */}
          <div className="p-4 border-b border-[#2C2C2C] space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A8D]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search artifacts by title, tag, or content..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs bg-[#141414] text-white placeholder-[#7A7A7D] border border-[#2A2A2A] outline-none focus:border-primary transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7A7A7D] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Type Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-[11px]">
              {(['all', 'document', 'proposal', 'email', 'table', 'research'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedType(t)}
                  className={`px-2.5 py-1 rounded-md capitalize transition-colors whitespace-nowrap cursor-pointer ${
                    selectedType === t
                      ? 'bg-white text-black font-semibold'
                      : 'text-[#8A8A8D] hover:text-white hover:bg-[#282828]'
                  }`}
                >
                  {t === 'all' ? `All (${artifacts.length})` : t}
                </button>
              ))}
            </div>
          </div>

          {/* Artifact Cards Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
            {filteredArtifacts.length === 0 ? (
              <div className="text-center py-12 text-[#7A7A7D]">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-medium">No artifacts found</p>
                <p className="text-[11px] opacity-70">Artifacts created during conversations appear here.</p>
              </div>
            ) : (
              filteredArtifacts.map((art) => {
                const conf = TYPE_CONFIG[art.type] || TYPE_CONFIG.document;
                const Icon = conf.icon;
                const isSelected = selectedArtifact?.id === art.id;

                return (
                  <div
                    key={art.id}
                    onClick={() => handleOpenArtifact(art)}
                    className={`group p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#282828] border-primary/60 shadow-sm'
                        : 'bg-[#1C1C1C] border-[#2A2A2A] hover:border-[#383838] hover:bg-[#222222]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${conf.color}`}>
                          <Icon className="w-3 h-3" />
                          <span>{conf.label}</span>
                        </span>
                        <span className="text-[10px] font-mono text-[#7A7A7D]">v{art.version}</span>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleCopyContent(art.id, art.content)}
                          title="Copy content"
                          className="p-1 rounded hover:bg-white/10 text-[#8A8A8D] hover:text-white transition-colors"
                        >
                          {copiedId === art.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadFile(art)}
                          title="Download file"
                          className="p-1 rounded hover:bg-white/10 text-[#8A8A8D] hover:text-white transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteArtifact(art.id)}
                          title="Delete artifact"
                          className="p-1 rounded hover:bg-rose-500/20 text-[#8A8A8D] hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-xs font-semibold text-white truncate mb-1">{art.title}</h3>

                    {/* Preview line */}
                    <p className="text-[11px] text-[#8A8A8D] line-clamp-2 leading-relaxed font-normal">
                      {art.content.replace(/[#*`|]/g, '').trim()}
                    </p>

                    {/* Footer Tags & Timestamp */}
                    <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-[#2A2A2A]/60 text-[10px] text-[#7A7A7D]">
                      <div className="flex items-center gap-1.5 truncate">
                        {(art.tags || []).map((tag, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 rounded bg-[#262626] text-[#A0A0A5]">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <span className="shrink-0">{new Date(art.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Slide-Over Interactive Viewer & Editor */}
        {selectedArtifact && (
          <div className="flex-1 flex flex-col h-full bg-[#1A1A1A] overflow-hidden animate-in fade-in slide-in-from-right-4">
            {/* Viewer Top Bar */}
            <div className="h-12 border-b border-[#2C2C2C] px-5 flex items-center justify-between shrink-0 bg-[#161616]">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${TYPE_CONFIG[selectedArtifact.type].color}`}>
                  {TYPE_CONFIG[selectedArtifact.type].label}
                </span>
                <span className="text-xs font-semibold text-white truncate max-w-[280px]">
                  {selectedArtifact.title}
                </span>
                <span className="text-[10px] font-mono text-[#8A8A8D] px-1.5 py-0.5 rounded bg-[#262626]">
                  v{selectedArtifact.version}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Edit Toggle */}
                {isEditing ? (
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Version</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border border-[#333333] hover:bg-[#282828] text-white transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleCopyContent(selectedArtifact.id, selectedArtifact.content)}
                  title="Copy content"
                  className="p-1.5 rounded hover:bg-[#282828] text-[#8A8A8D] hover:text-white transition-colors"
                >
                  {copiedId === selectedArtifact.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadFile(selectedArtifact)}
                  title="Export file"
                  className="p-1.5 rounded hover:bg-[#282828] text-[#8A8A8D] hover:text-white transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedArtifact(null)}
                  title="Close viewer"
                  className="p-1.5 rounded hover:bg-[#282828] text-[#8A8A8D] hover:text-white transition-colors ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Version Switcher Bar */}
            {selectedArtifact.versions && selectedArtifact.versions.length > 1 && (
              <div className="px-5 py-2 border-b border-[#2C2C2C] bg-[#141414] flex items-center gap-2 text-xs">
                <span className="text-[10px] uppercase font-bold text-[#7A7A7D] tracking-wider">Version History:</span>
                <div className="flex items-center gap-1.5">
                  {selectedArtifact.versions.map((ver) => (
                    <button
                      key={ver.version}
                      type="button"
                      onClick={() => {
                        setEditContent(ver.content);
                        setSelectedArtifact({ ...selectedArtifact, content: ver.content, version: ver.version });
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                        selectedArtifact.version === ver.version
                          ? 'bg-primary text-white font-semibold'
                          : 'bg-[#222222] text-[#8A8A8D] hover:text-white'
                      }`}
                    >
                      v{ver.version}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Editor or Markdown Body */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar select-text">
              {isEditing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-full bg-[#111111] text-[#ECECEC] font-mono text-xs p-4 rounded-xl border border-[#333333] outline-none focus:border-primary resize-none leading-relaxed"
                />
              ) : (
                <div className="max-w-3xl mx-auto prose prose-invert prose-sm">
                  <MarkdownRenderer content={selectedArtifact.content} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
