import { useState } from 'react';
import type { DateRange } from '../types/dashboard';
import { apiClient } from '../lib/apiClient';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import { useQuery } from '@tanstack/react-query';

import { DashboardToolbar } from '../components/dashboard/DashboardToolbar';
import { AddWidgetModal } from '../components/dashboard/AddWidgetModal';
import { DashboardGrid } from '../components/dashboard/DashboardGrid';

export default function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [pipelineFilter, setPipelineFilter] = useState('all');
  const [contactFilter, setContactFilter] = useState('all');

  const [isAddOpen, setIsAddOpen] = useState(false);

  const { metrics, isLoading: isMetricsLoading } = useDashboardMetrics(dateRange);

  const pipelineOptions = [
    { id: 'all', label: 'All pipelines' },
    ...((metrics?.pipeline_stages ?? []).map((stage) => ({ id: stage.name, label: stage.name }))),
  ];

  const { data: contactOptions = [] } = useQuery({
    queryKey: ['dashboard_contact_filters'],
    queryFn: async () => {
      const response = await apiClient.get<{ contacts?: { id: string; firstName?: string; lastName?: string; email?: string | null }[] }>('/crm/contacts');
      const contacts = Array.isArray(response.data) ? response.data : response.data.contacts ?? [];
      return [
        { id: 'all', label: 'All contacts' },
        ...contacts.slice(0, 100).map((contact) => ({
          id: contact.id,
          label: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email || 'Unnamed contact',
        })),
      ];
    },
  });

  const {
    layout,
    saveLayout,
    addWidget,
    removeWidget,
    resetToDefault,
    isEditing,
    setIsEditing,
  } = useDashboardLayout('primary');

  return (
    <div className="flex flex-col h-full w-full relative bg-bg text-text-main font-sans">
      <DashboardToolbar
        greeting="Your CRM at a glance"
        pipelineOptions={pipelineOptions}
        contactOptions={contactOptions}
        activePipeline={pipelineFilter}
        activeContact={contactFilter}
        onPipelineChange={setPipelineFilter}
        onContactChange={setContactFilter}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        isEditing={isEditing}
        onToggleEdit={() => setIsEditing(!isEditing)}
        onAddWidget={() => setIsAddOpen(true)}
        onResetLayout={resetToDefault}
      />

      <AddWidgetModal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAdd={(type, config) => {
          addWidget(type, config);
          setIsAddOpen(false);
        }}
        existingTypes={layout.widgets.map((widget) => widget.type)}
      />

      <div className="flex-1 overflow-auto">
        <div className="mx-4 md:mx-6 mt-5 mb-6 space-y-5">

          <DashboardGrid
            layout={layout}
            metrics={metrics}
            isMetricsLoading={isMetricsLoading}
            dateRange={dateRange}
            isEditing={isEditing}
            onLayoutChange={saveLayout}
            onRemoveWidget={removeWidget}
          />

        </div>
      </div>
    </div>
  );
}
