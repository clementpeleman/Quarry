'use client';

import { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
  type OnConnect,
  type Node,
  type Edge,
  BackgroundVariant,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { duckDB } from '@/lib/query/DuckDBEngine';
import { useYjs } from '@/lib/collab/useYjs';
import { useConnections } from '@/lib/connections/store';
import { useCanvas } from '@/lib/canvas/store';

import SqlCell from './nodes/SqlCell';
import TextCell from './nodes/TextCell';
import ChartCell from './nodes/ChartCell';
import CanvasMenu from './CanvasMenu';
import SchemaBrowser from './SchemaBrowser';
import ColumnMappingModal from './ColumnMappingModal';
import { loadCSVFile, loadParquetFile } from '@/lib/connectors/drivers/duckdb';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const nodeTypes: NodeTypes = {
  sqlCell: SqlCell,
  textCell: TextCell,
  chartCell: ChartCell,
};

// Default dimensions for each node type
const NODE_DEFAULTS = {
  sqlCell: { width: 500, height: 350 },
  textCell: { width: 300, height: 250 },
  chartCell: { width: 450, height: 350 },
};

// Empty initial state - canvas loads from database
const emptyNodes: Node[] = [];
const emptyEdges: Edge[] = [];

interface DataCanvasProps {
  canvasId?: string;
}

function DataCanvasContent({ canvasId }: DataCanvasProps) {
  const { activeConnection } = useConnections();
  const {
    canvases,
    currentCanvasId,
    currentCanvasName,
    isLoading: isCanvasLoading,
    isCanvasListLoading,
    isSaving,
    lastSaved,
    error,
    fetchCanvases,
    loadCanvas,
    saveCanvas,
    createCanvas,
    setCurrentCanvasId,
  } = useCanvas();

  const [isCollab, setIsCollab] = useState(false);
  const [isSchemaOpen, setIsSchemaOpen] = useState(false);
  const [useDuckDB, setUseDuckDB] = useState(true); // DuckDB is default (demo); PostgreSQL for custom connections
  const [pendingConnection, setPendingConnection] = useState<{
    sourceId: string;
    targetId: string;
    columns: string[];
    chartType: 'bar' | 'line' | 'pie' | 'bigNumber';
  } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);

  // Always use local state for nodes/edges (source of truth for data)
  const [nodes, setNodes, onNodesChange] = useNodesState(emptyNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(emptyEdges);

  // Auto-save debounce ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedNodesRef = useRef<string>('');
  const lastSavedEdgesRef = useRef<string>('');

  // Determine effective connection ID for canvases
  // If useDuckDB is true, we treat it as "Local" mode (no connection ID)
  const effectiveConnectionId = useDuckDB ? undefined : activeConnection?.id;

  // Load canvas list on mount or when active connection changes
  useEffect(() => {
    setIsInitialized(false); // Reset initialization logic for new connection
    fetchCanvases(effectiveConnectionId);
  }, [fetchCanvases, effectiveConnectionId]);

  // Load canvas when currentCanvasId changes or on initial load
  useEffect(() => {
    async function initCanvas() {
      // Wait for list to load first to ensure validation
      if (isCanvasListLoading) return;
      if (isInitialized) return;

      let targetCanvasId = currentCanvasId;
      
      // Validation: Check if current ID belongs to this list
      if (targetCanvasId && !canvases.some(c => c.id === targetCanvasId)) {
         targetCanvasId = null; // Stale ID, ignore
      }

      if (targetCanvasId) {
        try {
          const data = await loadCanvas(targetCanvasId);
          setNodes(data.nodes);
          setEdges(data.edges);
          lastSavedNodesRef.current = JSON.stringify(data.nodes);
          lastSavedEdgesRef.current = JSON.stringify(data.edges);
          setIsInitialized(true);
        } catch (err) {
           console.error('Failed to load canvas, falling back:', err);
           targetCanvasId = null;
        }
      } 
      
      if (!targetCanvasId) {
         // Fallback: Load most recent or create new
         if (canvases.length > 0) {
            const mostRecent = canvases[0];
            try {
               const data = await loadCanvas(mostRecent.id);
               setNodes(data.nodes);
               setEdges(data.edges);
               lastSavedNodesRef.current = JSON.stringify(data.nodes);
               lastSavedEdgesRef.current = JSON.stringify(data.edges);
               setIsInitialized(true);
            } catch (e) {
                console.error('Failed to load most recent canvas:', e);
            }
         } else {
            // Create new
             try {
                await createCanvas('Untitled Canvas', effectiveConnectionId);
                setNodes([]);
                setEdges([]);
                lastSavedNodesRef.current = '[]';
                lastSavedEdgesRef.current = '[]';
                setIsInitialized(true);
             } catch(e) {
                 console.error('Failed to create default canvas:', e);
             }
         }
      }
    }

    initCanvas();
  }, [canvases, currentCanvasId, loadCanvas, createCanvas, setNodes, setEdges, isInitialized, effectiveConnectionId, isCanvasListLoading]);

  // Auto-save when nodes or edges change (debounced)
  useEffect(() => {
    if (!isInitialized || !currentCanvasId) return;

    const currentNodesStr = JSON.stringify(nodes.map(n => ({
      id: n.id,
      type: n.type,
      position: n.position,
      style: n.style,
      data: { label: n.data?.label, sql: n.data?.sql, content: n.data?.content, chartType: n.data?.chartType, columnMapping: n.data?.columnMapping }
    })));
    const currentEdgesStr = JSON.stringify(edges);

    // Skip if nothing changed
    if (currentNodesStr === lastSavedNodesRef.current && currentEdgesStr === lastSavedEdgesRef.current) {
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save by 2 seconds
    saveTimeoutRef.current = setTimeout(() => {
      saveCanvas(nodes, edges);
      lastSavedNodesRef.current = currentNodesStr;
      lastSavedEdgesRef.current = currentEdgesStr;
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [nodes, edges, isInitialized, currentCanvasId, saveCanvas]);

  // Collab State - for position, edge, preview, node, and text syncing
  const { 
      isSynced,
      users,
      syncPosition,
      syncEdge,
      syncPreview,
      syncNode,
      syncText,
      onRemotePositionChange,
      onRemoteEdgeChange,
      onRemotePreviewChange,
      onRemoteNodeChange,
      onRemoteTextChange
  } = useYjs(isCollab ? (canvasId || 'default') : null);

  const { getNodes } = useReactFlow();

  // Handle position syncing when collab is active
  const handleNodesChange = useCallback((changes: any) => {
    // Apply changes locally
    onNodesChange(changes);
    
    // If collab mode, sync position changes to other users
    if (isCollab && isSynced && syncPosition) {
      changes.forEach((change: any) => {
        if (change.type === 'position' && change.position) {
          // Sync position updates (throttled by React's batching)
          syncPosition(change.id, change.position);
        }
      });
    }
  }, [onNodesChange, isCollab, isSynced, syncPosition]);

  // Listen for remote position changes
  useEffect(() => {
    if (!isCollab || !isSynced || !onRemotePositionChange) return;
    
    const unsubscribe = onRemotePositionChange((nodeId: string, position: { x: number; y: number }) => {
      setNodes((nds) => 
        nds.map(n => n.id === nodeId ? { ...n, position } : n)
      );
    });
    
    return unsubscribe;
  }, [isCollab, isSynced, onRemotePositionChange, setNodes]);

  // Listen for remote edge changes
  useEffect(() => {
    if (!isCollab || !isSynced || !onRemoteEdgeChange) return;
    
    const unsubscribe = onRemoteEdgeChange((edge: any) => {
      setEdges((eds) => addEdge(edge, eds));
    });
    
    return unsubscribe;
  }, [isCollab, isSynced, onRemoteEdgeChange, setEdges]);

  // Listen for remote preview changes
  useEffect(() => {
    if (!isCollab || !isSynced || !onRemotePreviewChange) return;
    
    const unsubscribe = onRemotePreviewChange((nodeId: string, preview: any) => {
      setNodes((nds) => 
        nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, preview } } : n)
      );
    });
    
    return unsubscribe;
  }, [isCollab, isSynced, onRemotePreviewChange, setNodes]);

  // Listen for remote node additions
  useEffect(() => {
    if (!isCollab || !isSynced || !onRemoteNodeChange) return;
    
    const unsubscribe = onRemoteNodeChange((node: any) => {
      setNodes((nds) => {
        if (nds.find(n => n.id === node.id)) return nds;
        return [...nds, node];
      });
    });
    
    return unsubscribe;
  }, [isCollab, isSynced, onRemoteNodeChange, setNodes]);

  // Listen for remote text changes
  useEffect(() => {
    if (!isCollab || !isSynced || !onRemoteTextChange) return;
    
    const unsubscribe = onRemoteTextChange((nodeId: string, text: string) => {
      setNodes((nds) => 
        nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, sql: text } } : n)
      );
    });
    
    return unsubscribe;
  }, [isCollab, isSynced, onRemoteTextChange, setNodes]);

  const onConnect: OnConnect = useCallback(
    (connection) => {
      const sourceNode = nodes.find(n => n.id === connection.source);
      const targetNode = nodes.find(n => n.id === connection.target);
      
      // If connecting SQL → Chart and SQL has results, show column mapping modal
      if (
        sourceNode?.type === 'sqlCell' && 
        targetNode?.type === 'chartCell' &&
        sourceNode.data.results
      ) {
        const results = sourceNode.data.results as { columns: string[]; rows: unknown[][] };
        if (results.columns.length > 0) {
          setPendingConnection({
            sourceId: connection.source!,
            targetId: connection.target!,
            columns: results.columns,
            chartType: (targetNode.data as any).chartType || 'bar',
          });
          return; // Don't create edge yet, wait for modal
        }
      }
      
      const newEdge = { 
        ...connection, 
        id: `e${Date.now()}`,
        sourceHandle: connection.sourceHandle ?? null,
        targetHandle: connection.targetHandle ?? null
      };
      setEdges((eds) => addEdge(newEdge, eds as any));
      
      // Sync edge to collaborators
      if (isCollab && isSynced && syncEdge) {
        syncEdge(newEdge);
      }
    },
    [nodes, setEdges, isCollab, isSynced, syncEdge]
  );
  
  // Helper to update node data
  const updateNodeData = useCallback((nodeId: string, dataUpdate: any) => {
    setNodes((nds) => 
      nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...dataUpdate } } : n)
    );
  }, [setNodes]);

  const handleRunQuery = useCallback(async (nodeId: string, sql: string) => {
    updateNodeData(nodeId, { isExecuting: true, error: undefined });
    const startTime = performance.now();

    try {
      let result: { columns: string[]; rows: unknown[][] };

      if (useDuckDB) {
        // Use DuckDB (for file uploads and local data)
        const allNodes = getNodes();
        const dependencyRegex = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g;
        const dependencies = new Set<string>();

        let executableSql = sql;

        executableSql = executableSql.replace(dependencyRegex, (match, id) => {
          dependencies.add(id);
          return id.replace(/-/g, '_');
        });

        for (const depId of dependencies) {
          const depNode = allNodes.find((n) => n.id === depId);
          if (depNode && depNode.data.results) {
            const tableName = depId.replace(/-/g, '_');
            const results = depNode.data.results as { rows: unknown[][]; columns: string[] };

            const objects = results.rows.map(row => {
              const obj: Record<string, unknown> = {};
              results.columns.forEach((col, i) => {
                obj[col] = row[i];
              });
              return obj;
            });

            await duckDB.createTableFromJSON(tableName, objects);
          }
        }

        result = await duckDB.query(executableSql);
      } else {
        // Use PostgreSQL via backend API
        if (!activeConnection) {
          throw new Error('No active connection. Please select a connection first.');
        }

        const response = await fetch(`${API_URL}/api/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connection_id: activeConnection.id,
            sql,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Query execution failed');
        }

        result = await response.json();
      }

      const duration = performance.now() - startTime;
      updateNodeData(nodeId, { results: result, isExecuting: false, lastExecutionDuration: duration });

      // Auto-update connected chart nodes
      const connectedCharts = edges
        .filter(e => e.source === nodeId)
        .map(e => nodes.find(n => n.id === e.target))
        .filter(n => n?.type === 'chartCell');

      connectedCharts.forEach(chartNode => {
        if (chartNode) {
          setNodes(nds => nds.map(n =>
            n.id === chartNode.id
              ? { ...n, data: { ...n.data, results: result } }
              : n
          ));
        }
      });

      // Sync preview (first 5 rows) to collaborators
      if (isCollab && isSynced && syncPreview && result.rows) {
        const preview = {
          columns: result.columns,
          rows: result.rows.slice(0, 5),
          totalRows: result.rows.length
        };
        syncPreview(nodeId, preview);
      }

    } catch (error) {
      console.error(error);
      updateNodeData(nodeId, { isExecuting: false, error: (error as Error).message });
    }
  }, [getNodes, updateNodeData, isCollab, isSynced, syncPreview, edges, nodes, setNodes, useDuckDB, activeConnection]);

  // Inject callbacks and data source info into nodes
  const nodesWithCallback = useMemo(() => {
    return nodes.map(node => {
      if (node.type === 'sqlCell') {
        return {
          ...node,
          data: {
            ...node.data,
            onRun: (sql: string) => handleRunQuery(node.id, sql),
            onTextChange: isCollab && isSynced && syncText
              ? (text: string) => syncText(node.id, text)
              : undefined,
            // Sync SQL changes back to parent node for auto-save persistence
            onSqlChange: (sql: string) => updateNodeData(node.id, { sql }),
            // Pass data source info for autocomplete
            useDuckDB,
            connectionId: activeConnection?.id,
          },
        };
      }
      if (node.type === 'chartCell') {
        return {
          ...node,
          data: {
            ...node.data,
            onRun: (sql: string) => handleRunQuery(node.id, sql),
            // Allow changing chart type
            onChartTypeChange: (type: 'bar' | 'line' | 'pie' | 'bigNumber') => 
              updateNodeData(node.id, { chartType: type }),
          },
        };
      }
      return node;
    });
  }, [nodes, handleRunQuery, isCollab, isSynced, syncText, useDuckDB, activeConnection, updateNodeData]);

  // Add new node
  const handleAddNode = useCallback((type: 'sqlCell' | 'textCell' | 'chartCell') => {
    const defaults = NODE_DEFAULTS[type];
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: 200 + Math.random() * 100, y: 200 + Math.random() * 100 },
      style: { width: defaults.width, height: defaults.height },
      data: type === 'sqlCell'
        ? { label: 'New Query', sql: '', results: null, isExecuting: false }
        : type === 'chartCell'
        ? { label: 'New Chart', sql: '', results: null, chartType: 'bar', isExecuting: false }
        : { label: 'New Note', content: '# Title\n\nWrite your notes here...' },
    };
    setNodes((nds) => [...nds, newNode]);

    // Sync new node to collaborators
    if (isCollab && isSynced && syncNode) {
      syncNode(newNode);
    }
  }, [setNodes, isCollab, isSynced, syncNode]);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const tableName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
    try {
      if (ext === 'csv') {
        await loadCSVFile(file, tableName);
        console.log(`Loaded CSV as table: ${tableName}`);
      } else if (ext === 'parquet') {
        await loadParquetFile(file, tableName);
        console.log(`Loaded Parquet as table: ${tableName}`);
      } else if (ext === 'json') {
        // For JSON, use DuckDB's read_json_auto
        const text = await file.text();
        await duckDB.init();
        await duckDB.query(`CREATE TABLE ${tableName} AS SELECT * FROM read_json_auto('${text}')`);
        console.log(`Loaded JSON as table: ${tableName}`);
      }
    } catch (error) {
      console.error('Failed to load file:', error);
    }
  }, []);

  // Handle column mapping selection
  // Handle database repair
  const handleRepairDatabase = useCallback(async () => {
    setIsRepairing(true);
    try {
      const res = await fetch(`${API_URL}/api/system/migrate`, { method: 'POST' });
      if (res.ok) {
        // Refresh page to reload everything
        window.location.reload();
      } else {
        const data = await res.json();
        alert(`Repair failed: ${data.error}`);
        setIsRepairing(false);
      }
    } catch (e) {
      console.error(e);
      alert('Repair failed (network error)');
      setIsRepairing(false);
    }
  }, []);

  const handleColumnMappingSave = useCallback((mapping: { xColumn: string; yColumn: string }) => {
    if (!pendingConnection) return;
    
    const sourceNode = nodes.find(n => n.id === pendingConnection.sourceId);
    if (!sourceNode || !sourceNode.data.results) return;
    
    // Update chart node with results and column mapping
    setNodes(nds => nds.map(n => {
      if (n.id === pendingConnection.targetId) {
        return {
          ...n,
          data: {
            ...n.data,
            results: sourceNode.data.results,
            columnMapping: mapping,
            sourceNodeId: pendingConnection.sourceId,
          }
        };
      }
      return n;
    }));
    
    // Create the edge
    const newEdge = {
      id: `e${Date.now()}`,
      source: pendingConnection.sourceId,
      target: pendingConnection.targetId,
      sourceHandle: null,
      targetHandle: null,
    };
    setEdges(eds => addEdge(newEdge, eds as any));
    
    // Close modal
    setPendingConnection(null);
  }, [pendingConnection, nodes, setNodes, setEdges]);

  return (
    <div className="w-full h-full bg-zinc-950 relative">
      {/* Menu */}
      <CanvasMenu
        onAddNode={handleAddNode}
        onFileUpload={handleFileUpload}
        activeConnectionId={effectiveConnectionId}
        onLoadCanvas={(data) => {
          setNodes(data.nodes);
          setEdges(data.edges);
          lastSavedNodesRef.current = JSON.stringify(data.nodes);
          lastSavedEdgesRef.current = JSON.stringify(data.edges);
        }}
      />
      
      {/* Database Repair Overlay */}
      {error && error.includes('connection_id') && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-zinc-950/90 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-red-900/50 p-8 rounded-xl max-w-md text-center shadow-2xl">
            <div className="w-12 h-12 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
               <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
               </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Database Setup Required</h3>
            <p className="text-zinc-400 mb-6 leading-relaxed">
              Your database needs a schema update to support environment switching. 
              This will safely add the required columns without affecting existing data.
            </p>
            <button
              onClick={handleRepairDatabase}
              disabled={isRepairing}
              className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              {isRepairing ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating Schema...
                </>
              ) : (
                'Update Database Schema'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Schema Browser / Data Source Selector */}
      <SchemaBrowser
        isOpen={isSchemaOpen}
        onToggle={() => setIsSchemaOpen(!isSchemaOpen)}
        useDuckDB={useDuckDB}
        onDataSourceChange={setUseDuckDB}
      />

      {/* Top Right Controls */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
         {/* Save Status */}
         <div className="bg-zinc-900 border border-zinc-800 rounded-md p-1 flex items-center gap-2 px-3">
             <div className={`w-2 h-2 rounded-full ${isSaving ? 'bg-yellow-500 animate-pulse' : lastSaved ? 'bg-green-500' : 'bg-zinc-500'}`} />
             <span className="text-xs text-zinc-400 font-medium">
                 {isSaving ? 'Saving...' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'Not saved'}
             </span>
         </div>
         {/* Collab Status */}
         <div className="bg-zinc-900 border border-zinc-800 rounded-md p-1 flex items-center gap-2 px-3">
             <div className={`w-2 h-2 rounded-full ${isSynced ? 'bg-green-500' : isCollab ? 'bg-yellow-500' : 'bg-zinc-500'}`} />
             <span className="text-xs text-zinc-400 font-medium">
                 {isSynced ? `Live (${users})` : isCollab ? 'Connecting...' : 'Local'}
             </span>
         </div>
         <button
            onClick={() => setIsCollab(!isCollab)}
            className={`
                px-3 py-1.5 text-xs font-medium rounded-md border
                transition-all
                ${isCollab
                    ? 'bg-red-900/20 border-red-900 text-red-400 hover:bg-red-900/40'
                    : 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800'}
            `}
         >
             {isCollab ? 'Go Offline' : 'Go Live'}
         </button>
      </div>

      <ReactFlow
        nodes={nodesWithCallback}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        className="bg-zinc-950"
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#6366f1', strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={30} 
          size={1.5} 
          color="#27272a"
        />
        <Controls className="bg-zinc-900 border-zinc-800 text-white" />
        <MiniMap 
          nodeColor="#6366f1"
          maskColor="transparent"
          nodeStrokeWidth={2}
          style={{ 
            width: 140, 
            height: 90,
            background: 'transparent',
            border: 'none',
            transformOrigin: 'bottom right',
          }}
          className="opacity-30 hover:opacity-100 hover:scale-150 transition-all duration-300 ease-out"
        />
      </ReactFlow>

      {/* Column Mapping Modal */}
      {pendingConnection && (
        <ColumnMappingModal
          columns={pendingConnection.columns}
          chartType={pendingConnection.chartType}
          onSave={handleColumnMappingSave}
          onClose={() => setPendingConnection(null)}
        />
      )}
    </div>
  );
}

export default function DataCanvas(props: DataCanvasProps) {
  return (
    <ReactFlowProvider>
      <DataCanvasContent {...props} />
    </ReactFlowProvider>
  );
}
