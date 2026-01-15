'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCanvas, CanvasListItem } from '@/lib/canvas/store';

interface CanvasMenuProps {
  onAddNode?: (type: 'sqlCell' | 'textCell' | 'chartCell') => void;
  onFileUpload?: (file: File) => void;
  onLoadCanvas?: (canvasData: { nodes: any[]; edges: any[] }) => void;
  activeConnectionId?: string;
}

export default function CanvasMenu({ onAddNode, onFileUpload, onLoadCanvas, activeConnectionId }: CanvasMenuProps) {
  const {
    canvases,
    currentCanvasId,
    currentCanvasName,
    loadCanvas,
    createCanvas,
    deleteCanvas,
    renameCanvas,
  } = useCanvas();

  const [isOpen, setIsOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
    event.target.value = '';
  };

  const handleCanvasSelect = async (canvas: CanvasListItem) => {
    try {
      const data = await loadCanvas(canvas.id);
      onLoadCanvas?.(data);
      setIsCanvasOpen(false);
    } catch (err) {
      console.error('Failed to load canvas:', err);
    }
  };

  const handleNewCanvas = async () => {
    try {
      await createCanvas('Untitled Canvas', activeConnectionId);
      onLoadCanvas?.({ nodes: [], edges: [] });
      setIsCanvasOpen(false);
    } catch (err) {
      console.error('Failed to create canvas:', err);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this canvas?')) {
      await deleteCanvas(id);
    }
  };

  const handleRename = () => {
    if (newName.trim()) {
      renameCanvas(newName.trim());
    }
    setIsRenaming(false);
    setNewName('');
  };

  return (
    <div className="absolute top-4 left-4 z-50 flex gap-2">
      {/* Logo / Home */}
      <Link
        href="/"
        className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 flex items-center gap-2 hover:bg-zinc-800 transition-colors"
      >
        <span className="text-sm font-semibold text-indigo-500">Quarry</span>
      </Link>

      {/* Canvas Selector */}
      <div className="relative">
        {isRenaming ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 flex items-center gap-1">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              onBlur={handleRename}
              placeholder={currentCanvasName}
              className="bg-transparent text-sm text-white w-32 focus:outline-none"
              autoFocus
            />
          </div>
        ) : (
          <button
            onClick={() => setIsCanvasOpen(!isCanvasOpen)}
            className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-white hover:bg-zinc-800 transition-colors flex items-center gap-2 max-w-[200px]"
          >
            <svg className="w-4 h-4 text-zinc-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            <span className="truncate">{currentCanvasName}</span>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {isCanvasOpen && (
          <div className="absolute top-full left-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-md shadow-xl min-w-[220px] py-1 max-h-[300px] overflow-y-auto">
            {/* Current canvas actions */}
            <div className="px-3 py-2 border-b border-zinc-800">
              <button
                onClick={() => { setIsRenaming(true); setNewName(currentCanvasName); setIsCanvasOpen(false); }}
                className="text-xs text-zinc-400 hover:text-white transition-colors"
              >
                Rename
              </button>
            </div>

            {/* Canvas list */}
            {canvases.map((canvas) => (
              <button
                key={canvas.id}
                onClick={() => handleCanvasSelect(canvas)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-800 flex items-center justify-between group ${
                  canvas.id === currentCanvasId ? 'text-indigo-400' : 'text-white'
                }`}
              >
                <span className="truncate">{canvas.name}</span>
                {canvas.id !== currentCanvasId && (
                  <button
                    onClick={(e) => handleDelete(canvas.id, e)}
                    className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </button>
            ))}

            {/* New canvas */}
            <div className="border-t border-zinc-800 mt-1 pt-1">
              <button
                onClick={handleNewCanvas}
                className="w-full px-3 py-2 text-left text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Canvas
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Node Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsAddOpen(!isAddOpen)}
          className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-white hover:bg-zinc-800 transition-colors flex items-center gap-1"
        >
          <span>+ Add</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isAddOpen && (
          <div className="absolute top-full left-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-md shadow-xl min-w-[160px] py-1">
            <button
              onClick={() => { onAddNode?.('sqlCell'); setIsAddOpen(false); }}
              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-zinc-800 flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              SQL Cell
            </button>
            <button
              onClick={() => { onAddNode?.('textCell'); setIsAddOpen(false); }}
              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-zinc-800 flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Text Cell
            </button>
            <button
              onClick={() => { onAddNode?.('chartCell'); setIsAddOpen(false); }}
              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-zinc-800 flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Chart Cell
            </button>
            <div className="border-t border-zinc-800 my-1" />
            <label className="w-full px-3 py-2 text-left text-sm text-white hover:bg-zinc-800 flex items-center gap-2 cursor-pointer">
              <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload File
              <input
                type="file"
                accept=".csv,.parquet,.json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      {/* Menu Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-zinc-900 border border-zinc-800 rounded-md p-1.5 text-white hover:bg-zinc-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-md shadow-xl min-w-[180px] py-1">
            <Link
              href="/settings"
              className="block px-3 py-2 text-sm text-white hover:bg-zinc-800 flex items-center gap-2"
              onClick={() => setIsOpen(false)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>
            <Link
              href="/connections"
              className="block px-3 py-2 text-sm text-white hover:bg-zinc-800 flex items-center gap-2"
              onClick={() => setIsOpen(false)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
              Connections
            </Link>
            <Link
              href="/model"
              className="block px-3 py-2 text-sm text-white hover:bg-zinc-800 flex items-center gap-2"
              onClick={() => setIsOpen(false)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Data Model
            </Link>
            <div className="border-t border-zinc-800 my-1" />
            <a
              href="https://github.com/your-repo/quarry"
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
              onClick={() => setIsOpen(false)}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              GitHub
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
