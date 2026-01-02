'use client';

import { useState, useEffect, useCallback } from 'react';
import { duckDB } from '@/lib/query/DuckDBEngine';

interface TableInfo {
  name: string;
  columnCount: number;
}

interface SchemaDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function SchemaBrowser({ isOpen, onToggle }: SchemaDropdownProps) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<{ name: string; type: string }[]>([]);

  const loadTables = useCallback(async () => {
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
      console.error('Failed to load tables:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadColumns = useCallback(async (tableName: string) => {
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

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const handleTableClick = (tableName: string) => {
    if (expandedTable === tableName) {
      setExpandedTable(null);
      setColumns([]);
    } else {
      setExpandedTable(tableName);
      loadColumns(tableName);
    }
  };

  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-4 z-40">
      {/* Database Selector */}
      <button
        onClick={onToggle}
        className="text-sm text-zinc-300 hover:text-white transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
        <span>DuckDB</span>
        <svg className={`w-4 h-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-zinc-900 border border-zinc-800 rounded-md shadow-lg min-w-[200px] max-w-[280px]">
          {/* Tables List */}
          <div className="max-h-72 overflow-y-auto py-1">
            {isLoading ? (
              <div className="px-3 py-2 text-xs text-zinc-500">Loading...</div>
            ) : tables.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zinc-500">No tables</div>
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
