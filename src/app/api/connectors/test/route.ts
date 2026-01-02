// PostgreSQL Connection Test API Route

import { Pool } from 'pg';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { driver, details } = await request.json();
    
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
      connectionTimeoutMillis: 5000,
    });
    
    try {
      await pool.query('SELECT 1');
      return NextResponse.json({ success: true });
    } finally {
      await pool.end();
    }
    
  } catch (error) {
    console.error('Connection test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      },
      { status: 500 }
    );
  }
}
