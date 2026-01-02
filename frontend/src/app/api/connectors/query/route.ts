// PostgreSQL Query API Route

import { Pool } from 'pg';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { driver, details, sql } = await request.json();
    
    if (driver !== 'postgres') {
      return NextResponse.json(
        { error: `Unsupported driver: ${driver}` },
        { status: 400 }
      );
    }
    
    const pool = new Pool({
      host: details.host,
      port: details.port || 5432,
      database: details.database,
      user: details.username,
      password: details.password,
      ssl: details.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
    });
    
    try {
      const result = await pool.query(sql);
      
      return NextResponse.json({
        columns: result.fields.map((f: { name: string }) => f.name),
        rows: result.rows.map((r: Record<string, unknown>) => Object.values(r)),
        rowCount: result.rowCount,
      });
    } finally {
      await pool.end();
    }
    
  } catch (error) {
    console.error('Query error:', error);
    return NextResponse.json(
      { 
        columns: [], 
        rows: [], 
        error: error instanceof Error ? error.message : 'Query failed' 
      },
      { status: 500 }
    );
  }
}
