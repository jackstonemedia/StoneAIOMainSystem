import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getActivities } from '../../lib/api';
import { 
  MondayTable, MondayHeader, MondayToolbar, MondayGroup, 
  MondayHeaderRow, MondayHeaderCell, MondayRow, MondayCell, 
  StatusPill, MondayAddBlock 
} from '../../components/crm/MondayTable';

interface Activity {
  id: string;
  type: string; // 'meeting', 'call', 'email', 'note', etc
  title: string;
  createdAt: string;
  userId?: string;
  contactId?: string;
}

const getActivityTypeStyles = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes('call')) return { label: 'Call summary', color: '#ff9900' }; // orange
  if (t.includes('meeting')) return { label: 'Meeting', color: '#2b508f' }; // dark blue
  if (t.includes('email')) return { label: 'Email', color: '#00cff4' }; // cyan
  return { label: type, color: '#c4c4c4' };
};

export default function Activities() {
  const { data: activities = [], isLoading } = useQuery<Activity[]>({
    queryKey: ['activities'],
    queryFn: getActivities
  });

  const [activitiesCollapsed, setActivitiesCollapsed] = useState(false);

  const displayActivities = activities.length > 0 ? activities : [
    { id: '1', title: 'Phone call with Robert', owner: 'S', type: 'call', date: 'Mar 14, 11:00 AM', end: 'Mar 14, 11:30 AM', status: 'Done', related: 'Amazon deal' },
    { id: '2', title: 'Meeting with Steven', owner: 'S', type: 'meeting', date: 'Mar 24, 2:00 PM', end: 'Mar 24, 2:30 PM', status: 'Done', related: 'Google deal' },
    { id: '3', title: 'Meeting with Robert', owner: 'S', type: 'meeting', date: 'Apr 5, 1:00 PM', end: 'Apr 5, 2:00 PM', status: 'Done', related: 'Amazon deal' },
    { id: '4', title: 'Donna Sege - Meeting', owner: 'J', type: 'meeting', date: 'Mar 27, 9:00 AM', end: 'Mar 27, 9:30 AM', status: 'Done', related: 'Donna Sege' },
    { id: '5', title: 'Robert Thompson - Meeting', owner: 'J', type: 'meeting', date: 'Mar 27, 9:00 AM', end: 'Mar 27, 9:30 AM', status: 'Done', related: 'Robert Thompson' },
    { id: '6', title: 'Gordon Farrell - Meeting', owner: 'J', type: 'meeting', date: 'Mar 26, 9:00 AM', end: 'Mar 26, 9:30 AM', status: 'Done', related: 'Gordon Farrell' },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-white relative">
      <MondayHeader title="Activities" />
      <MondayToolbar onAdd={() => console.log('new')} actionButtonText="New activity" />

      <div className="flex-1 overflow-auto pb-24">
        <MondayGroup 
          title="Account Activities" 
          color="text-[#579bfc]" 
          isCollapsed={activitiesCollapsed}
          onToggle={() => setActivitiesCollapsed(!activitiesCollapsed)}
        >
          <MondayHeaderRow>
            <MondayHeaderCell width="w-[300px]">Activity</MondayHeaderCell>
            <MondayHeaderCell width="w-[100px]">Owner</MondayHeaderCell>
            <MondayHeaderCell width="w-[150px]">Activity Type</MondayHeaderCell>
            <MondayHeaderCell width="w-[160px]">Start time</MondayHeaderCell>
            <MondayHeaderCell width="w-[160px]">End time</MondayHeaderCell>
            <MondayHeaderCell width="w-[120px]">Status</MondayHeaderCell>
            <MondayHeaderCell width="w-[180px]">Related item</MondayHeaderCell>
          </MondayHeaderRow>
          
          {displayActivities.map((a: any) => {
            const typePill = getActivityTypeStyles(a.type);
            return (
              <MondayRow key={a.id} groupColorClass="bg-[#579bfc]">
                <MondayCell width="w-[300px]">
                  <span className="font-medium text-slate-800">{a.title}</span>
                </MondayCell>
                <MondayCell width="w-[100px]" className="justify-center">
                  <div className="w-7 h-7 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-500 font-bold text-xs">
                    {a.owner}
                  </div>
                </MondayCell>
                <MondayCell width="w-[150px]" isStatusPill statusColor={typePill.color}>
                   <StatusPill color={typePill.color} label={typePill.label} />
                </MondayCell>
                <MondayCell width="w-[160px]" className="justify-center">
                  {a.date}
                </MondayCell>
                <MondayCell width="w-[160px]" className="justify-center">
                  {a.end || a.date}
                </MondayCell>
                <MondayCell width="w-[120px]" isStatusPill statusColor={a.status === 'Done' ? '#00c875' : '#c4c4c4'}>
                   <StatusPill color={a.status === 'Done' ? '#00c875' : '#c4c4c4'} label={a.status || 'Pending'} />
                </MondayCell>
                <MondayCell width="w-[180px]">
                   <span className="text-slate-600 truncate p-1">{a.related || '-'}</span>
                </MondayCell>
              </MondayRow>
            );
          })}
          
          <MondayRow groupColorClass="bg-[#579bfc]" isBottomAddLayout>
             <MondayCell width="w-[300px]">
                <span className="pl-6">+ Add activity</span>
             </MondayCell>
             <MondayCell width="w-[100px]" />
             <MondayCell width="w-[150px]" />
             <MondayCell width="w-[160px]" />
             <MondayCell width="w-[160px]" />
             <MondayCell width="w-[120px]" />
             <MondayCell width="w-[180px]" />
          </MondayRow>
        </MondayGroup>

        <MondayAddBlock onClick={() => console.log('add group')} />
      </div>
    </div>
  );
}
