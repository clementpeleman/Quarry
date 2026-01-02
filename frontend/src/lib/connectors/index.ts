// Connector Framework Exports
// Central export point for all connector-related functionality

export * from './types';
export * from './registry';

// Import and register all drivers
import { registerDriver } from './registry';
import { DuckDBDriver } from './drivers/duckdb';
import { PostgresDriver } from './drivers/postgres';

// Auto-register built-in drivers
registerDriver(DuckDBDriver);
registerDriver(PostgresDriver);
