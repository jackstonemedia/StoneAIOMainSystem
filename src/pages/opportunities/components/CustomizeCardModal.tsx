import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LayoutGrid, X, Check, Eye } from 'lucide-react';
import type { CardConfig, CustomField } from '../../../types/opportunities';

interface CustomizeCardModalProps {
  isOpen: boolean;
  config: CardConfig;
  customFields: CustomField[];
  onClose: () => void;
  onSave: (newConfig: CardConfig) => void;
}

export function CustomizeCardModal({
  isOpen,
  config,
  customFields,
  onClose,
  onSave,
}: CustomizeCardModalProps) {
  const [localConfig, setLocalConfig] = useState<CardConfig>({ ...config });

  if (!isOpen) return null;

  const handleToggleCustomField = (fieldId: string) => {
    const list = localConfig.visibleCustomFieldIds || [];
    if (list.includes(fieldId)) {
      setLocalConfig(prev => ({
        ...prev,
        visibleCustomFieldIds: list.filter(id => id !== fieldId),
      }));
    } else {
      setLocalConfig(prev => ({
        ...prev,
        visibleCustomFieldIds: [...list, fieldId],
      }));
    }
  };

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-hover/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-text-main">Customize Kanban Cards</h2>
              <p className="text-[12px] text-text-muted">Choose which fields appear on board cards</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          <div className="space-y-3">
            <h3 className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Core Card Elements</h3>
            
            <label className="flex items-center justify-between p-3 bg-surface-hover/40 border border-border rounded-xl cursor-pointer hover:border-primary/40">
              <span className="text-[13px] font-medium text-text-main">Opportunity Value ($)</span>
              <input
                type="checkbox"
                checked={localConfig.showValue}
                onChange={e => setLocalConfig(prev => ({ ...prev, showValue: e.target.checked }))}
                className="w-4 h-4 rounded text-primary focus:ring-primary"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-surface-hover/40 border border-border rounded-xl cursor-pointer hover:border-primary/40">
              <span className="text-[13px] font-medium text-text-main">Linked Contact & Initials</span>
              <input
                type="checkbox"
                checked={localConfig.showContact}
                onChange={e => setLocalConfig(prev => ({ ...prev, showContact: e.target.checked }))}
                className="w-4 h-4 rounded text-primary focus:ring-primary"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-surface-hover/40 border border-border rounded-xl cursor-pointer hover:border-primary/40">
              <span className="text-[13px] font-medium text-text-main">Tag Pills</span>
              <input
                type="checkbox"
                checked={localConfig.showTags}
                onChange={e => setLocalConfig(prev => ({ ...prev, showTags: e.target.checked }))}
                className="w-4 h-4 rounded text-primary focus:ring-primary"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-surface-hover/40 border border-border rounded-xl cursor-pointer hover:border-primary/40">
              <span className="text-[13px] font-medium text-text-main">Owner Avatar</span>
              <input
                type="checkbox"
                checked={localConfig.showOwner}
                onChange={e => setLocalConfig(prev => ({ ...prev, showOwner: e.target.checked }))}
                className="w-4 h-4 rounded text-primary focus:ring-primary"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-surface-hover/40 border border-border rounded-xl cursor-pointer hover:border-primary/40">
              <span className="text-[13px] font-medium text-text-main">"Days in Stage" Age Badge</span>
              <input
                type="checkbox"
                checked={localConfig.showDaysInStage}
                onChange={e => setLocalConfig(prev => ({ ...prev, showDaysInStage: e.target.checked }))}
                className="w-4 h-4 rounded text-primary focus:ring-primary"
              />
            </label>
          </div>

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Custom Field Chips</h3>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-primary font-medium">
                  <input
                    type="checkbox"
                    checked={localConfig.showCustomFields}
                    onChange={e => setLocalConfig(prev => ({ ...prev, showCustomFields: e.target.checked }))}
                    className="w-3.5 h-3.5 rounded text-primary"
                  />
                  Enable Custom Chips
                </label>
              </div>

              {localConfig.showCustomFields && (
                <div className="space-y-2">
                  {customFields.map(cf => {
                    const isChecked = (localConfig.visibleCustomFieldIds || []).includes(cf.id);
                    return (
                      <label
                        key={cf.id}
                        className="flex items-center justify-between px-3 py-2 bg-surface-hover/30 border border-border rounded-lg cursor-pointer hover:border-primary/30"
                      >
                        <span className="text-[12px] text-text-main">{cf.label} <span className="text-text-muted text-[10px]">({cf.type})</span></span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleCustomField(cf.id)}
                          className="w-3.5 h-3.5 rounded text-primary"
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface-hover/30 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-[13px] font-semibold bg-primary hover:bg-primary-hover text-white flex items-center gap-2 shadow-sm transition-all"
          >
            <Check className="w-4 h-4" /> Save Configuration
          </button>
        </div>
      </motion.div>
    </div>
  );
}
