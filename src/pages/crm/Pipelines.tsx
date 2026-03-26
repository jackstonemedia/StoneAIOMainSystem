import { Plus, Settings2, GripVertical, MoreHorizontal } from 'lucide-react';
import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface Stage {
  id: string;
  name: string;
  probability?: number;
  color?: string;
  order: number;
}

interface Pipeline {
  id: string;
  name: string;
  stages: Stage[];
}

export default function Pipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/crm/pipelines')
      .then(res => res.json())
      .then(data => {
        setPipelines(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch pipelines:', err);
        setLoading(false);
      });
  }, []);

  const onDragEnd = (result: DropResult, pipelineId: string) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    setPipelines(prev => {
      const newPipelines = prev.map(pipeline => {
        if (pipeline.id === pipelineId) {
          const newStages = [...pipeline.stages];
          const [reorderedItem] = newStages.splice(sourceIndex, 1);
          newStages.splice(destinationIndex, 0, reorderedItem);
          
          // Update order property
          newStages.forEach((stage, idx) => {
            stage.order = idx;
          });

          const updatedPipeline = { ...pipeline, stages: newStages };
          
          // Update backend
          fetch(`/api/crm/pipelines/${pipeline.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedPipeline)
          }).catch(err => console.error('Failed to update pipeline:', err));

          return updatedPipeline;
        }
        return pipeline;
      });
      return newPipelines;
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-6 border-b border-border bg-surface shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipelines</h1>
          <p className="text-sm text-text-muted mt-1">Configure your sales stages and probabilities.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          New Pipeline
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {loading ? (
            <div className="text-center text-text-muted">Loading pipelines...</div>
          ) : (
            pipelines.map(pipeline => (
              <div key={pipeline.id} className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-border bg-bg">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold">{pipeline.name}</h2>
                    <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">Default</span>
                  </div>
                  <button className="p-2 text-text-muted hover:text-text-main rounded-lg hover:bg-surface-hover transition-colors">
                    <Settings2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="p-6">
                  <h3 className="text-sm font-medium text-text-muted mb-4 uppercase tracking-wider">Stages</h3>
                  <DragDropContext onDragEnd={(result) => onDragEnd(result, pipeline.id)}>
                    <Droppable droppableId={`pipeline-${pipeline.id}`}>
                      {(provided) => (
                        <div 
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className="space-y-3"
                        >
                          {pipeline.stages.map((stage, index) => (
                            <Draggable key={stage.id} draggableId={stage.id} index={index}>
                              {(provided, snapshot) => (
                                <div 
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`flex items-center gap-4 bg-bg border border-border rounded-lg p-4 group transition-colors ${
                                    snapshot.isDragging ? 'shadow-md border-primary/50 z-50' : ''
                                  }`}
                                  style={provided.draggableProps.style}
                                >
                                  <div 
                                    {...provided.dragHandleProps}
                                    className="cursor-grab active:cursor-grabbing text-text-muted hover:text-text-main"
                                  >
                                    <GripVertical className="w-5 h-5" />
                                  </div>
                                  <div className={`w-3 h-3 rounded-full ${stage.color || 'bg-slate-400'}`} />
                                  <div className="flex-1 font-medium">{stage.name}</div>
                                  <div className="w-32 text-sm text-text-muted">
                                    {stage.probability || 0}% Probability
                                  </div>
                                  <button className="p-1 text-text-muted hover:text-text-main opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                  
                  <button className="mt-4 flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                    <Plus className="w-4 h-4" />
                    Add Stage
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
