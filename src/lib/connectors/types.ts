// Database Connector Types
// Inspired by Metabase's driver architecture

/**
 * Connection property for UI form generation
 */
export interface ConnectionProperty {
  name: string;
  displayName: string;
  type: 'string' | 'number' | 'password' | 'boolean' | 'select';
  required?: boolean;
  default?: unknown;
  placeholder?: string;
  helperText?: string;
  options?: { value: string; label: string }[];
}

/**
 * Connection details object (user-provided credentials)
 */
export interface ConnectionDetails {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Column metadata from query results
 */
export interface ColumnMetadata {
  name: string;
  type: string;           // Database-specific type
  baseType: BaseType;     // Normalized type
}

export type BaseType = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'json' | 'unknown';

/**
 * Query result structure
 */
export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount?: number;
  error?: string;
}

/**
 * Table info for schema introspection
 */
export interface TableInfo {
  name: string;
  schema?: string;
  type: 'table' | 'view';
}

/**
 * Column info for schema introspection
 */
export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey?: boolean;
}

/**
 * Database driver interface
 * All drivers must implement this interface
 */
export interface Driver {
  // Metadata
  name: string;
  displayName: string;
  icon?: string;
  
  /**
   * Whether this driver runs client-side (WASM) or requires server proxy
   */
  clientSide: boolean;
  
  /**
   * Connection properties for UI form generation
   */
  connectionProperties(): ConnectionProperty[];
  
  /**
   * Test if connection details are valid
   */
  testConnection(details: ConnectionDetails): Promise<boolean>;
  
  /**
   * Execute a SQL query
   */
  executeQuery(details: ConnectionDetails, sql: string): Promise<QueryResult>;
  
  /**
   * Get list of tables (optional, for schema browser)
   */
  getTables?(details: ConnectionDetails): Promise<TableInfo[]>;
  
  /**
   * Get columns for a table (optional, for schema browser)
   */
  getColumns?(details: ConnectionDetails, table: string): Promise<ColumnInfo[]>;
}
