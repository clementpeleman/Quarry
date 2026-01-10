import cubejs from '@cubejs-client/core';

// Cube.js client configuration
const CUBE_API_URL = process.env.NEXT_PUBLIC_CUBE_API_URL || 'http://localhost:4000';

/**
 * Create a Cube.js API client
 * Uses backend proxy to handle authentication
 */
export const createCubeClient = () => {
  return cubejs(
    // No token needed - backend proxy handles auth
    async () => '',
    {
      apiUrl: `${CUBE_API_URL}/api/cube`,
    }
  );
};

// Singleton instance
let cubeClient: ReturnType<typeof cubejs> | null = null;

/**
 * Get the singleton Cube.js client instance
 */
export const getCubeClient = () => {
  if (!cubeClient) {
    cubeClient = createCubeClient();
  }
  return cubeClient;
};

/**
 * Execute a Cube.js query
 * @param query - Cube.js query object
 * @returns Query result with data, columns, and metadata
 */
export const executeCubeQuery = async (query: any) => {
  const client = getCubeClient();
  
  try {
    const resultSet = await client.load(query);
    
    // Transform to match DuckDB format for compatibility
    const columns = resultSet.tableColumns().map((col: any) => col.key);
    const rows = resultSet.tablePivot().map((row: any) => 
      columns.map((col: string) => row[col])
    );
    
    return {
      columns,
      rows,
      rawData: resultSet.rawData(),
    };
  } catch (error) {
    console.error('Cube query error:', error);
    throw error;
  }
};

/**
 * Fetch Cube.js metadata (available cubes, measures, dimensions)
 */
export const getCubeMeta = async () => {
  try {
    const response = await fetch(`${CUBE_API_URL}/api/cube/meta`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Cube metadata: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Cube meta error:', error);
    throw error;
  }
};

/**
 * Convert SQL to Cube query format (basic conversion)
 * This is a simplified converter - for production, use a proper SQL parser
 */
export const sqlToCubeQuery = (sql: string): any | null => {
  // Very basic SQL parsing - just for demo purposes
  // In production, use a proper SQL parser or let users write Cube queries directly
  
  const lowerSql = sql.toLowerCase();
  
  // Extract table name (cube name)
  const fromMatch = lowerSql.match(/from\s+(\w+)/);
  if (!fromMatch) return null;
  
  const cubeName = fromMatch[1].charAt(0).toUpperCase() + fromMatch[1].slice(1);
  
  // Check for COUNT(*)
  const isCount = lowerSql.includes('count(*)');
  
  // Build basic query
  const query: any = {};
  
  if (isCount) {
    query.measures = [`${cubeName}.count`];
  }
  
  // Extract dimensions (columns in SELECT that aren't aggregates)
  const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM/i);
  if (selectMatch) {
    const selectClause = selectMatch[1];
    const columns = selectClause.split(',').map(c => c.trim());
    
    const dimensions = columns
      .filter(col => !col.toLowerCase().includes('count') && !col.toLowerCase().includes('sum') && col !== '*')
      .map(col => {
        // Remove aliases
        const cleanCol = col.split(' as ')[0].trim();
        return `${cubeName}.${cleanCol}`;
      });
    
    if (dimensions.length > 0) {
      query.dimensions = dimensions;
    }
  }
  
  return Object.keys(query).length > 0 ? query : null;
};

/**
 * Types for Cube.js queries
 */
export interface CubeQuery {
  measures?: string[];
  dimensions?: string[];
  timeDimensions?: Array<{
    dimension: string;
    granularity?: string;
    dateRange?: string | string[];
  }>;
  filters?: Array<{
    member: string;
    operator: string;
    values: string[];
  }>;
  limit?: number;
  offset?: number;
  order?: Record<string, 'asc' | 'desc'>;
}

export interface CubeQueryResult {
  columns: string[];
  rows: any[][];
  rawData?: any[];
}
