'use client';

import { useState } from 'react';
import Link from 'next/link';

interface CanvasMenuProps {
  onAddNode?: (type: 'sqlCell' | 'textCell' | 'chartCell') => void;
  onFileUpload?: (file: File) => void;
}

export default function CanvasMenu({ onAddNode, onFileUpload }: CanvasMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
    event.target.value = '';
  };

  return (
    <div className="absolute top-4 left-4 z-50 flex gap-2">
      {/* Logo / Home */}
      <Link 
        href="/"
        className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 flex items-center gap-2 hover:bg-zinc-800 transition-colors"
      >
        {/* <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg> */}
        <span className="text-sm font-semibold text-indigo-500">Quarry</span>
      </Link>

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
