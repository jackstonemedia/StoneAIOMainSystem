import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { Layout } from 'react-grid-layout/legacy';
import type { DashboardLayout } from '../../types/dashboard';
import type { DateRange } from '../../types/dashboard';
import type { BusinessMetrics } from '../../hooks/useDashboardMetrics';
import { WidgetRegistry } from './WidgetRegistry';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardGridProps {
  layout: DashboardLayout;
  metrics?: BusinessMetrics;
  isMetricsLoading: boolean;
  dateRange: DateRange;
  isEditing: boolean;
  onLayoutChange: (next: Layout[]) => void;
  onRemoveWidget: (id: string) => void;
}

export function DashboardGrid({
  layout,
  metrics,
  isMetricsLoading,
  dateRange,
  isEditing,
  onLayoutChange,
  onRemoveWidget,
}: DashboardGridProps) {
  const layouts = { lg: layout.gridLayout as Layout[] };

  if (!layout.widgets.length) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-border/60 bg-surface/40 px-6 py-10 text-center text-sm text-text-muted">
        No widgets added yet. Use <span className="font-semibold text-text-main">Add Widget</span> to start building your dashboard.
      </div>
    );
  }

  return (
    <div className="pt-6">
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        rowHeight={160}
        cols={{ lg: 12, md: 8, sm: 6, xs: 1 }}
        breakpoints={{ lg: 1280, md: 1024, sm: 768, xs: 480 }}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        isDraggable={isEditing}
        isResizable={isEditing}
        draggableHandle=".widget-drag-handle"
        onLayoutChange={(currentLayout: Layout[]) => {
          onLayoutChange(currentLayout);
        }}
        compactType="vertical"
      >
        {layout.widgets.map((widget) => (
          <div key={widget.id} data-grid={layout.gridLayout.find((g) => g.i === widget.id) as Layout | undefined}>
            <WidgetRegistry
              instance={widget}
              metrics={metrics}
              isMetricsLoading={isMetricsLoading}
              dateRange={dateRange}
              isEditing={isEditing}
              onRemove={() => onRemoveWidget(widget.id)}
            />
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
