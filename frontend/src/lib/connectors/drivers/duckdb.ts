// DuckDB WASM Driver
// Client-side SQL execution using DuckDB compiled to WebAssembly

import type { Driver, ConnectionProperty, ConnectionDetails, QueryResult } from '../types';
import { duckDB } from '../../query/DuckDBEngine';

export const DuckDBDriver: Driver = {
  name: 'duckdb',
  displayName: 'DuckDB (In-Browser)',
  icon: '🦆',
  clientSide: true,
  
  connectionProperties(): ConnectionProperty[] {
    // DuckDB WASM doesn't need connection details - it runs in the browser
    return [];
  },
  
  async testConnection(): Promise<boolean> {
    try {
      await duckDB.init();
      await duckDB.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  },
  
  async executeQuery(_details: ConnectionDetails, sql: string): Promise<QueryResult> {
    await duckDB.init();
    return duckDB.query(sql);
  },
  
  async getTables() {
    await duckDB.init();
    const result = await duckDB.query(`
      SELECT table_name as name, table_type as type 
      FROM information_schema.tables 
      WHERE table_schema = 'main'
    `);
    return result.rows.map(row => ({
      name: row[0] as string,
      type: (row[1] === 'VIEW' ? 'view' : 'table') as 'table' | 'view',
    }));
  },
  
  async getColumns(_details: ConnectionDetails, table: string) {
    await duckDB.init();
    const result = await duckDB.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = '${table}'
    `);
    return result.rows.map(row => ({
      name: row[0] as string,
      type: row[1] as string,
      nullable: row[2] === 'YES',
    }));
  },
};

// Export file loading utilities for DuckDB
export async function loadDuckDBFile(file: File): Promise<void> {
  const buffer = await file.arrayBuffer();
  await duckDB.loadDatabaseFile(buffer, file.name);
}

export async function loadCSVFile(file: File, tableName?: string): Promise<void> {
  const buffer = await file.arrayBuffer();
  const name = tableName || file.name.replace(/\.csv$/i, '');
  await duckDB.loadCSVFile(buffer, name);
}

export async function loadParquetFile(file: File, tableName?: string): Promise<void> {
  const buffer = await file.arrayBuffer();
  const name = tableName || file.name.replace(/\.parquet$/i, '');
  await duckDB.loadParquetFile(buffer, name);
}
