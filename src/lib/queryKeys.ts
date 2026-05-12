/**
 * Centralized TanStack Query key factory.
 *
 * Usage:
 *   useQuery({ queryKey: queryKeys.crm.contacts() })
 *   queryClient.invalidateQueries({ queryKey: queryKeys.crm.contacts() })
 */
export const queryKeys = {
  crm: {
    all: ['crm'] as const,
    contacts: () => [...queryKeys.crm.all, 'contacts'] as const,
    contact: (id: string) => [...queryKeys.crm.contacts(), id] as const,
    companies: () => [...queryKeys.crm.all, 'companies'] as const,
    company: (id: string) => [...queryKeys.crm.companies(), id] as const,
    deals: () => [...queryKeys.crm.all, 'deals'] as const,
    deal: (id: string) => [...queryKeys.crm.deals(), id] as const,
    tasks: () => [...queryKeys.crm.all, 'tasks'] as const,
    activities: () => [...queryKeys.crm.all, 'activities'] as const,
    pipelines: () => [...queryKeys.crm.all, 'pipelines'] as const,
    smartLists: () => [...queryKeys.crm.all, 'smart-lists'] as const,
    dashboard: () => [...queryKeys.crm.all, 'dashboard'] as const,
  },

  agents: {
    all: ['agents'] as const,
    list: () => [...queryKeys.agents.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.agents.all, id] as const,
    runs: (id: string) => [...queryKeys.agents.all, id, 'runs'] as const,
  },

  business: {
    all: ['business'] as const,
    campaigns: () => [...queryKeys.business.all, 'campaigns'] as const,
    campaign: (id: string) => [...queryKeys.business.campaigns(), id] as const,
    appointments: () => [...queryKeys.business.all, 'appointments'] as const,
    reviews: () => [...queryKeys.business.all, 'reviews'] as const,
    forms: () => [...queryKeys.business.all, 'forms'] as const,
    analytics: () => [...queryKeys.business.all, 'analytics'] as const,
  },

  conversations: {
    all: ['conversations'] as const,
    list: () => [...queryKeys.conversations.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.conversations.all, id] as const,
    messages: (id: string) => [...queryKeys.conversations.all, id, 'messages'] as const,
  },

  workflows: {
    all: ['workflows'] as const,
    list: () => [...queryKeys.workflows.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.workflows.all, id] as const,
    runs: (flowId: string) => [...queryKeys.workflows.all, flowId, 'runs'] as const,
    runDetail: (runId: string) => [...queryKeys.workflows.all, 'runs', runId] as const,
    nodes: () => [...queryKeys.workflows.all, 'nodes'] as const,
    connections: () => [...queryKeys.workflows.all, 'connections'] as const,
  },
};
