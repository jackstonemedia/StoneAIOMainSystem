import { useState } from 'react';
import type {
  DashboardLayout,
  DashboardGridItem,
  WidgetInstance,
  WidgetType,
} from '../types/dashboard';

// Bump this when changing the default dashboard layout so existing
// localStorage entries don't override the new structure.
const STORAGE_PREFIX = 'stone_dashboard_v2_';

const DEFAULT_SIZES: Record<WidgetType, { w: number; h: number }> = {
  metric: { w: 3, h: 1 },
  revenue_chart: { w: 8, h: 2 },
  activity_feed: { w: 4, h: 2 },
  pipeline_funnel: { w: 6, h: 2 },
  schedule: { w: 3, h: 2 },
  tasks: { w: 3, h: 2 },
  campaign_health: { w: 4, h: 2 },
  conversion: { w: 4, h: 2 },
  quick_actions: { w: 4, h: 1 },
  leaderboard: { w: 4, h: 2 },
};

// Three-band default layout:
//  - Row 1: four metric cards (top stats)
//  - Row 2: revenue chart (left) + schedule (right)
//  - Row 3: full-width tasks table
const DEFAULT_LAYOUT: DashboardLayout = {
  widgets: [
    { id: 'metric_revenue', type: 'metric', config: { metricKey: 'revenue', showSparkline: true } },
    { id: 'metric_pipeline', type: 'metric', config: { metricKey: 'pipeline', showSparkline: true } },
    { id: 'metric_contacts', type: 'metric', config: { metricKey: 'contacts', showSparkline: true } },
    { id: 'metric_conversion', type: 'metric', config: { metricKey: 'conversion', showSparkline: true } },
    { id: 'revenue_chart', type: 'revenue_chart', config: {} },
    { id: 'schedule', type: 'schedule', config: {} },
    { id: 'tasks', type: 'tasks', config: {} },
  ],
  gridLayout: [
    // Top stats row
    { i: 'metric_revenue',   x: 0,  y: 0, w: 3, h: 1 },
    { i: 'metric_pipeline',  x: 3,  y: 0, w: 3, h: 1 },
    { i: 'metric_contacts',  x: 6,  y: 0, w: 3, h: 1 },
    { i: 'metric_conversion',x: 9,  y: 0, w: 3, h: 1 },

    // Middle band: chart + calendar/schedule
    { i: 'revenue_chart',    x: 0,  y: 1, w: 8, h: 2 },
    { i: 'schedule',         x: 8,  y: 1, w: 4, h: 2 },

    // Bottom band: full-width tasks table
    { i: 'tasks',            x: 0,  y: 3, w: 12, h: 3 },
  ],
};

function loadLayout(_storageKey: string): DashboardLayout {
  // For now, always start from the canonical DEFAULT_LAYOUT so everyone
  // sees the same structured dashboard (top stats row, chart+side panel,
  // full-width table) without needing to clear localStorage.
  return DEFAULT_LAYOUT;
}

function persistLayout(storageKey: string, layout: DashboardLayout) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(layout));
  } catch {
  }
}

function createId(type: WidgetType) {
  return `${type}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useDashboardLayout(workspaceId: string) {
  const key = `${STORAGE_PREFIX}${workspaceId || 'default'}`;
  const [layout, setLayout] = useState<DashboardLayout>(() => loadLayout(key));
  const [isEditing, setIsEditing] = useState(false);

  const setAndPersist = (updater: (prev: DashboardLayout) => DashboardLayout) => {
    setLayout((prev) => {
      const next = updater(prev);
      persistLayout(key, next);
      return next;
    });
  };

  const saveLayout = (grid: DashboardGridItem[]) => {
    setAndPersist((prev) => ({ ...prev, gridLayout: grid }));
  };

  const addWidget = (type: WidgetType, config?: Record<string, unknown>) => {
    setAndPersist((prev) => {
      const exists = prev.widgets.some((w) => w.type === type);
      if (exists) return prev;
      const id = createId(type);
      const size = DEFAULT_SIZES[type] ?? { w: 4, h: 2 };
      const maxY = prev.gridLayout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
      const widget: WidgetInstance = { id, type, config: config ?? {} };
      const gridItem: DashboardGridItem = { i: id, x: 0, y: maxY, w: size.w, h: size.h };
      return {
        widgets: [...prev.widgets, widget],
        gridLayout: [...prev.gridLayout, gridItem],
      };
    });
  };

  const removeWidget = (id: string) => {
    setAndPersist((prev) => ({
      widgets: prev.widgets.filter((w) => w.id !== id),
      gridLayout: prev.gridLayout.filter((g) => g.i !== id),
    }));
  };

  const resetToDefault = () => {
    setAndPersist(() => DEFAULT_LAYOUT);
  };

  return {
    layout,
    saveLayout,
    addWidget,
    removeWidget,
    resetToDefault,
    isEditing,
    setIsEditing,
  };
}
