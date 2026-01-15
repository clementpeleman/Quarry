'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  database_name: string;
  username: string;
  ssl: boolean;
  is_demo: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConnectionInput {
  name: string;
  host: string;
  port?: number;
  database_name: string;
  username: string;
  password?: string;
  ssl?: boolean;
}

interface ConnectionContextType {
  connections: Connection[];
  activeConnection: Connection | null;
  isLoading: boolean;
  error: string | null;
  fetchConnections: () => Promise<void>;
  createConnection: (input: ConnectionInput) => Promise<Connection>;
  updateConnection: (id: string, input: ConnectionInput) => Promise<Connection>;
  deleteConnection: (id: string) => Promise<void>;
  testConnection: (id: string) => Promise<{ success: boolean; error?: string }>;
  activateConnection: (id: string) => Promise<void>;
  introspectConnection: (id: string) => Promise<{ tables: any[] }>;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/connections`);
      if (!response.ok) throw new Error('Failed to fetch connections');
      const data = await response.json();
      setConnections(data);
      const active = data.find((c: Connection) => c.is_active);
      setActiveConnection(active || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createConnection = useCallback(async (input: ConnectionInput): Promise<Connection> => {
    const response = await fetch(`${API_URL}/api/connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to create connection');
    }
    const newConn = await response.json();
    setConnections(prev => [...prev, newConn]);
    return newConn;
  }, []);

  const updateConnection = useCallback(async (id: string, input: ConnectionInput): Promise<Connection> => {
    const response = await fetch(`${API_URL}/api/connections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to update connection');
    }
    const updated = await response.json();
    setConnections(prev => prev.map(c => c.id === id ? updated : c));
    if (activeConnection?.id === id) {
      setActiveConnection(updated);
    }
    return updated;
  }, [activeConnection]);

  const deleteConnection = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/connections/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to delete connection');
    }
    setConnections(prev => prev.filter(c => c.id !== id));
    if (activeConnection?.id === id) {
      setActiveConnection(null);
    }
  }, [activeConnection]);

  const testConnection = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    const response = await fetch(`${API_URL}/api/connections/${id}/test`, {
      method: 'POST',
    });
    const data = await response.json();
    return { success: data.success, error: data.error };
  }, []);

  const activateConnection = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/connections/${id}/activate`, {
      method: 'POST',
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to activate connection');
    }
    const activated = await response.json();
    setConnections(prev => prev.map(c => ({
      ...c,
      is_active: c.id === id,
    })));
    setActiveConnection(activated);
  }, []);

  const introspectConnection = useCallback(async (id: string): Promise<{ tables: any[] }> => {
    const response = await fetch(`${API_URL}/api/connections/${id}/introspect`, {
      method: 'POST',
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to introspect connection');
    }
    return response.json();
  }, []);

  // Fetch connections on mount
  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  return (
    <ConnectionContext.Provider
      value={{
        connections,
        activeConnection,
        isLoading,
        error,
        fetchConnections,
        createConnection,
        updateConnection,
        deleteConnection,
        testConnection,
        activateConnection,
        introspectConnection,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnections() {
  const context = useContext(ConnectionContext);
  if (context === undefined) {
    throw new Error('useConnections must be used within a ConnectionProvider');
  }
  return context;
}
