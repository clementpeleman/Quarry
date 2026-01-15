'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer, type NodeProps, useReactFlow } from '@xyflow/react';
import Editor, { type OnMount, type Monaco } from '@monaco-editor/react';
import { duckDB } from '@/lib/query/DuckDBEngine';
import { executeCubeQuery, sqlToCubeQuery } from '@/lib/cube/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Global flag to prevent multiple completion provider registrations
let sqlCompletionProviderRegistered = false;

// Global schema cache shared across all SqlCell instances
const globalSchemaCache: { tables: string[]; columns: { name: string; type: string; table: string }[] } = {
  tables: [],
  columns: [],
};

interface SqlCellData {
  label: string;
  sql: string;
  results: unknown;
  isExecuting: boolean;
  onRun?: (sql: string) => Promise<void>;
  onTextChange?: (text: string) => void;
  onSqlChange?: (sql: string) => void; // Sync SQL changes back to parent for persistence
  error?: string;
  preview?: { columns: string[]; rows: unknown[][]; totalRows: number };
  width?: number;
  height?: number;
  // New: data source info for autocomplete
  useDuckDB?: boolean;
  connectionId?: string;
  lastExecutionDuration?: number;
}

const MAX_FIT_ROWS = 15; // Hard limit for auto-fit
const ROW_HEIGHT = 28; // Approximate height per row in pixels
const HEADER_HEIGHT = 45; // Header section
const EDITOR_HEIGHT = 120; // SQL editor height
const PADDING_HEIGHT = 60; // Extra padding for borders, preview text, etc.
const MIN_WIDTH = 350;
const MAX_WIDTH = 1400; // Increased hard limit for auto-fit as requested
const COLUMN_WIDTH = 150; // Increased approximate width per column
const PADDING_WIDTH = 40; // Horizontal padding

function SqlCell({ data, id, selected }: NodeProps) {
  const cellData = data as unknown as SqlCellData;
  const [sql, setSql] = useState(cellData.sql || '');
  const [useCube, setUseCube] = useState(false);
  const [hasRun, setHasRun] = useState(false); // Track if query has been executed
  const { setNodes } = useReactFlow();

  // Use local results if available, otherwise show synced preview
  const results = cellData.results || (cellData.preview ? cellData.preview : null);
  const isPreviewOnly = !cellData.results && !!cellData.preview;
  const isExecuting = cellData.isExecuting;

  const [internalError, setInternalError] = useState<string | null>(null);
  const editorRef = useRef<unknown>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sqlChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Set hasRun to true if we have results (e.g., from previous session)
  useEffect(() => {
    if (results && (results as { rows?: unknown[] }).rows?.length) {
      setHasRun(true);
    }
  }, [results]);


  // Sync incoming SQL changes from parent (canvas load or collaborators)
  useEffect(() => {
    // Always sync if cellData.sql has a value and is different from local state
    const parentSql = cellData.sql ?? '';
    // console.log('[SqlCell] Sync check:', { id, parentSql, localSql: sql, cellDataSql: cellData.sql });
    if (parentSql !== sql) {
      // console.log('[SqlCell] Syncing SQL:', parentSql);
      setSql(parentSql);
    }
  }, [cellData.sql]); // Only depend on cellData.sql, not local sql state

  // Debug initial mount
  useEffect(() => {
    // console.log('[SqlCell] Mount:', { id, cellData });
  }, []);

  // console.log(`[SqlCell] Render ${id}:`, { sqlLength: sql.length, sqlPreview: sql.slice(0, 50) });

  // Fetch schema for autocomplete based on data source (updates global cache)
  const fetchSchemaForAutocomplete = useCallback(async () => {
    try {
      if (cellData.useDuckDB !== false) {
        // DuckDB mode
        await duckDB.init();
        const tables = await duckDB.query(`
          SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'
        `);
        const columns = await duckDB.query(`
          SELECT column_name, data_type, table_name FROM information_schema.columns
        `);
        globalSchemaCache.tables = tables.rows.map(r => r[0] as string);
        globalSchemaCache.columns = columns.rows.map(r => ({
          name: r[0] as string,
          type: r[1] as string,
          table: r[2] as string,
        }));
      } else if (cellData.connectionId) {
        // PostgreSQL mode
        const res = await fetch(`${API_URL}/api/connections/${cellData.connectionId}/introspect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          globalSchemaCache.tables = [];
          globalSchemaCache.columns = [];

          (data.tables || []).forEach((t: any) => {
            globalSchemaCache.tables.push(t.name);
            (t.columns || []).forEach((c: any) => {
              globalSchemaCache.columns.push({ name: c.name, type: c.type, table: t.name });
            });
          });
        }
      }
    } catch (e) {
      console.error('Failed to fetch schema for autocomplete:', e);
    }
  }, [cellData.useDuckDB, cellData.connectionId]);

  // Refresh schema when data source changes
  useEffect(() => {
    fetchSchemaForAutocomplete();
  }, [fetchSchemaForAutocomplete]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Fetch initial schema
    fetchSchemaForAutocomplete();

    // Only register completion provider once globally
    if (!sqlCompletionProviderRegistered) {
      sqlCompletionProviderRegistered = true;

      monaco.languages.registerCompletionItemProvider('sql', {
        triggerCharacters: ['.'],
        provideCompletionItems: (model: any, position: any) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          // Check if user typed "table." to suggest columns for that table
          const lineContent = model.getLineContent(position.lineNumber);
          const textBeforeCursor = lineContent.substring(0, position.column - 1);
          const tableMatch = textBeforeCursor.match(/(\w+)\.$/);

          const suggestions: any[] = [];

          if (tableMatch) {
            // User typed "table." - suggest columns for that specific table
            const tableName = tableMatch[1].toLowerCase();
            globalSchemaCache.columns
              .filter(c => c.table.toLowerCase() === tableName)
              .forEach(col => {
                suggestions.push({
                  label: col.name,
                  kind: monaco.languages.CompletionItemKind.Field,
                  insertText: col.name,
                  detail: `${col.type} (${col.table})`,
                  range,
                });
              });
          } else {
            // General suggestions: tables, all columns, keywords

            // Tables
            globalSchemaCache.tables.forEach(table => {
              suggestions.push({
                label: table,
                kind: monaco.languages.CompletionItemKind.Class,
                insertText: table,
                detail: 'Table',
                range,
              });
            });

            // Columns (deduplicated)
            const addedColumns = new Set<string>();
            globalSchemaCache.columns.forEach(col => {
              if (!addedColumns.has(col.name)) {
                addedColumns.add(col.name);
                suggestions.push({
                  label: col.name,
                  kind: monaco.languages.CompletionItemKind.Field,
                  insertText: col.name,
                  detail: col.type,
                  range,
                });
              }
            });

            // SQL keywords (lowercase only - Monaco handles case-insensitive matching)
            const keywords = ['select', 'from', 'where', 'join', 'left', 'right', 'inner', 'outer',
              'on', 'and', 'or', 'not', 'in', 'like', 'order', 'by', 'group', 'having', 'limit',
              'offset', 'as', 'distinct', 'count', 'sum', 'avg', 'max', 'min', 'case', 'when',
              'then', 'else', 'end', 'null', 'is', 'true', 'false', 'insert', 'update', 'delete',
              'create', 'table', 'drop', 'alter', 'index', 'union', 'all', 'exists', 'between',
              'coalesce', 'cast', 'extract', 'date', 'timestamp', 'interval', 'current_date',
              'current_timestamp', 'now', 'trim', 'upper', 'lower', 'length', 'substring',
              'concat', 'replace', 'round', 'floor', 'ceil', 'abs', 'power', 'sqrt', 'asc', 'desc'];

            keywords.forEach(kw => {
              suggestions.push({
                label: kw,
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: kw,
                range,
              });
            });
          }

          return { suggestions };
        },
      });
    }
  };

  const handleRun = useCallback(async () => {
    setInternalError(null);
    setHasRun(true); // Mark as run to show results section
    if (useCube) {
      try {
        const cubeQuery = sqlToCubeQuery(sql);
        if (!cubeQuery) {
          setInternalError('Could not convert SQL to Cube query');
          return;
        }
        const result = await executeCubeQuery(cubeQuery);
        console.log('Cube result:', result);
        setInternalError('Cube execution successful (check console)');
      } catch (e) {
        setInternalError(`Cube error: ${(e as Error).message}`);
      }
    } else if (cellData.onRun) {
      try {
        await cellData.onRun(sql);
      } catch (e) {
        setInternalError('Execution failed check console');
      }
    } else {
      setInternalError('No execution environment attached');
    }
  }, [cellData, sql, useCube]);

  const fitToContent = useCallback(() => {
    if (!results) return;
    const r = results as { columns?: string[] };
    if (!r.columns?.length) return;

    const colCount = r.columns.length;
    // Calculate required width: padding + (cols * avg_width) + extra for row numbers/margins
    const requiredWidth = Math.min(
      Math.max(MIN_WIDTH, PADDING_WIDTH + 60 + (colCount * COLUMN_WIDTH)), 
      MAX_WIDTH
    );

    setNodes((nodes) => 
      nodes.map((node) => {
        if (node.id === id) {
          // Preserve current height, only update width
          const currentHeight = node.measured?.height || node.style?.height || node.height;
          return {
            ...node,
            style: {
              ...node.style,
              width: requiredWidth,
              height: currentHeight, // Ensure height stays stable (though style.height might be string)
            },
            width: requiredWidth, // Update width prop as well for some runners
          };
        }
        return node;
      })
    );
  }, [results, id, setNodes]);

  // Auto-run if query was fast (< 1s) and we have no results (MOVED HERE)
  const autoRunRef = useRef(false);
  useEffect(() => {
    if (autoRunRef.current) return;
    
    if (
      !hasRun && 
      !results && 
      !isExecuting && 
      cellData.lastExecutionDuration !== undefined && 
      cellData.lastExecutionDuration < 1000 &&
      cellData.sql
    ) {
      console.log('[SqlCell] Auto-running fast query:', cellData.lastExecutionDuration, 'ms');
      autoRunRef.current = true;
      handleRun();
    }
  }, [hasRun, results, isExecuting, cellData.lastExecutionDuration, cellData.sql, handleRun]);

  const displayError = cellData.error || internalError;

  const [editorHeight, setEditorHeight] = useState(150);
  const [isResizingEditor, setIsResizingEditor] = useState(false);

  // Handle resize of editor pane
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingEditor(true);
    
    const startY = e.clientY;
    const startHeight = editorHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newHeight = startHeight + (moveEvent.clientY - startY);
      // Min height 50px, max height constrained by node height (approx)
      setEditorHeight(Math.max(50, newHeight));
    };

    const onMouseUp = () => {
      setIsResizingEditor(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [editorHeight]);

  return (
    <>
      <NodeResizer
        minWidth={350}
        minHeight={170}
        isVisible={selected}
        lineClassName="!border-indigo-500"
        handleClassName="!w-2 !h-2 !bg-indigo-500 !border-0"
      />
      
      {/* Outer wrapper: Full size, relative, with extended hover zone via pseudo-element */}
      <div className="group relative w-full h-full before:absolute before:-inset-4 before:-z-10 before:content-['']">
        
        {/* Visual Node: Full size, contains border/bg/shadow/content */}
        <div
          className={`
            w-full h-full min-w-[350px] min-h-[170px] relative
            bg-zinc-900 rounded-xl border-2 shadow-2xl
            transition-colors duration-200 flex flex-col overflow-hidden
            ${selected ? 'border-indigo-500 shadow-indigo-500/20' : 'border-zinc-700'}
          `}
        >
          {/* Header - fixed height */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-zinc-800/50 rounded-t-xl border-b border-zinc-700">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-500" />
              <span className="text-sm font-medium text-zinc-300">{cellData.label}</span>
              {/* <span className="text-xs text-zinc-600 font-mono ml-2">ID: {id}</span> */}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-zinc-800 rounded-md p-0.5 border border-zinc-700">
                <button onClick={() => setUseCube(false)} className={`px-2 py-1 text-xs rounded ${!useCube ? 'bg-zinc-700 text-white' : 'text-zinc-400'}`} title="Local DuckDB">🖥️</button>
                <button onClick={() => setUseCube(true)} className={`px-2 py-1 text-xs rounded ${useCube ? 'bg-indigo-600 text-white' : 'text-zinc-400'}`} title="Cube.js">☁️</button>
              </div>
              {hasRun && results && (results as { rows?: unknown[] }).rows?.length ? (
                <>
                  <span className="text-xs text-zinc-500">{(results as { rows: unknown[] }).rows.length} rows</span>
                   <button
                    onClick={fitToContent}
                    className="px-2 py-1 text-xs font-medium rounded-md text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                    title="Fit to content"
                  >
                    ⤢
                  </button>
                </>
              ) : null}
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
          </div>

          {/* Editor area */}
          {/* If results present: Fixed height (resizable), otherwise flex-1 */}
          <div 
            className={`min-h-0 relative group/editor bg-zinc-900 ${
              hasRun ? 'flex-shrink-0' : 'flex-1'
            }`}
            style={hasRun ? { height: editorHeight } : undefined}
            onWheelCapture={(e) => e.stopPropagation()}
          >
            <Editor
              height="100%"
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
                // Debounced sync SQL changes back to parent node for persistence
                if (cellData.onSqlChange) {
                  if (sqlChangeTimeoutRef.current) clearTimeout(sqlChangeTimeoutRef.current);
                  sqlChangeTimeoutRef.current = setTimeout(() => {
                    cellData.onSqlChange!(value || '');
                  }, 500); // Slight delay to batch rapid typing
                }
              }}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'off',
                folding: false,
                scrollbar: { vertical: 'auto', horizontal: 'auto' },
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                padding: { top: 12, bottom: 12 },
                wordWrap: 'on',
                automaticLayout: true,
              }}
            />
          </div>

          {/* Resizer Handle (only visible when run) */}
          {hasRun && (
            <div
              className={`
                h-1.5 w-full cursor-ns-resize bg-zinc-800 hover:bg-indigo-500
                transition-colors flex items-center justify-center nodrag
                ${isResizingEditor ? 'bg-indigo-500' : ''}
              `}
              onMouseDown={startResize}
            >
              {/* Optional: Grip handle icon */}
              <div className="w-8 h-0.5 bg-zinc-600 rounded-full" />
            </div>
          )}

          {/* Results table - flex-1 takes remaining space */}
          {hasRun && (
            <div className="flex-1 min-h-[50px] border-t border-zinc-700 bg-zinc-900/50 flex flex-col overflow-hidden nodrag cursor-text select-text">
               {displayError ? (
                <div className="p-2 text-red-400 text-xs font-mono overflow-auto">{displayError}</div>
               ) : results && (results as { rows?: unknown[] }).rows?.length ? (
                 <>
                   {isPreviewOnly && (
                    <div className="px-2 py-1 text-xs text-amber-500 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
                      <span>Preview Mode</span>
                      {cellData.preview?.totalRows && (
                        <span>{cellData.preview.totalRows} rows total</span>
                      )}
                    </div>
                   )}
                   <ResultsTable results={results as { columns: string[]; rows: unknown[][] }} />
                 </>
               ) : isExecuting ? (
                <div className="p-4 flex items-center justify-center h-full">
                  <div className="text-zinc-500 text-sm">Loading...</div>
                </div>
               ) : (
                 <div className="p-4 flex items-center justify-center h-full">
                   <div className="text-zinc-500 text-sm">No results</div>
                 </div>
               )}
            </div>
          )}
        </div>


        {/* Connection handles - positioned outside via negative margins/positioning */}
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          className="!w-2.5 !h-2.5 !bg-indigo-500 !border-2 !border-zinc-900 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-auto !top-[-5px]"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="!w-2.5 !h-2.5 !bg-indigo-500 !border-2 !border-zinc-900 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-auto !bottom-[-5px]"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="!w-2.5 !h-2.5 !bg-indigo-500 !border-2 !border-zinc-900 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-auto !right-[-5px]"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="!w-2.5 !h-2.5 !bg-indigo-500 !border-2 !border-zinc-900 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-auto !left-[-5px]"
        />
      </div>
    </>
  );
}

function ResultsTable({ results }: { results: { columns: string[]; rows: unknown[][] } }) {
  if (!results.rows.length) {
    return <div className="text-zinc-500 text-sm">No results</div>;
  }

  return (
    <div className="overflow-auto h-full max-h-full nodrag nowheel">
      <table className="w-full text-sm border-collapse min-w-max sticky-header">
        <thead className="sticky top-0 bg-zinc-900">
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
