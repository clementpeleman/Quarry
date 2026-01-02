'use client';

import { useCallback, useMemo, useEffect, useState } from 'react';
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

import SqlCell from './nodes/SqlCell';
import TextCell from './nodes/TextCell';
import ChartCell from './nodes/ChartCell';
import CanvasMenu from './CanvasMenu';
import { loadCSVFile, loadParquetFile } from '@/lib/connectors/drivers/duckdb';

const nodeTypes: NodeTypes = {
  sqlCell: SqlCell,
  textCell: TextCell,
  chartCell: ChartCell,
};

const initialNodes: Node[] = [
  {
    id: 'sql-1',
    type: 'sqlCell',
    position: { x: 100, y: 100 },
    data: {
      label: 'Query 1',
      sql: "SELECT 'Hello, Quarry!' AS greeting, 42 AS answer",
      results: null,
      isExecuting: false,
    },
  },
  {
    id: 'sql-2',
    type: 'sqlCell',
    position: { x: 100, y: 400 },
    data: {
      label: 'Query 2 (Chained)',
      sql: "SELECT * FROM sql_1 WHERE answer = 42",
      results: null,
      isExecuting: false,
    },
  },
  {
    id: 'text-1',
    type: 'textCell',
    position: { x: 600, y: 100 },
    data: {
      label: 'Notes',
      content: '# Welcome to Quarry\n\n- Write SQL in cells\n- Reference other cells with `{{cell_id}}`\n- Visualize results',
    },
  },
];

const initialEdges: Edge[] = [];

interface DataCanvasProps {
  canvasId?: string;
}

function DataCanvasContent({ canvasId }: DataCanvasProps) {
  const [isCollab, setIsCollab] = useState(false);
  
  // Always use local state for nodes/edges (source of truth for data)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Collab State - for position, edge, and preview syncing
  const { 
      isSynced,
      users,
      syncPosition,
      syncEdge,
      syncPreview,
      onRemotePositionChange,
      onRemoteEdgeChange,
      onRemotePreviewChange
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

  const onConnect: OnConnect = useCallback(
    (connection) => {
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
    [setEdges, isCollab, isSynced, syncEdge]
  );
  
  // Helper to update node data
  const updateNodeData = useCallback((nodeId: string, dataUpdate: any) => {
    setNodes((nds) => 
      nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...dataUpdate } } : n)
    );
  }, [setNodes]);

  const handleRunQuery = useCallback(async (nodeId: string, sql: string) => {
    updateNodeData(nodeId, { isExecuting: true });

    try {
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

      const result = await duckDB.query(executableSql);
      updateNodeData(nodeId, { results: result, isExecuting: false });
      
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
  }, [getNodes, updateNodeData, isCollab, isSynced, syncPreview]);

  // Inject callback into nodes
  const nodesWithCallback = useMemo(() => {
    return nodes.map(node => {
      if (node.type === 'sqlCell' || node.type === 'chartCell') {
        return {
          ...node,
          data: {
            ...node.data,
            onRun: (sql: string) => handleRunQuery(node.id, sql),
          },
        };
      }
      return node;
    });
  }, [nodes, handleRunQuery]);

  // Add new node
  const handleAddNode = useCallback((type: 'sqlCell' | 'textCell' | 'chartCell') => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: 200 + Math.random() * 100, y: 200 + Math.random() * 100 },
      data: type === 'sqlCell' 
        ? { label: 'New Query', sql: '', results: null, isExecuting: false }
        : type === 'chartCell'
        ? { label: 'New Chart', sql: '', results: null, chartType: 'bar', isExecuting: false }
        : { label: 'New Note', content: '# Title\n\nWrite your notes here...' },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

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

  return (
    <div className="w-full h-full bg-zinc-950 relative">
      {/* Menu */}
      <CanvasMenu onAddNode={handleAddNode} onFileUpload={handleFileUpload} />

      {/* Collab Status */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
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
          gap={20} 
          size={1} 
          color="#27272a"
        />
        <Controls className="bg-zinc-900 border-zinc-800 text-white" />
        <MiniMap 
          nodeColor="#6366f1"
          maskColor="rgba(0, 0, 0, 0.8)"
          className="bg-zinc-900 border-zinc-800"
        />
      </ReactFlow>
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
