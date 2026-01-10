import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

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
// SEMANTIC LAYER API
// ============================================

// Get all column metadata
app.get('/api/metadata/columns', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM column_metadata ORDER BY table_name, column_name');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch column metadata' });
  }
});

// Update column metadata
app.put('/api/metadata/columns', async (req, res) => {
  const { table_name, column_name, description, alias } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO column_metadata (table_name, column_name, description, alias)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (table_name, column_name)
       DO UPDATE SET description = $3, alias = $4, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [table_name, column_name, description, alias]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update column metadata' });
  }
});

// Get all relationships
app.get('/api/relationships', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM relationships ORDER BY from_table');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch relationships' });
  }
});

// Create relationship
app.post('/api/relationships', async (req, res) => {
  const { from_table, from_column, to_table, to_column, relationship_type } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO relationships (from_table, from_column, to_table, to_column, relationship_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [from_table, from_column, to_table, to_column, relationship_type || 'one-to-many']
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

// Get all metrics
app.get('/api/metrics', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM metrics ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Create/update metric
app.post('/api/metrics', async (req, res) => {
  const { name, display_name, description, table_name, expression, metric_type } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO metrics (name, display_name, description, table_name, expression, metric_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (name)
       DO UPDATE SET display_name = $2, description = $3, table_name = $4, expression = $5, metric_type = $6, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [name, display_name, description, table_name, expression, metric_type || 'measure']
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
// CANVASES API
// ============================================

// Get all canvases
app.get('/api/canvases', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, description, created_at, updated_at FROM canvases ORDER BY updated_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch canvases' });
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
  const { id, name, description, nodes, edges } = req.body;
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
        `INSERT INTO canvases (name, description, nodes, edges)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [name, description, JSON.stringify(nodes), JSON.stringify(edges)]
      );
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save canvas' });
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
  } catch (err) {
    console.error('Cube load error:', err);
    res.status(500).json({ error: 'Failed to execute Cube query' });
  }
});

// Sync Quarry metrics to Cube.js schemas
app.post('/api/cube/sync', async (req, res) => {
  try {
    // Fetch all metrics and relationships from Quarry
    const metricsResult = await pool.query('SELECT * FROM metrics ORDER BY name');
    const relationshipsResult = await pool.query('SELECT * FROM relationships ORDER BY from_table');
    const columnsResult = await pool.query('SELECT * FROM column_metadata ORDER BY table_name, column_name');
    
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

// Start server
app.listen(port, () => {
  console.log(`🚀 Quarry API running on port ${port}`);
});

