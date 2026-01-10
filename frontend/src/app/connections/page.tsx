'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { duckDB } from '@/lib/query/DuckDBEngine';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface TableSchema {
  name: string;
  columns: ColumnSchema[];
}

interface ColumnSchema {
  name: string;
  type: string;
  description?: string;
  alias?: string;
}

interface ColumnMetadata {
  table_name: string;
  column_name: string;
  description: string;
  alias: string;
}

interface Relationship {
  id: number;
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
  relationship_type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

interface Metric {
  id: number;
  name: string;
  display_name: string;
  description: string;
  table_name: string;
  expression: string;
  metric_type: 'measure' | 'dimension';
}

export default function ConnectionsPage() {
  const [tables, setTables] = useState<TableSchema[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [columnMetadata, setColumnMetadata] = useState<Record<string, ColumnMetadata>>({});
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [showMetricModal, setShowMetricModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'schema' | 'metrics'>('schema');
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Save column metadata with debounce
  const saveColumnMetadata = useCallback((tableName: string, columnName: string, field: 'description' | 'alias', value: string) => {
    const key = `${tableName}.${columnName}`;
    
    // Update local state immediately
    setColumnMetadata(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        table_name: tableName,
        column_name: columnName,
        [field]: value,
      },
    }));

    // Debounce API call
    if (saveTimeoutRef.current[key]) {
      clearTimeout(saveTimeoutRef.current[key]);
    }
    
    saveTimeoutRef.current[key] = setTimeout(async () => {
      const current = columnMetadata[key] || {};
      try {
        await fetch(`${API_URL}/api/metadata/columns`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_name: tableName,
            column_name: columnName,
            description: field === 'description' ? value : current.description || '',
            alias: field === 'alias' ? value : current.alias || '',
          }),
        });
      } catch (e) {
        console.error('Failed to save column metadata:', e);
      }
    }, 500);
  }, [columnMetadata]);

  // Load schema from DuckDB and metadata from backend
  useEffect(() => {
    let isMounted = true;
    
    const loadSchema = async () => {
      try {
        await duckDB.init();
        
        const tablesResult = await duckDB.query(`
          SELECT table_name FROM information_schema.tables 
          WHERE table_schema = 'main' ORDER BY table_name
        `);
        
        const tableSchemas: TableSchema[] = [];
        
        for (const row of tablesResult.rows) {
          const tableName = row[0] as string;
          const columnsResult = await duckDB.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = '${tableName}'
            ORDER BY ordinal_position
          `);
          
          tableSchemas.push({
            name: tableName,
            columns: columnsResult.rows.map(col => ({
              name: col[0] as string,
              type: col[1] as string,
            })),
          });
        }
        
        if (!isMounted) return;
        setTables(tableSchemas);
        
        // Load column metadata from backend API (ignore errors if backend not reachable)
        try {
          const metaRes = await fetch(`${API_URL}/api/metadata/columns`, { 
            signal: AbortSignal.timeout(5000) 
          });
          if (metaRes.ok) {
            const metaData: ColumnMetadata[] = await metaRes.json();
            const metaMap: Record<string, ColumnMetadata> = {};
            metaData.forEach(m => {
              metaMap[`${m.table_name}.${m.column_name}`] = m;
            });
            if (isMounted) {
              setColumnMetadata(metaMap);
            }
          }
        } catch (e) {
          // Silently fail - backend might not be accessible from browser
        }

        // Load relationships from backend API (ignore errors if backend not reachable)
        try {
          const res = await fetch(`${API_URL}/api/relationships`, { 
            signal: AbortSignal.timeout(5000) 
          });
          if (res.ok) {
            const data = await res.json();
            if (isMounted) {
              setRelationships(data);
            }
          }
        } catch (e) {
          // Silently fail - backend might not be accessible from browser
        }

        // Load metrics from backend API (ignore errors if backend not reachable)
        try {
          const metricsRes = await fetch(`${API_URL}/api/metrics`, { 
            signal: AbortSignal.timeout(5000) 
          });
          if (metricsRes.ok) {
            const metricsData = await metricsRes.json();
            if (isMounted) {
              setMetrics(metricsData);
            }
          }
        } catch (e) {
          // Silently fail - backend might not be accessible from browser
        }
      } catch (e) {
        console.error('Failed to load schema:', e);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    loadSchema();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Separate function to manually reload
  const reloadSchema = useCallback(async () => {
    setIsLoading(true);
    try {
      const tablesResult = await duckDB.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'main' ORDER BY table_name
      `);
      
      const tableSchemas: TableSchema[] = [];
      
      for (const row of tablesResult.rows) {
        const tableName = row[0] as string;
        const columnsResult = await duckDB.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = '${tableName}'
          ORDER BY ordinal_position
        `);
        
        tableSchemas.push({
          name: tableName,
          columns: columnsResult.rows.map(col => ({
            name: col[0] as string,
            type: col[1] as string,
          })),
        });
      }
      
      setTables(tableSchemas);
    } catch (e) {
      console.error('Failed to reload schema:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add relationship via backend API
  const addRelationship = async (rel: { fromTable: string; fromColumn: string; toTable: string; toColumn: string; type: string }) => {
    try {
      const res = await fetch(`${API_URL}/api/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_table: rel.fromTable,
          from_column: rel.fromColumn,
          to_table: rel.toTable,
          to_column: rel.toColumn,
          relationship_type: rel.type,
        }),
      });
      if (res.ok) {
        const newRel = await res.json();
        setRelationships([...relationships, newRel]);
      }
    } catch (e) {
      console.error('Failed to add relationship:', e);
    }
    setShowRelationshipModal(false);
  };

  // Remove relationship via backend API
  const removeRelationship = async (id: number) => {
    try {
      await fetch(`${API_URL}/api/relationships/${id}`, { method: 'DELETE' });
      setRelationships(relationships.filter(r => r.id !== id));
    } catch (e) {
      console.error('Failed to remove relationship:', e);
    }
  };

  // Add metric via backend API
  const addMetric = async (metric: Omit<Metric, 'id'>) => {
    try {
      const res = await fetch(`${API_URL}/api/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric),
      });
      if (res.ok) {
        const newMetric = await res.json();
        setMetrics([...metrics, newMetric]);
      }
    } catch (e) {
      console.error('Failed to add metric:', e);
    }
    setShowMetricModal(false);
  };

  // Remove metric via backend API
  const removeMetric = async (id: number) => {
    try {
      await fetch(`${API_URL}/api/metrics/${id}`, { method: 'DELETE' });
      setMetrics(metrics.filter(m => m.id !== id));
    } catch (e) {
      console.error('Failed to remove metric:', e);
    }
  };

  // Generate AI descriptions for a table
  const [generatingTables, setGeneratingTables] = useState<Set<string>>(new Set());
  
  const generateAIDescriptions = async (table: TableSchema) => {
    setGeneratingTables(prev => new Set(prev).add(table.name));
    try {
      const res = await fetch(`${API_URL}/api/ai/describe-columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: table.name,
          columns: table.columns.map(c => ({ name: c.name, type: c.type })),
        }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Failed to generate descriptions');
        return;
      }
      
      const data = await res.json();
      
      // Update column metadata with AI suggestions
      for (const col of data.columns || []) {
        const key = `${table.name}.${col.name}`;
        setColumnMetadata(prev => ({
          ...prev,
          [key]: {
            table_name: table.name,
            column_name: col.name,
            description: col.description || '',
            alias: col.alias || '',
          },
        }));
        
        // Save to backend
        await fetch(`${API_URL}/api/metadata/columns`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_name: table.name,
            column_name: col.name,
            description: col.description || '',
            alias: col.alias || '',
          }),
        });
      }
    } catch (e) {
      console.error('Failed to generate AI descriptions:', e);
      alert('Failed to generate descriptions');
    } finally {
      setGeneratingTables(prev => {
        const next = new Set(prev);
        next.delete(table.name);
        return next;
      });
    }
  };

  const getTypeColor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('int') || t.includes('decimal') || t.includes('float')) return 'text-blue-400';
    if (t.includes('varchar') || t.includes('text') || t.includes('char')) return 'text-green-400';
    if (t.includes('date') || t.includes('time')) return 'text-purple-400';
    if (t.includes('bool')) return 'text-orange-400';
    return 'text-zinc-400';
  };

  const selectedTableData = tables.find(t => t.name === selectedTable);


  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      {/* Sidebar */}
      <div className="w-56 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <Link href="/canvas" className="text-zinc-400 hover:text-white transition-colors text-sm">
            ← Canvas
          </Link>
        </div>
        
        <nav className="flex-1 p-2">
          <button
            onClick={() => setActiveTab('schema')}
            className={`w-full px-3 py-2 rounded-md text-left text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'schema'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
            }`}
          >
            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
            Data Model
            {tables.length > 0 && (
              <span className="ml-auto text-xs bg-zinc-700 px-1.5 py-0.5 rounded">{tables.length}</span>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('metrics')}
            className={`w-full px-3 py-2 rounded-md text-left text-sm flex items-center gap-2 transition-colors mt-1 ${
              activeTab === 'metrics'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
            }`}
          >
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Metrics
            {metrics.length > 0 && (
              <span className="ml-auto text-xs bg-zinc-700 px-1.5 py-0.5 rounded">{metrics.length}</span>
            )}
          </button>
        </nav>

        <div className="p-2 border-t border-zinc-800">
          <button
            onClick={reloadSchema}
            className="w-full px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-md transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl p-6 space-y-6">
          {isLoading ? (
            <div className="text-center py-12 text-zinc-500">Loading...</div>
          ) : activeTab === 'schema' ? (
            <>
              {/* Schema Tab - Tables */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Tables & Relationships</h2>
              </div>

              {tables.map(table => (
                <div key={table.name} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span className="font-semibold text-lg">{table.name}</span>
                      <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">{table.columns.length} cols</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => generateAIDescriptions(table)}
                        disabled={generatingTables.has(table.name)}
                        className="text-xs px-2 py-1 rounded bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 text-purple-300 hover:border-purple-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all"
                      >
                        {generatingTables.has(table.name) ? (
                          <>
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                            AI Describe
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => { setSelectedTable(table.name); setShowRelationshipModal(true); }}
                        className="text-xs text-zinc-400 hover:text-white"
                      >
                        + Relationship
                      </button>
                    </div>
                  </div>

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500">
                        <th className="text-left px-4 py-2 font-medium w-1/4">Column</th>
                        <th className="text-left px-4 py-2 font-medium w-1/6">Type</th>
                        <th className="text-left px-4 py-2 font-medium">Description</th>
                        <th className="text-left px-4 py-2 font-medium w-1/6">Alias</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.columns.map(col => {
                        const metaKey = `${table.name}.${col.name}`;
                        const meta = columnMetadata[metaKey] || {};
                        return (
                          <tr key={col.name} className="border-b border-zinc-800/30 hover:bg-zinc-800/20">
                            <td className="px-4 py-2 font-mono">{col.name}</td>
                            <td className={`px-4 py-2 ${getTypeColor(col.type)}`}>{col.type}</td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                placeholder="..."
                                defaultValue={meta.description || ''}
                                onChange={(e) => saveColumnMetadata(table.name, col.name, 'description', e.target.value)}
                                className="w-full bg-transparent text-zinc-400 placeholder-zinc-700 focus:outline-none focus:text-white"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                placeholder="..."
                                defaultValue={meta.alias || ''}
                                onChange={(e) => saveColumnMetadata(table.name, col.name, 'alias', e.target.value)}
                                className="w-full bg-transparent text-zinc-400 placeholder-zinc-700 focus:outline-none focus:text-white"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {relationships.filter(r => r.from_table === table.name || r.to_table === table.name).length > 0 && (
                    <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-950/50">
                      <div className="flex flex-wrap gap-2">
                        {relationships
                          .filter(r => r.from_table === table.name || r.to_table === table.name)
                          .map(rel => (
                            <div key={rel.id} className="flex items-center gap-1 text-xs bg-zinc-800 px-2 py-1 rounded">
                              <span className="text-zinc-400">{rel.from_table}.{rel.from_column}</span>
                              <span className="text-zinc-600">→</span>
                              <span className="text-zinc-400">{rel.to_table}.{rel.to_column}</span>
                              <button
                                onClick={() => removeRelationship(rel.id)}
                                className="ml-1 text-zinc-600 hover:text-red-400"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {tables.length === 0 && (
                <div className="text-center py-12 text-zinc-500">
                  No tables found. Upload data on the canvas first.
                </div>
              )}
            </>
          ) : (
            <>
              {/* Metrics Tab */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Fields</h2>
                <button
                  onClick={() => setShowMetricModal(true)}
                  className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 rounded transition-colors"
                >
                  + Add Metric
                </button>
              </div>

              {metrics.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
                  {/* <svg className="w-12 h-12 text-zinc-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg> */}
                  <p className="text-zinc-500 text-sm">No calculated fields yet.</p>
                  <p className="text-zinc-600 text-xs mt-1">Create metrics like <code className="bg-zinc-800 px-1 rounded">SUM(orders.total)</code></p>
                </div>
              ) : (
                <div className="space-y-3">
                  {metrics.map(metric => (
                    <div key={metric.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-start justify-between hover:bg-zinc-800/30 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{metric.display_name || metric.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${metric.metric_type === 'measure' ? 'bg-blue-900/30 text-blue-400' : 'bg-purple-900/30 text-purple-400'}`}>
                            {metric.metric_type}
                          </span>
                          <span className="text-xs text-zinc-600">on {metric.table_name}</span>
                        </div>
                        <code className="text-sm text-zinc-500 font-mono">{metric.expression}</code>
                        {metric.description && (
                          <p className="text-xs text-zinc-600 mt-1">{metric.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeMetric(metric.id)}
                        className="text-zinc-600 hover:text-red-400 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Relationship Modal */}
      {showRelationshipModal && (
        <RelationshipModal
          tables={tables}
          defaultFromTable={selectedTable || ''}
          onClose={() => setShowRelationshipModal(false)}
          onSave={addRelationship}
        />
      )}

      {/* Metric Modal */}
      {showMetricModal && (
        <MetricModal
          tables={tables}
          onClose={() => setShowMetricModal(false)}
          onSave={addMetric}
        />
      )}
    </div>
  );
}

// Relationship Modal Component
function RelationshipModal({
  tables,
  defaultFromTable,
  onClose,
  onSave,
}: {
  tables: TableSchema[];
  defaultFromTable: string;
  onClose: () => void;
  onSave: (rel: { fromTable: string; fromColumn: string; toTable: string; toColumn: string; type: string }) => void;
}) {
  const [fromTable, setFromTable] = useState(defaultFromTable);
  const [fromColumn, setFromColumn] = useState('');
  const [toTable, setToTable] = useState('');
  const [toColumn, setToColumn] = useState('');
  const [relType, setRelType] = useState<'one-to-one' | 'one-to-many' | 'many-to-many'>('one-to-many');

  const fromTableData = tables.find(t => t.name === fromTable);
  const toTableData = tables.find(t => t.name === toTable);

  const handleSave = () => {
    if (fromTable && fromColumn && toTable && toColumn) {
      onSave({ fromTable, fromColumn, toTable, toColumn, type: relType });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-[500px] max-w-full">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="font-semibold">Add Relationship</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          {/* From */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">From Table</label>
              <select
                value={fromTable}
                onChange={e => { setFromTable(e.target.value); setFromColumn(''); }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
              >
                <option value="">Select table</option>
                {tables.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Column</label>
              <select
                value={fromColumn}
                onChange={e => setFromColumn(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
                disabled={!fromTableData}
              >
                <option value="">Select column</option>
                {fromTableData?.columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Relationship Type */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Relationship Type</label>
            <select
              value={relType}
              onChange={e => setRelType(e.target.value as typeof relType)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
            >
              <option value="one-to-one">One to One</option>
              <option value="one-to-many">One to Many</option>
              <option value="many-to-many">Many to Many</option>
            </select>
          </div>

          {/* To */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">To Table</label>
              <select
                value={toTable}
                onChange={e => { setToTable(e.target.value); setToColumn(''); }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
              >
                <option value="">Select table</option>
                {tables.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Column</label>
              <select
                value={toColumn}
                onChange={e => setToColumn(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
                disabled={!toTableData}
              >
                <option value="">Select column</option>
                {toTableData?.columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!fromTable || !fromColumn || !toTable || !toColumn}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Relationship
          </button>
        </div>
      </div>
    </div>
  );
}

// Metric Modal Component
function MetricModal({
  tables,
  onClose,
  onSave,
}: {
  tables: TableSchema[];
  onClose: () => void;
  onSave: (metric: Omit<Metric, 'id'>) => void;
}) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [tableName, setTableName] = useState('');
  const [expression, setExpression] = useState('');
  const [metricType, setMetricType] = useState<'measure' | 'dimension'>('measure');

  const handleSave = () => {
    if (name && tableName && expression) {
      onSave({
        name,
        display_name: displayName || name,
        description,
        table_name: tableName,
        expression,
        metric_type: metricType,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-[550px] max-w-full">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="font-semibold">Add Calculated Field</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="total_revenue"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Total Revenue"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Base Table *</label>
              <select
                value={tableName}
                onChange={e => setTableName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
              >
                <option value="">Select table</option>
                {tables.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Type</label>
              <select
                value={metricType}
                onChange={e => setMetricType(e.target.value as 'measure' | 'dimension')}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
              >
                <option value="measure">Measure (aggregate)</option>
                <option value="dimension">Dimension (calculated)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Expression *</label>
            <textarea
              value={expression}
              onChange={e => setExpression(e.target.value)}
              placeholder="SUM(orders.total)"
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm font-mono"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Use SQL expressions. Reference columns as <code className="bg-zinc-800 px-1 rounded">table.column</code>
            </p>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Sum of all order totals"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name || !tableName || !expression}
            className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Metric
          </button>
        </div>
      </div>
    </div>
  );
}
