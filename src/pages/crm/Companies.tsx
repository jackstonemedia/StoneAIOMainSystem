import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCompanies } from '../../lib/api';
import { 
  MondayTable, MondayHeader, MondayToolbar, MondayGroup, 
  MondayHeaderRow, MondayHeaderCell, MondayRow, MondayCell, 
  StatusPill, MondayAddBlock 
} from '../../components/crm/MondayTable';

interface Company {
  id: string;
  name: string;
  domain?: string | null;
  industry?: string | null;
  employees?: string | null;
  location?: string | null;
  description?: string | null;
}

export default function Companies() {
  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ['companies'],
    queryFn: getCompanies
  });

  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [companiesCollapsed, setCompaniesCollapsed] = useState(false);

  // Fallback map mimicking image 2
  const displayAccounts = companies.length > 0 ? companies : [
    { id: '1', name: 'Google', domain: 'https://google.com', industry: 'Software, Data', description: 'Google is a multinational corporation that s...', employees: '10000+', location: 'Mountain View CA' },
    { id: '2', name: 'Apple', domain: 'https://apple.com', industry: 'Hardware, Consumer Electronics', description: 'Apple Inc. is an American multinational tech...', employees: '1001-5000', location: 'California, USA' },
    { id: '3', name: 'Amazon', domain: 'https://amazon.com', industry: 'Retail, Cloud', description: 'Amazon is a multinational technology comp...', employees: '10000+', location: 'Seattle, WA' },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-surface relative">
      <MondayHeader title="Accounts" />
      <MondayToolbar onAdd={() => setIsSlideOverOpen(true)} actionButtonText="New account" />

      <div className="flex-1 overflow-auto pb-24">
        {/* COMPANIES GROUP */}
        <MondayGroup 
          title="Companies" 
          color="text-[#00cff4]" 
          isCollapsed={companiesCollapsed}
          onToggle={() => setCompaniesCollapsed(!companiesCollapsed)}
        >
          <MondayHeaderRow>
            <MondayHeaderCell width="w-[260px]">Account</MondayHeaderCell>
            <MondayHeaderCell width="w-[200px]">Domain</MondayHeaderCell>
            <MondayHeaderCell width="w-[250px]">Industry</MondayHeaderCell>
            <MondayHeaderCell width="w-[300px]">Description</MondayHeaderCell>
            <MondayHeaderCell width="w-[140px]">No. of employees</MondayHeaderCell>
            <MondayHeaderCell width="w-[180px]">Headquarters locati...</MondayHeaderCell>
          </MondayHeaderRow>
          
          {displayAccounts.map((a) => {
            return (
              <MondayRow key={a.id} groupColorClass="bg-[#00cff4]">
                <MondayCell width="w-[260px]">
                  <span className="font-medium hover:text-primary hover:underline cursor-pointer text-text-main">
                    {a.name}
                  </span>
                </MondayCell>
                <MondayCell width="w-[200px]">
                  <a href={a.domain || '#'} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate w-full cursor-pointer">
                    {a.domain || '-'}
                  </a>
                </MondayCell>
                <MondayCell width="w-[250px]">
                   <div className="flex items-center gap-1.5 flex-wrap overflow-hidden h-[26px]">
                     {a.industry?.split(',').map((ind, i) => (
                       <span key={i} className="px-2 py-0.5 bg-bg text-[#008291] rounded text-[11px] font-medium whitespace-nowrap">
                         {ind.trim()}
                       </span>
                     ))}
                   </div>
                </MondayCell>
                <MondayCell width="w-[300px]">
                  <span className="truncate w-full">{a.description || '-'}</span>
                </MondayCell>
                <MondayCell width="w-[140px]" className="justify-center">
                  {a.employees || '-'}
                </MondayCell>
                <MondayCell width="w-[180px]" className="justify-center">
                  {a.location || '-'}
                </MondayCell>
              </MondayRow>
            );
          })}
          
          <MondayRow groupColorClass="bg-[#00cff4]" isBottomAddLayout>
             <MondayCell width="w-[260px]">
                <span className="pl-6">+ Add account</span>
             </MondayCell>
             <MondayCell width="w-[200px]" />
             <MondayCell width="w-[250px]" />
             <MondayCell width="w-[300px]" />
             <MondayCell width="w-[140px]" />
             <MondayCell width="w-[180px]" />
          </MondayRow>
        </MondayGroup>

        <MondayAddBlock onClick={() => console.log('add group')} />
      </div>
    </div>
  );
}
