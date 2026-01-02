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
import SchemaBrowser from './SchemaBrowser';
import ColumnMappingModal from './ColumnMappingModal';
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
      label: 'Sample Query',
      sql: 'SELECT * FROM customers LIMIT 10',
      results: null,
      isExecuting: false,
    },
  },
  {
    id: 'sql-2',
    type: 'sqlCell',
    position: { x: 100, y: 400 },
    data: {
      label: 'Order Analysis',
      sql: `SELECT 
  c.name,
  COUNT(o.id) as order_count,
  SUM(o.total) as total_spent
FROM orders o
JOIN customers c ON o.customer_id = c.id
GROUP BY c.name
ORDER BY total_spent DESC`,
      results: null,
      isExecuting: false,
    },
  },
  {
    id: 'text-1',
    type: 'textCell',
    position: { x: 600, y: 100 },
    data: {
      label: 'Getting Started',
      content: '# Welcome to Quarry\n\n**Sample tables available:**\n- `customers` - Customer info\n- `products` - Product catalog\n- `orders` - Order history\n\nClick **Run** to execute queries!',
    },
  },
];

const initialEdges: Edge[] = [];

interface DataCanvasProps {
  canvasId?: string;
}

function DataCanvasContent({ canvasId }: DataCanvasProps) {
  const [isCollab, setIsCollab] = useState(false);
  const [isSchemaOpen, setIsSchemaOpen] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<{
    sourceId: string;
    targetId: string;
    columns: string[];
    chartType: 'bar' | 'line' | 'pie' | 'bigNumber';
  } | null>(null);
  
  // Always use local state for nodes/edges (source of truth for data)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

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
  }, [getNodes, updateNodeData, isCollab, isSynced, syncPreview, edges, nodes, setNodes]);

  // Inject callbacks into nodes
  const nodesWithCallback = useMemo(() => {
    return nodes.map(node => {
      if (node.type === 'sqlCell' || node.type === 'chartCell') {
        return {
          ...node,
          data: {
            ...node.data,
            onRun: (sql: string) => handleRunQuery(node.id, sql),
            onTextChange: isCollab && isSynced && syncText 
              ? (text: string) => syncText(node.id, text) 
              : undefined,
          },
        };
      }
      return node;
    });
  }, [nodes, handleRunQuery, isCollab, isSynced, syncText]);

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
      <CanvasMenu onAddNode={handleAddNode} onFileUpload={handleFileUpload} />

      {/* Schema Browser */}
      <SchemaBrowser 
        isOpen={isSchemaOpen} 
        onToggle={() => setIsSchemaOpen(!isSchemaOpen)}
      />

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
