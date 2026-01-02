'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import Editor, { type OnMount } from '@monaco-editor/react';

interface SqlCellData {
  label: string;
  sql: string;
  results: unknown;
  isExecuting: boolean;
  onRun?: (sql: string) => Promise<void>;
  onTextChange?: (text: string) => void;
  error?: string;
  preview?: { columns: string[]; rows: unknown[][]; totalRows: number };
}

function SqlCell({ data, id, selected }: NodeProps) {
  const cellData = data as unknown as SqlCellData;
  const [sql, setSql] = useState(cellData.sql || '');
  
  // Use local results if available, otherwise show synced preview
  const results = cellData.results || (cellData.preview ? cellData.preview : null);
  const isPreviewOnly = !cellData.results && !!cellData.preview;
  const isExecuting = cellData.isExecuting;
  
  const [internalError, setInternalError] = useState<string | null>(null);
  const editorRef = useRef<unknown>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync incoming SQL changes from collaborators
  useEffect(() => {
    if (cellData.sql !== undefined && cellData.sql !== sql) {
      setSql(cellData.sql);
    }
  }, [cellData.sql]);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const handleRun = useCallback(async () => {
    setInternalError(null);
    if (cellData.onRun) {
      try {
        await cellData.onRun(sql);
      } catch (e) {
        setInternalError('Execution failed check console');
      }
    } else {
        setInternalError('No execution environment attached');
    }
  }, [cellData, sql]);

  const displayError = cellData.error || internalError;

  return (
    <div
      className={`
        min-w-[400px] max-w-[600px]
        bg-zinc-900 rounded-xl border-2 shadow-2xl
        transition-all duration-200
        ${selected ? 'border-indigo-500 shadow-indigo-500/20' : 'border-zinc-700'}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/50 rounded-t-xl border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-indigo-500" />
          <span className="text-sm font-medium text-zinc-300">{cellData.label}</span>
          <span className="text-xs text-zinc-600 font-mono ml-2">ID: {id}</span>
        </div>
        <button
          onClick={handleRun}
          disabled={isExecuting}
          className={`
            px-3 py-1 text-xs font-medium rounded-md
            transition-all duration-200
            ${isExecuting 
              ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' 
              : 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95'
            }
          `}
        >
          {isExecuting ? (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Running...
            </span>
          ) : (
            '▶ Run'
          )}
        </button>
      </div>

      {/* SQL Editor - nodrag/nowheel prevents node movement when interacting with editor */}
      <div className="border-b border-zinc-700 overflow-hidden nodrag nowheel">
        <Editor
          height="120px"
          language="sql"
          theme="vs-dark"
          value={sql}
          onChange={(value) => {
            setSql(value || '');
            // Debounced sync to collaborators
            if (cellData.onTextChange) {
              if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
              syncTimeoutRef.current = setTimeout(() => {
                cellData.onTextChange!(value || '');
              }, 300);
            }
          }}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'off',
            folding: false,
            scrollbar: { vertical: 'hidden', horizontal: 'auto' },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            padding: { top: 12, bottom: 12 },
            wordWrap: 'on',
            automaticLayout: true,
          }}
        />
      </div>

      {/* Results */}
      {(results || displayError) && (
        <div className="p-3 max-h-[200px] overflow-auto">
          {displayError ? (
            <div className="text-red-400 text-sm font-mono">{displayError}</div>
          ) : results ? (
            <>
              {isPreviewOnly && (
                <div className="text-xs text-amber-500 mb-2 flex items-center gap-1">
                  <span>Preview:</span>
                  {cellData.preview?.totalRows && (
                    <span className="text-zinc-500">{cellData.preview.totalRows} rows total - run locally for full data</span>
                  )}
                </div>
              )}
              <ResultsTable results={results as { columns: string[]; rows: unknown[][] }} />
            </>
          ) : null}
        </div>
      )}

      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-zinc-900"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-zinc-900"
      />
    </div>
  );
}

function ResultsTable({ results }: { results: { columns: string[]; rows: unknown[][] } }) {
  if (!results.rows.length) {
    return <div className="text-zinc-500 text-sm">No results</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-700">
            {results.columns.map((col, i) => (
              <th key={i} className="text-left px-2 py-1 text-zinc-400 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-zinc-800 last:border-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-2 py-1 text-zinc-300 font-mono">
                  {String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default memo(SqlCell);
