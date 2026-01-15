import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { encrypt, decrypt } from './utils/encryption';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Cube.js configuration
const CUBE_API_URL = process.env.CUBE_API_URL || 'http://cubejs:4000';
const CUBE_API_SECRET = process.env.CUBE_API_SECRET || 'quarry_cube_secret_key_min_32_chars_long';

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://quarry:quarry_secret@localhost:5432/quarry',
});

// OpenAI client (lazy init)
let openai: OpenAI | null = null;
const getOpenAI = () => {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ============================================
// CONNECTIONS API
// ============================================

// Demo connection ID constant
const DEMO_CONNECTION_ID = '00000000-0000-0000-0000-000000000001';

// Get all connections (demo first)
app.get('/api/connections', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, host, port, database_name, username, ssl, is_demo, is_active, created_at, updated_at FROM connections ORDER BY is_demo DESC, created_at ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

// Get active connection
app.get('/api/connections/active', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, host, port, database_name, username, ssl, is_demo, is_active, created_at, updated_at FROM connections WHERE is_active = true LIMIT 1'
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active connection' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch active connection' });
  }
});

// Create new connection
app.post('/api/connections', async (req, res) => {
  const { name, host, port, database_name, username, password, ssl } = req.body;
  try {
    const encryptedPassword = password ? encrypt(password) : null;
    const result = await pool.query(
      `INSERT INTO connections (name, host, port, database_name, username, password_encrypted, ssl)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, host, port, database_name, username, ssl, is_demo, is_active, created_at, updated_at`,
      [name, host, port || 5432, database_name, username, encryptedPassword, ssl || false]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create connection' });
  }
});

// Update connection
app.put('/api/connections/:id', async (req, res) => {
  const { id } = req.params;
  const { name, host, port, database_name, username, password, ssl } = req.body;

  // Prevent updating demo connection's core fields
  if (id === DEMO_CONNECTION_ID) {
    return res.status(403).json({ error: 'Cannot modify demo connection' });
  }

  try {
    let query, params;
    if (password) {
      const encryptedPassword = encrypt(password);
      query = `UPDATE connections SET name = $2, host = $3, port = $4, database_name = $5, username = $6, password_encrypted = $7, ssl = $8, updated_at = CURRENT_TIMESTAMP
               WHERE id = $1 RETURNING id, name, host, port, database_name, username, ssl, is_demo, is_active, created_at, updated_at`;
      params = [id, name, host, port || 5432, database_name, username, encryptedPassword, ssl || false];
    } else {
      query = `UPDATE connections SET name = $2, host = $3, port = $4, database_name = $5, username = $6, ssl = $7, updated_at = CURRENT_TIMESTAMP
               WHERE id = $1 RETURNING id, name, host, port, database_name, username, ssl, is_demo, is_active, created_at, updated_at`;
      params = [id, name, host, port || 5432, database_name, username, ssl || false];
    }
    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update connection' });
  }
});

// Delete connection (not demo)
app.delete('/api/connections/:id', async (req, res) => {
  const { id } = req.params;

  if (id === DEMO_CONNECTION_ID) {
    return res.status(403).json({ error: 'Cannot delete demo connection' });
  }

  try {
    const result = await pool.query('DELETE FROM connections WHERE id = $1 AND is_demo = false RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found or cannot be deleted' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete connection' });
  }
});

// Test connection
app.post('/api/connections/:id/test', async (req, res) => {
  const { id } = req.params;

  try {
    // Get connection details
    const connResult = await pool.query('SELECT * FROM connections WHERE id = $1', [id]);
    if (connResult.rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const conn = connResult.rows[0];
    const password = decrypt(conn.password_encrypted || '');

    // Create temporary pool to test
    const testPool = new Pool({
      host: conn.host,
      port: conn.port,
      database: conn.database_name,
      user: conn.username,
      password: password,
      ssl: conn.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
    });

    try {
      const client = await testPool.connect();
      await client.query('SELECT 1');
      client.release();
      await testPool.end();
      res.json({ success: true, message: 'Connection successful' });
    } catch (testErr: any) {
      await testPool.end();
      res.status(400).json({ success: false, error: testErr.message || 'Connection failed' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to test connection' });
  }
});

// Activate connection (deactivates others) and reconfigure Cube.js
app.post('/api/connections/:id/activate', async (req, res) => {
  const { id } = req.params;

  try {
    // Deactivate all connections
    await pool.query('UPDATE connections SET is_active = false');

    // Activate the selected one
    const result = await pool.query(
      'UPDATE connections SET is_active = true WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const conn = result.rows[0];

    // Auto-reconfigure Cube.js for this connection
    try {
      let password = '';
      if (conn.password_encrypted) {
        password = decrypt(conn.password_encrypted);
      }

      const cubeEnv = `# Auto-generated by Quarry - Connection: ${conn.name}
# Generated at: ${new Date().toISOString()}

CUBEJS_DB_TYPE=postgres
CUBEJS_DB_HOST=${conn.host}
CUBEJS_DB_PORT=${conn.port || 5432}
CUBEJS_DB_NAME=${conn.database_name}
CUBEJS_DB_USER=${conn.username}
CUBEJS_DB_PASS=${password}
CUBEJS_DB_SSL=${conn.ssl ? 'true' : 'false'}

# API Settings
CUBEJS_DEV_MODE=true
CUBEJS_API_SECRET=${CUBE_API_SECRET}
CUBEJS_EXTERNAL_DEFAULT=true
CUBEJS_SCHEDULED_REFRESH_DEFAULT=false
CUBEJS_WEB_SOCKETS=false
`;

      const cubeEnvPath = path.join(process.cwd(), '../cube/.env');
      await fs.writeFile(cubeEnvPath, cubeEnv, 'utf8');
    } catch (cubeErr) {
      console.error('Failed to write Cube.js config:', cubeErr);
      // Don't fail the activation, just log the error
    }

    // Return connection without password
    res.json({
      id: conn.id,
      name: conn.name,
      host: conn.host,
      port: conn.port,
      database_name: conn.database_name,
      username: conn.username,
      ssl: conn.ssl,
      is_demo: conn.is_demo,
      is_active: conn.is_active,
      created_at: conn.created_at,
      updated_at: conn.updated_at,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to activate connection' });
  }
});

// Introspect connection - get tables and columns
app.post('/api/connections/:id/introspect', async (req, res) => {
  const { id } = req.params;

  try {
    // Get connection details
    const connResult = await pool.query('SELECT * FROM connections WHERE id = $1', [id]);
    if (connResult.rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const conn = connResult.rows[0];
    const password = decrypt(conn.password_encrypted || '');

    // Create temporary pool
    const introspectPool = new Pool({
      host: conn.host,
      port: conn.port,
      database: conn.database_name,
      user: conn.username,
      password: password,
      ssl: conn.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
    });

    try {
      // Get tables
      const tablesResult = await introspectPool.query(`
        SELECT table_name as name, table_type as type
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);

      const tables = [];

      // Get columns for each table
      for (const table of tablesResult.rows) {
        const columnsResult = await introspectPool.query(`
          SELECT column_name as name, data_type as type, is_nullable = 'YES' as nullable
          FROM information_schema.columns
          WHERE table_name = $1 AND table_schema = 'public'
          ORDER BY ordinal_position
        `, [table.name]);

        tables.push({
          name: table.name,
          type: table.type === 'VIEW' ? 'view' : 'table',
          columns: columnsResult.rows,
        });
      }

      await introspectPool.end();
      res.json({ tables });
    } catch (introspectErr: any) {
      await introspectPool.end();
      res.status(400).json({ error: introspectErr.message || 'Introspection failed' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to introspect connection' });
  }
});

// ============================================
// SEMANTIC LAYER API
// ============================================

// Get all column metadata (filtered by connection_id)
app.get('/api/metadata/columns', async (req, res) => {
  const connectionId = req.query.connection_id || DEMO_CONNECTION_ID;
  try {
    const result = await pool.query(
      'SELECT * FROM column_metadata WHERE connection_id = $1 ORDER BY table_name, column_name',
      [connectionId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch column metadata' });
  }
});

// Update column metadata
app.put('/api/metadata/columns', async (req, res) => {
  const { connection_id, table_name, column_name, description, alias } = req.body;
  const connId = connection_id || DEMO_CONNECTION_ID;
  try {
    const result = await pool.query(
      `INSERT INTO column_metadata (connection_id, table_name, column_name, description, alias)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (connection_id, table_name, column_name)
       DO UPDATE SET description = $4, alias = $5, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [connId, table_name, column_name, description, alias]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update column metadata' });
  }
});

// Get all relationships (filtered by connection_id)
app.get('/api/relationships', async (req, res) => {
  const connectionId = req.query.connection_id || DEMO_CONNECTION_ID;
  try {
    const result = await pool.query(
      'SELECT * FROM relationships WHERE connection_id = $1 ORDER BY from_table',
      [connectionId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch relationships' });
  }
});

// Create relationship
app.post('/api/relationships', async (req, res) => {
  const { connection_id, from_table, from_column, to_table, to_column, relationship_type } = req.body;
  const connId = connection_id || DEMO_CONNECTION_ID;
  try {
    const result = await pool.query(
      `INSERT INTO relationships (connection_id, from_table, from_column, to_table, to_column, relationship_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [connId, from_table, from_column, to_table, to_column, relationship_type || 'one-to-many']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create relationship' });
  }
});

// Delete relationship
app.delete('/api/relationships/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM relationships WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete relationship' });
  }
});

// ============================================
// METRICS API
// ============================================

// Get all metrics (filtered by connection_id)
app.get('/api/metrics', async (req, res) => {
  const connectionId = req.query.connection_id || DEMO_CONNECTION_ID;
  try {
    const result = await pool.query(
      'SELECT * FROM metrics WHERE connection_id = $1 ORDER BY name',
      [connectionId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Create/update metric
app.post('/api/metrics', async (req, res) => {
  const { connection_id, name, display_name, description, table_name, expression, metric_type } = req.body;
  const connId = connection_id || DEMO_CONNECTION_ID;
  try {
    const result = await pool.query(
      `INSERT INTO metrics (connection_id, name, display_name, description, table_name, expression, metric_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (connection_id, name)
       DO UPDATE SET display_name = $3, description = $4, table_name = $5, expression = $6, metric_type = $7, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [connId, name, display_name, description, table_name, expression, metric_type || 'measure']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create metric' });
  }
});

// Delete metric
app.delete('/api/metrics/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM metrics WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete metric' });
  }
});

// ============================================
// AI API
// ============================================

// Generate descriptions and aliases for columns
app.post('/api/ai/describe-columns', async (req, res) => {
  const { table_name, columns } = req.body;
  
  const client = getOpenAI();
  if (!client) {
    return res.status(400).json({ error: 'OpenAI API key not configured. Set OPENAI_API_KEY environment variable.' });
  }

  try {
    const prompt = `You are a data analyst helping document a database schema.

Table: ${table_name}
Columns: ${columns.map((c: { name: string; type: string }) => `${c.name} (${c.type})`).join(', ')}

For each column, provide:
1. A brief, clear description (1 sentence max)
2. A human-readable alias (only if the column name is unclear/abbreviated, otherwise null)

Respond in JSON format:
{
  "columns": [
    { "name": "column_name", "description": "...", "alias": "..." or null }
  ]
}

Be concise. Only suggest aliases for cryptic names like "cust_id" -> "Customer ID", not for clear names like "email".`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: 'Empty response from AI' });
    }

    const parsed = JSON.parse(content);
    res.json(parsed);
  } catch (err) {
    console.error('AI error:', err);
    res.status(500).json({ error: 'Failed to generate descriptions' });
  }
});

// ============================================
// SYSTEM API
// ============================================

// Run database migration (Rescue)
app.post('/api/system/migrate', async (req, res) => {
  try {
    // 1. Add connection_id to canvases
    await pool.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='canvases' AND column_name='connection_id') THEN
              ALTER TABLE canvases ADD COLUMN connection_id UUID REFERENCES connections(id) ON DELETE CASCADE;
              CREATE INDEX idx_canvases_connection ON canvases(connection_id);
          END IF;
      END $$;
    `);

    // 2. Ensure Cube demo tables exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name TEXT,
        email TEXT,
        country TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        total DECIMAL(10,2),
        status TEXT,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 3. Seed if empty
    const customers = await pool.query('SELECT count(*) FROM customers');
    if (parseInt(customers.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO customers (name, email, country, created_at) VALUES
        ('Alice Johnson', 'alice@example.com', 'USA', '2023-01-15 10:00:00'),
        ('Bob Smith', 'bob@example.com', 'Canada', '2023-02-20 14:30:00'),
        ('Clara Martinez', 'clara@example.com', 'Mexico', '2023-03-10 09:15:00');

        INSERT INTO orders (customer_id, total, status, created_at) VALUES
        (1, 120.50, 'completed', NOW()),
        (1, 45.00, 'processing', NOW()),
        (2, 99.99, 'completed', NOW()),
        (3, 150.00, 'shipped', NOW());
      `);
    }

    res.json({ success: true, message: 'Migration completed successfully' });
  } catch (err: any) {
    console.error('Migration failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// CANVASES API
// ============================================

// Get all canvases (filtered by connection)
app.get('/api/canvases', async (req, res) => {
  const { connection_id } = req.query;
  try {
    let query = 'SELECT id, name, description, created_at, updated_at, connection_id FROM canvases';
    const values: any[] = [];
    
    if (connection_id) {
      query += ' WHERE connection_id = $1';
      values.push(connection_id);
    } else {
      query += ' WHERE connection_id IS NULL';
    }
    
    query += ' ORDER BY updated_at DESC';
    
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get single canvas
app.get('/api/canvases/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM canvases WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Canvas not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch canvas' });
  }
});

// Create/update canvas
app.post('/api/canvases', async (req, res) => {
  const { id, name, description, nodes, edges, connection_id } = req.body;
  try {
    if (id) {
      // Update existing
      const result = await pool.query(
        `UPDATE canvases SET name = $2, description = $3, nodes = $4, edges = $5, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 RETURNING *`,
        [id, name, description, JSON.stringify(nodes), JSON.stringify(edges)]
      );
      res.json(result.rows[0]);
    } else {
      // Create new
      const result = await pool.query(
        `INSERT INTO canvases (name, description, nodes, edges, connection_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name, description, JSON.stringify(nodes), JSON.stringify(edges), connection_id]
      );
      res.json(result.rows[0]);
    }
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Delete canvas
app.delete('/api/canvases/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM canvases WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete canvas' });
  }
});

// ============================================
// CUBE.JS INTEGRATION API
// ============================================

// Helper function to generate JWT for Cube.js
const generateCubeToken = () => {
  return jwt.sign({}, CUBE_API_SECRET, { expiresIn: '1h' });
};

// Proxy to Cube.js /meta endpoint
app.get('/api/cube/meta', async (req, res) => {
  try {
    const token = generateCubeToken();
    const response = await fetch(`${CUBE_API_URL}/cubejs-api/v1/meta`, {
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Cube API returned ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Cube meta error:', err);
    res.status(500).json({ error: 'Failed to fetch Cube metadata' });
  }
});

// Proxy to Cube.js /load endpoint
app.get('/api/cube/load', async (req, res) => {
  try {
    const token = generateCubeToken();
    const queryString = req.url.split('?')[1] || '';
    
    const response = await fetch(`${CUBE_API_URL}/cubejs-api/v1/load?${queryString}`, {
      method: 'GET',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cube API returned ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error('Cube load error:', err);
    res.status(500).json({ error: `Failed to execute Cube query: ${err.message || String(err)}` });
  }
});

// Proxy to Cube.js /load endpoint
app.post('/api/cube/load', async (req, res) => {
  try {
    const token = generateCubeToken();
    const response = await fetch(`${CUBE_API_URL}/cubejs-api/v1/load`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cube API returned ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error('Cube load error:', err);
    res.status(500).json({ error: `Failed to execute Cube query: ${err.message || String(err)}` });
  }
});

// Sync Quarry metrics to Cube.js schemas (filtered by connection_id)
app.post('/api/cube/sync', async (req, res) => {
  const { connection_id } = req.body;
  const connId = connection_id || DEMO_CONNECTION_ID;
  try {
    // Fetch all metrics and relationships from Quarry for this connection
    const metricsResult = await pool.query('SELECT * FROM metrics WHERE connection_id = $1 ORDER BY name', [connId]);
    const relationshipsResult = await pool.query('SELECT * FROM relationships WHERE connection_id = $1 ORDER BY from_table', [connId]);
    const columnsResult = await pool.query('SELECT * FROM column_metadata WHERE connection_id = $1 ORDER BY table_name, column_name', [connId]);
    
    const metrics = metricsResult.rows;
    const relationships = relationshipsResult.rows;
    const columns = columnsResult.rows;
    
    // Group metrics by table
    const metricsByTable: Record<string, any[]> = {};
    metrics.forEach(metric => {
      if (!metricsByTable[metric.table_name]) {
        metricsByTable[metric.table_name] = [];
      }
      metricsByTable[metric.table_name].push(metric);
    });
    
    // Group relationships by from_table
    const relationshipsByTable: Record<string, any[]> = {};
    relationships.forEach(rel => {
      if (!relationshipsByTable[rel.from_table]) {
        relationshipsByTable[rel.from_table] = [];
      }
      relationshipsByTable[rel.from_table].push(rel);
    });
    
    // Group columns by table
    const columnsByTable: Record<string, any[]> = {};
    columns.forEach(col => {
      if (!columnsByTable[col.table_name]) {
        columnsByTable[col.table_name] = [];
      }
      columnsByTable[col.table_name].push(col);
    });
    
    // Generate Cube schema files
    const generatedDir = path.join(process.cwd(), '../cube/model/generated');
    
    // Create generated directory if it doesn't exist
    try {
      await fs.mkdir(generatedDir, { recursive: true });
    } catch (mkdirErr) {
      // Directory might already exist
    }
    
    const generatedFiles: string[] = [];
    
    // Get unique tables from metrics
    const tables = [...new Set(metrics.map(m => m.table_name))];
    
    for (const tableName of tables) {
      const tableMetrics = metricsByTable[tableName] || [];
      const tableRelationships = relationshipsByTable[tableName] || [];
      const tableColumns = columnsByTable[tableName] || [];
      
      // Generate cube name (capitalize first letter)
      const cubeName = tableName.charAt(0).toUpperCase() + tableName.slice(1);
      
      // Build measures object
      const measuresCode = tableMetrics.map(metric => {
        return `    ${metric.name}: {
      sql: \`${metric.expression}\`,
      type: '${metric.metric_type}',
      description: '${metric.description || metric.display_name}'
    }`;
      }).join(',\n');
      
      // Build dimensions object from columns
      const dimensionsCode = tableColumns.map(col => {
        return `    ${col.column_name}: {
      sql: \`${col.column_name}\`,
      type: 'string',
      description: '${col.description || col.alias || col.column_name}'
    }`;
      }).join(',\n');
      
      // Build joins object
      const joinsCode = tableRelationships.map(rel => {
        const targetCube = rel.to_table.charAt(0).toUpperCase() + rel.to_table.slice(1);
        return `    ${targetCube}: {
      relationship: '${rel.relationship_type}',
      sql: \`\${CUBE}.${rel.from_column} = \${${targetCube}}.${rel.to_column}\`
    }`;
      }).join(',\n');
      
      // Generate complete cube file
      const cubeCode = `cube('${cubeName}', {
  sql_table: '${tableName}',
  
  measures: {
${measuresCode || '    // No measures defined'}
  },
  
  dimensions: {
${dimensionsCode || '    // No dimensions defined'}
  }${joinsCode ? `,
  
  joins: {
${joinsCode}
  }` : ''}
});
`;
      
      const fileName = `${cubeName}.js`;
      const filePath = path.join(generatedDir, fileName);
      await fs.writeFile(filePath, cubeCode, 'utf8');
      generatedFiles.push(fileName);
    }
    
    res.json({
      success: true,
      message: `Generated ${generatedFiles.length} Cube schema file(s)`,
      files: generatedFiles
    });
  } catch (err) {
    console.error('Cube sync error:', err);
    res.status(500).json({ error: 'Failed to sync to Cube' });
  }
});

// ============================================
// CUBE.JS RECONFIGURATION
// ============================================

// Reconfigure Cube.js to use a different connection
app.post('/api/cube/reconfigure', async (req, res) => {
  const { connection_id } = req.body;

  if (!connection_id) {
    return res.status(400).json({ error: 'connection_id is required' });
  }

  try {
    // Get connection details
    const connResult = await pool.query(
      'SELECT * FROM connections WHERE id = $1',
      [connection_id]
    );

    if (connResult.rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const conn = connResult.rows[0];

    // Decrypt password if encrypted
    let password = '';
    if (conn.password_encrypted) {
      password = decrypt(conn.password_encrypted);
    }

    // Generate Cube.js environment configuration
    const cubeEnv = `# Auto-generated by Quarry - Connection: ${conn.name}
# Generated at: ${new Date().toISOString()}

CUBEJS_DB_TYPE=postgres
CUBEJS_DB_HOST=${conn.host}
CUBEJS_DB_PORT=${conn.port || 5432}
CUBEJS_DB_NAME=${conn.database_name}
CUBEJS_DB_USER=${conn.username}
CUBEJS_DB_PASS=${password}
CUBEJS_DB_SSL=${conn.ssl ? 'true' : 'false'}

# API Settings
CUBEJS_DEV_MODE=true
CUBEJS_API_SECRET=${CUBE_API_SECRET}
CUBEJS_EXTERNAL_DEFAULT=true
CUBEJS_SCHEDULED_REFRESH_DEFAULT=false
CUBEJS_WEB_SOCKETS=false
`;

    // Write to cube/.env file
    const cubeEnvPath = path.join(process.cwd(), '../cube/.env');
    await fs.writeFile(cubeEnvPath, cubeEnv, 'utf8');

    // Also update the active connection in database
    await pool.query('UPDATE connections SET is_active = false WHERE is_active = true');
    await pool.query('UPDATE connections SET is_active = true WHERE id = $1', [connection_id]);

    res.json({
      success: true,
      message: `Cube.js configured for connection: ${conn.name}`,
      connection: {
        id: conn.id,
        name: conn.name,
        host: conn.host,
        port: conn.port,
        database_name: conn.database_name,
      },
      note: 'Restart Cube.js container to apply changes: docker-compose restart cubejs'
    });
  } catch (err) {
    console.error('Cube reconfigure error:', err);
    res.status(500).json({ error: 'Failed to reconfigure Cube.js' });
  }
});

// Get current Cube.js connection info
app.get('/api/cube/config', async (req, res) => {
  try {
    // Read current .env file
    const cubeEnvPath = path.join(process.cwd(), '../cube/.env');
    let envContent = '';

    try {
      envContent = await fs.readFile(cubeEnvPath, 'utf8');
    } catch (readErr) {
      // File might not exist
    }

    // Get active connection from database
    const activeConn = await pool.query(
      'SELECT id, name, host, port, database_name, username, is_demo FROM connections WHERE is_active = true LIMIT 1'
    );

    res.json({
      activeConnection: activeConn.rows[0] || null,
      envFileExists: !!envContent,
    });
  } catch (err) {
    console.error('Cube config error:', err);
    res.status(500).json({ error: 'Failed to get Cube config' });
  }
});

// ============================================
// SQL QUERY EXECUTION
// ============================================

// Execute SQL query against a connection
app.post('/api/query', async (req, res) => {
  const { connection_id, sql } = req.body;

  if (!sql) {
    return res.status(400).json({ error: 'sql is required' });
  }

  // Use active connection if no connection_id provided
  let connId = connection_id;
  if (!connId) {
    const activeResult = await pool.query('SELECT id FROM connections WHERE is_active = true LIMIT 1');
    if (activeResult.rows.length === 0) {
      return res.status(400).json({ error: 'No active connection' });
    }
    connId = activeResult.rows[0].id;
  }

  try {
    // Get connection details
    const connResult = await pool.query('SELECT * FROM connections WHERE id = $1', [connId]);
    if (connResult.rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const conn = connResult.rows[0];

    // Decrypt password
    let password = '';
    if (conn.password_encrypted) {
      password = decrypt(conn.password_encrypted);
    }

    // Create temporary pool for this connection
    const queryPool = new Pool({
      host: conn.host,
      port: conn.port || 5432,
      database: conn.database_name,
      user: conn.username,
      password: password,
      ssl: conn.ssl ? { rejectUnauthorized: false } : false,
      max: 1,
      connectionTimeoutMillis: 10000,
      query_timeout: 30000,
    });

    try {
      const result = await queryPool.query(sql);
      await queryPool.end();

      // Format response similar to DuckDB format
      // Handle multi-statement results (Pg returns array)
      const lastResult = Array.isArray(result) ? result[result.length - 1] : result;
      
      const columns = lastResult.fields ? lastResult.fields.map((f: any) => f.name) : [];
      const rows = lastResult.rows ? lastResult.rows.map((row: any) => columns.map((col: string) => row[col])) : [];

      res.json({
        columns,
        rows,
        rowCount: lastResult.rowCount,
      });
    } catch (queryErr: any) {
      await queryPool.end();
      res.status(400).json({ error: queryErr.message || 'Query execution failed' });
    }
  } catch (err) {
    console.error('Query execution error:', err);
    res.status(500).json({ error: 'Failed to execute query' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Quarry API running on port ${port}`);
});

