// PostgreSQL Driver (Server-side execution via API)
// Requires API route proxy for actual database connections

import type { Driver, ConnectionProperty, ConnectionDetails, QueryResult } from '../types';

export const PostgresDriver: Driver = {
  name: 'postgres',
  displayName: 'PostgreSQL',
  icon: '🐘',
  clientSide: false,
  
  connectionProperties(): ConnectionProperty[] {
    return [
      { 
        name: 'host', 
        displayName: 'Host', 
        type: 'string', 
        required: true, 
        default: 'localhost',
        placeholder: 'localhost or IP address'
      },
      { 
        name: 'port', 
        displayName: 'Port', 
        type: 'number', 
        required: true, 
        default: 5432 
      },
      { 
        name: 'database', 
        displayName: 'Database Name', 
        type: 'string', 
        required: true,
        placeholder: 'my_database'
      },
      { 
        name: 'username', 
        displayName: 'Username', 
        type: 'string', 
        required: true 
      },
      { 
        name: 'password', 
        displayName: 'Password', 
        type: 'password', 
        required: true 
      },
      { 
        name: 'ssl', 
        displayName: 'Use SSL', 
        type: 'boolean', 
        default: false,
        helperText: 'Enable for secure connections'
      },
    ];
  },
  
  async testConnection(details: ConnectionDetails): Promise<boolean> {
    try {
      const res = await fetch('/api/connectors/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver: 'postgres', details }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
  
  async executeQuery(details: ConnectionDetails, sql: string): Promise<QueryResult> {
    const res = await fetch('/api/connectors/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driver: 'postgres', details, sql }),
    });
    
    if (!res.ok) {
      const error = await res.text();
      return { columns: [], rows: [], error };
    }
    
    return res.json();
  },
  
  async getTables(details: ConnectionDetails) {
    const result = await this.executeQuery(details, `
      SELECT table_name as name, table_type as type 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (result.error) return [];
    
    return result.rows.map(row => ({
      name: row[0] as string,
      type: (row[1] === 'VIEW' ? 'view' : 'table') as 'table' | 'view',
    }));
  },
  
  async getColumns(details: ConnectionDetails, table: string) {
    const result = await this.executeQuery(details, `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = '${table}'
      ORDER BY ordinal_position
    `);
    
    if (result.error) return [];
    
    return result.rows.map(row => ({
      name: row[0] as string,
      type: row[1] as string,
      nullable: row[2] === 'YES',
    }));
  },
};
