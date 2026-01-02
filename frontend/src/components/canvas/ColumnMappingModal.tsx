'use client';

import { useState } from 'react';

interface ColumnMappingModalProps {
  columns: string[];
  chartType: 'bar' | 'line' | 'pie' | 'bigNumber';
  onSave: (mapping: { xColumn: string; yColumn: string }) => void;
  onClose: () => void;
}

export default function ColumnMappingModal({ columns, chartType, onSave, onClose }: ColumnMappingModalProps) {
  const [xColumn, setXColumn] = useState(columns[0] || '');
  const [yColumn, setYColumn] = useState(columns[1] || columns[0] || '');

  const handleSave = () => {
    if (xColumn && yColumn) {
      onSave({ xColumn, yColumn });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-[400px] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-zinc-800/50 border-b border-zinc-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="font-semibold text-white">Configure Chart</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">×</button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-zinc-400">
            Select which columns to use for the <span className="text-violet-400 font-medium">{chartType}</span> chart.
          </p>

          {/* X Axis */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              X-Axis (Categories)
            </label>
            <select
              value={xColumn}
              onChange={e => setXColumn(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white focus:outline-none focus:border-violet-500"
            >
              {columns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>

          {/* Y Axis */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Y-Axis (Values)
            </label>
            <select
              value={yColumn}
              onChange={e => setYColumn(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white focus:outline-none focus:border-violet-500"
            >
              {columns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 mt-1">Numeric column recommended</p>
          </div>

          {/* Preview */}
          <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
            <div className="text-xs text-zinc-500 mb-1">Preview mapping:</div>
            <div className="text-sm text-zinc-300 font-mono">
              <span className="text-violet-400">{xColumn}</span> → X<br/>
              <span className="text-emerald-400">{yColumn}</span> → Y
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-zinc-800/30 border-t border-zinc-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!xColumn || !yColumn}
            className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 text-white rounded-md transition-colors disabled:opacity-50"
          >
            Apply & Plot
          </button>
        </div>
      </div>
    </div>
  );
}
