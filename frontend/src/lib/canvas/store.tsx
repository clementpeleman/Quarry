'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Node, Edge } from '@xyflow/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface Canvas {
  id: number;
  name: string;
  description?: string;
  nodes: Node[];
  edges: Edge[];
  created_at: string;
  updated_at: string;
  connection_id?: string;
}

export interface CanvasListItem {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  connection_id?: string;
}

interface CanvasContextType {
  canvases: CanvasListItem[];
  currentCanvasId: number | null;
  currentCanvasName: string;
  isLoading: boolean;
  isCanvasListLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
  fetchCanvases: (connectionId?: string) => Promise<void>;
  loadCanvas: (id: number) => Promise<{ nodes: Node[]; edges: Edge[] }>;
  saveCanvas: (nodes: Node[], edges: Edge[]) => Promise<void>;
  createCanvas: (name: string, connectionId?: string) => Promise<number>;
  deleteCanvas: (id: number) => Promise<void>;
  renameCanvas: (name: string) => void;
  setCurrentCanvasId: (id: number | null) => void;
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

// Serialize nodes for storage - remove runtime data like callbacks and results
function serializeNodes(nodes: Node[]): Node[] {
  return nodes.map(node => ({
    id: node.id,
    type: node.type,
    position: node.position,
    style: node.style,
    data: {
      label: node.data?.label,
      sql: node.data?.sql,
      content: node.data?.content,
      chartType: node.data?.chartType,
      columnMapping: node.data?.columnMapping,
      sourceNodeId: node.data?.sourceNodeId,
      lastExecutionDuration: node.data?.lastExecutionDuration,
      // Explicitly exclude runtime data:
      // - results, preview, error, isExecuting
      // - onRun, onTextChange, useDuckDB, connectionId
    },
  }));
}

export function CanvasProvider({ children }: { children: ReactNode }) {
  const [canvases, setCanvases] = useState<CanvasListItem[]>([]);
  // Initialize from localStorage to persist across refreshes
  const [currentCanvasId, setCurrentCanvasIdState] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quarry-current-canvas-id');
      return saved ? parseInt(saved, 10) : null;
    }
    return null;
  });
  const [currentCanvasName, setCurrentCanvasName] = useState<string>('Untitled Canvas');
  const [isLoading, setIsLoading] = useState(false);
  const [isCanvasListLoading, setIsCanvasListLoading] = useState(true); // Default to true to prevent premature creation
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Wrapper to persist currentCanvasId to localStorage
  const setCurrentCanvasId = useCallback((id: number | null) => {
    setCurrentCanvasIdState(id);
    if (typeof window !== 'undefined') {
      if (id !== null) {
        localStorage.setItem('quarry-current-canvas-id', id.toString());
      } else {
        localStorage.removeItem('quarry-current-canvas-id');
      }
    }
  }, []);

  const fetchCanvases = useCallback(async (connectionId?: string) => {
    setIsCanvasListLoading(true);
    try {
      const url = connectionId 
        ? `${API_URL}/api/canvases?connection_id=${connectionId}` 
        : `${API_URL}/api/canvases`;
        
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch canvases');
      }
      const data = await response.json();
      setCanvases(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCanvasListLoading(false);
    }
  }, []);

  const loadCanvas = useCallback(async (id: number): Promise<{ nodes: Node[]; edges: Edge[] }> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/canvases/${id}`);
      if (!response.ok) throw new Error('Failed to load canvas');
      const data = await response.json();
      setCurrentCanvasId(data.id);
      setCurrentCanvasName(data.name);
      setLastSaved(new Date(data.updated_at));
      return {
        nodes: data.nodes || [],
        edges: data.edges || [],
      };
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveCanvas = useCallback(async (nodes: Node[], edges: Edge[]) => {
    setIsSaving(true);
    setError(null);
    try {
      const serializedNodes = serializeNodes(nodes);
      const body: any = {
        name: currentCanvasName,
        nodes: serializedNodes,
        edges: edges,
      };

      if (currentCanvasId) {
        body.id = currentCanvasId;
      }

      const response = await fetch(`${API_URL}/api/canvases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save canvas');
      }

      const saved = await response.json();

      // If this was a new canvas, update the ID
      if (!currentCanvasId && saved.id) {
        setCurrentCanvasId(saved.id);
      }

      setLastSaved(new Date());

      // Refresh canvas list (Note: passing undefined might load global list, user might need to refresh connection)
      // Ideally we should know current connection context here, but keeping it simple for now.
      // fetchCanvases(); 
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }, [currentCanvasId, currentCanvasName]); // Removed fetchCanvases from dep array if we don't call it, or call it safely?

  const createCanvas = useCallback(async (name: string, connectionId?: string): Promise<number> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/canvases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          nodes: [],
          edges: [],
          connection_id: connectionId || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create canvas');
      }

      const created = await response.json();
      setCurrentCanvasId(created.id);
      setCurrentCanvasName(name);
      setLastSaved(new Date());

      // Refresh canvas list with the same connection ID
      fetchCanvases(connectionId);

      return created.id;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchCanvases]);

  const deleteCanvas = useCallback(async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/api/canvases/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete canvas');

      setCanvases(prev => prev.filter(c => c.id !== id));

      if (currentCanvasId === id) {
        setCurrentCanvasId(null);
        setCurrentCanvasName('Untitled Canvas');
        setLastSaved(null);
      }
    } catch (err: any) {
      setError(err.message);
    }
  }, [currentCanvasId]);

  const renameCanvas = useCallback((name: string) => {
    setCurrentCanvasName(name);
  }, []);

  return (
    <CanvasContext.Provider
      value={{
        canvases,
        currentCanvasId,
        currentCanvasName,
        isLoading,
        isCanvasListLoading,
        isSaving,
        lastSaved,
        error,
        fetchCanvases,
        loadCanvas,
        saveCanvas,
        createCanvas,
        deleteCanvas,
        renameCanvas,
        setCurrentCanvasId,
      }}
    >
      {children}
    </CanvasContext.Provider>
  );
}

export function useCanvas() {
  const context = useContext(CanvasContext);
  if (context === undefined) {
    throw new Error('useCanvas must be used within a CanvasProvider');
  }
  return context;
}
