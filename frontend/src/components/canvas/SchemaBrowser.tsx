'use client';

import { useState, useEffect, useCallback } from 'react';
import { duckDB } from '@/lib/query/DuckDBEngine';
import { useConnections } from '@/lib/connections/store';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface TableInfo {
  name: string;
  columnCount: number;
}

interface SchemaDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  useDuckDB: boolean;
  onDataSourceChange: (useDuckDB: boolean) => void;
}

export default function SchemaBrowser({ isOpen, onToggle, useDuckDB, onDataSourceChange }: SchemaDropdownProps) {
  const { connections, activeConnection, activateConnection, isLoading: connectionsLoading } = useConnections();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<{ name: string; type: string }[]>([]);

  // Load tables from DuckDB
  const loadDuckDBTables = useCallback(async () => {
    setIsLoading(true);
    try {
      await duckDB.init();
      const result = await duckDB.query(`
        SELECT t.table_name, COUNT(c.column_name) as col_count
        FROM information_schema.tables t
        LEFT JOIN information_schema.columns c ON t.table_name = c.table_name
        WHERE t.table_schema = 'main'
        GROUP BY t.table_name
        ORDER BY t.table_name
      `);
      setTables(result.rows.map(row => ({
        name: row[0] as string,
        columnCount: Number(row[1]),
      })));
    } catch (e) {
      console.error('Failed to load DuckDB tables:', e);
      setTables([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load tables from PostgreSQL connection
  const loadPostgresTables = useCallback(async () => {
    if (!activeConnection) {
      setTables([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/connections/${activeConnection.id}/introspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = await res.json();
        setTables((data.tables || []).map((t: any) => ({
          name: t.name,
          columnCount: t.columns?.length || 0,
        })));
      } else {
        setTables([]);
      }
    } catch (e) {
      console.error('Failed to load PostgreSQL tables:', e);
      setTables([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeConnection]);

  // Load columns from DuckDB
  const loadDuckDBColumns = useCallback(async (tableName: string) => {
    try {
      const result = await duckDB.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = '${tableName}'
        ORDER BY ordinal_position
      `);
      setColumns(result.rows.map(row => ({
        name: row[0] as string,
        type: row[1] as string,
      })));
    } catch (e) {
      console.error('Failed to load columns:', e);
    }
  }, []);

  // Load columns from PostgreSQL
  const loadPostgresColumns = useCallback(async (tableName: string) => {
    if (!activeConnection) return;

    try {
      const res = await fetch(`${API_URL}/api/connections/${activeConnection.id}/introspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        const table = (data.tables || []).find((t: any) => t.name === tableName);
        if (table) {
          setColumns(table.columns.map((c: any) => ({
            name: c.name,
            type: c.type,
          })));
        }
      }
    } catch (e) {
      console.error('Failed to load columns:', e);
    }
  }, [activeConnection]);

  // Load tables when data source changes
  useEffect(() => {
    if (useDuckDB) {
      loadDuckDBTables();
    } else {
      loadPostgresTables();
    }
    setExpandedTable(null);
    setColumns([]);
  }, [useDuckDB, loadDuckDBTables, loadPostgresTables]);

  const handleTableClick = (tableName: string) => {
    if (expandedTable === tableName) {
      setExpandedTable(null);
      setColumns([]);
    } else {
      setExpandedTable(tableName);
      if (useDuckDB) {
        loadDuckDBColumns(tableName);
      } else {
        loadPostgresColumns(tableName);
      }
    }
  };

  const handleSelectDuckDB = () => {
    onDataSourceChange(true);
    onToggle();
  };

  const handleSelectConnection = async (connectionId: string) => {
    await activateConnection(connectionId);
    onDataSourceChange(false);
    onToggle();
  };

  // Get current source name
  const currentSourceName = useDuckDB
    ? 'DuckDB'
    : activeConnection?.name || 'No Connection';

  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-4 z-40">
      {/* Database Selector Button */}
      <button
        onClick={onToggle}
        className={`
          text-sm transition-colors flex items-center gap-2 px-3 py-1.5 rounded-md border
          ${useDuckDB
            ? 'text-amber-400 border-amber-700/50 bg-amber-900/20 hover:bg-amber-900/30'
            : 'text-indigo-400 border-indigo-700/50 bg-indigo-900/20 hover:bg-indigo-900/30'}
        `}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
        <span className="font-medium">{currentSourceName}</span>
        <svg className={`w-4 h-4 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-zinc-900 border border-zinc-800 rounded-md shadow-xl min-w-[260px] max-w-[320px]">
          {/* Data Sources */}
          <div className="p-2 border-b border-zinc-800">
            <div className="text-xs text-zinc-500 px-2 py-1">Data Source</div>

            {/* DuckDB Option */}
            <button
              onClick={handleSelectDuckDB}
              className={`w-full px-2 py-2 text-left text-sm rounded flex items-center gap-2 transition-colors ${
                useDuckDB
                  ? 'bg-amber-900/30 text-amber-400'
                  : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
              <div className="flex-1">
                <div className="font-medium">DuckDB</div>
                <div className="text-xs text-zinc-500">Local / Uploaded Files</div>
              </div>
              {useDuckDB && (
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            {/* PostgreSQL Connections (excluding demo - used internally for persistence) */}
            {connectionsLoading ? (
              <div className="px-2 py-2 text-xs text-zinc-500">Loading connections...</div>
            ) : (
              connections.filter(conn => !conn.is_demo).map(conn => (
                <button
                  key={conn.id}
                  onClick={() => handleSelectConnection(conn.id)}
                  className={`w-full px-2 py-2 text-left text-sm rounded flex items-center gap-2 transition-colors ${
                    !useDuckDB && activeConnection?.id === conn.id
                      ? 'bg-indigo-900/30 text-indigo-400'
                      : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{conn.name}</div>
                    <div className="text-xs text-zinc-500 truncate">{conn.host}:{conn.port}/{conn.database_name}</div>
                  </div>
                  {!useDuckDB && activeConnection?.id === conn.id && (
                    <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))
            )}

            {/* Manage Connections Link */}
            <Link
              href="/connections"
              className="w-full px-2 py-2 text-left text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-2 mt-1"
              onClick={onToggle}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Manage Connections
            </Link>
          </div>

          {/* Tables List */}
          <div className="max-h-64 overflow-y-auto py-1">
            <div className="text-xs text-zinc-500 px-3 py-1">Tables</div>
            {isLoading ? (
              <div className="px-3 py-2 text-xs text-zinc-500">Loading tables...</div>
            ) : tables.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zinc-500">No tables found</div>
            ) : (
              tables.map(table => (
                <div key={table.name}>
                  <button
                    onClick={() => handleTableClick(table.name)}
                    className="w-full px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center justify-between"
                  >
                    <span className="truncate">{table.name}</span>
                    <span className="text-xs text-zinc-500">{table.columnCount}</span>
                  </button>
                  {expandedTable === table.name && columns.length > 0 && (
                    <div className="bg-zinc-950 border-y border-zinc-800 py-1">
                      {columns.map(col => (
                        <div key={col.name} className="px-4 py-0.5 text-xs flex justify-between">
                          <span className="text-zinc-400">{col.name}</span>
                          <span className="text-zinc-600">{col.type.toLowerCase()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
