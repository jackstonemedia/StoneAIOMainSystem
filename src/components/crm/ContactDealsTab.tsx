import React, { useState } from 'react';
import { TrendingUp, Plus, DollarSign, CircleDollarSign, ArrowRight } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { opportunitiesApi } from '../../lib/api/opportunities';
import { CreateOpportunityModal } from '../../pages/opportunities/components/CreateOpportunityModal';
import type { Opportunity } from '../../types/opportunities';

interface Props {
  contactId: string;
  workspaceId?: string;
}

export default function ContactDealsTab({ contactId }: Props) {
  const qc = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: oppsResponse, isLoading } = useQuery({
    queryKey: ['opportunities', { contactId }],
    queryFn: () => opportunitiesApi.list({ contactId }),
  });

  const deals: Opportunity[] = oppsResponse?.opportunities || [];

  const totalValue = deals.reduce((s, d) => s + (d.amount || 0), 0);
  const openDeals = deals.filter(d => d.status === 'open');
  const wonDeals = deals.filter(d => d.status === 'won');

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      {deals.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Pipeline', value: `$${totalValue.toLocaleString()}`, icon: DollarSign, color: 'text-primary' },
            { label: 'Open Deals', value: openDeals.length, icon: TrendingUp, color: 'text-blue-400' },
            { label: 'Won Deals', value: wonDeals.length, icon: TrendingUp, color: 'text-emerald-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-bg border border-border rounded-[8px] p-3 flex items-center gap-2.5">
              <stat.icon className={`w-4 h-4 ${stat.color} shrink-0`} />
              <div>
                <p className="text-[15px] font-bold text-text-main">{stat.value}</p>
                <p className="text-[10px] text-text-muted font-medium">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <h3 className="text-[13px] font-bold text-text-main">Opportunities</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-[6px] text-[12px] font-bold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" /> Create Opportunity
        </button>
      </div>

      {/* Deals List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface-hover">
              <div className="w-8 h-8 rounded-lg bg-surface shrink-0 animate-pulse" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3 w-40 rounded bg-surface animate-pulse" />
                <div className="h-3 w-24 rounded bg-surface animate-pulse" />
              </div>
              <div className="h-5 w-16 rounded-full bg-surface animate-pulse" />
            </div>
          ))}
        </div>
      ) : deals.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-border rounded-xl space-y-2">
          <p className="text-xs text-text-muted">No opportunities linked to this contact yet.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-xs text-primary font-semibold hover:underline"
          >
            + Create Opportunity
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {deals.map(deal => {
            const stageName = deal.pipelineStage?.name || 'Stage';
            const isWon = deal.status === 'won' || deal.pipelineStage?.isWon;
            const isLost = deal.status === 'lost' || deal.pipelineStage?.isLost;
            const colorClass = isWon ? 'text-emerald-400' : isLost ? 'text-red-400' : 'text-primary';

            return (
              <Link
                key={deal.id}
                to={`/opportunities/${deal.id}`}
                className="flex items-center justify-between p-4 bg-bg border border-border rounded-[10px] hover:border-primary/50 transition-colors group relative overflow-hidden"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <CircleDollarSign className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-[14px] text-text-main group-hover:text-primary transition-colors">
                      {deal.title}
                    </div>
                    <div className="text-[12px] text-text-muted mt-0.5">
                      {deal.pipelineStage?.pipeline?.name || 'Pipeline'} • Close date: {deal.closeDate ? new Date(deal.closeDate).toLocaleDateString() : 'No date'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-bold text-[15px] text-text-main">${(deal.amount || 0).toLocaleString()}</div>
                    <div className={`text-[12px] font-bold mt-0.5 ${colorClass}`}>{stageName}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <CreateOpportunityModal
        isOpen={showCreateModal}
        initialContactId={contactId}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['opportunities'] })}
      />
    </div>
  );
}
