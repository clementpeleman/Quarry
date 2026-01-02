import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

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

// Start server
app.listen(port, () => {
  console.log(`🚀 Quarry API running on port ${port}`);
});

