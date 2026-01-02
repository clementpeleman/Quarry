# Quarry Platform - Technical Walkthrough

## Overview

Quarry is an **Open Source Canvas-Based Business Intelligence Platform** built with:
- **Next.js 15** - React framework
- **React Flow** - Canvas/node-based UI
- **DuckDB WASM** - Client-side SQL execution
- **WebSockets** - Real-time collaboration

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐  │
│  │   SqlCell      │  │   TextCell     │  │   ChartCell   │  │
│  │ (Monaco Editor)│  │  (Markdown)    │  │  (ECharts)    │  │
│  └───────┬────────┘  └───────┬────────┘  └───────┬───────┘  │
│          │                   │                   │          │
│          └───────────────────┼───────────────────┘          │
│                              ▼                              │
│                    ┌─────────────────┐                      │
│                    │   DataCanvas    │                      │
│                    │ (React Flow)    │                      │
│                    └────────┬────────┘                      │
│                             │                               │
│          ┌──────────────────┼──────────────────┐            │
│          ▼                  ▼                  ▼            │
│  ┌───────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │ DuckDB WASM   │  │    useYjs    │  │  Local State   │   │
│  │ (SQL Engine)  │  │  (WebSocket) │  │  (React)       │   │
│  └───────────────┘  └──────┬───────┘  └────────────────┘   │
└─────────────────────────────┼───────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  WebSocket      │
                    │  Server         │
                    │  (Node.js)      │
                    └─────────────────┘
```

---

## Key Components

### 1. DataCanvas (`src/components/canvas/DataCanvas.tsx`)

The main orchestration component. Responsibilities:

| Function | Description |
|----------|-------------|
| `handleNodesChange` | Applies local changes + syncs positions to collaborators |
| `handleRunQuery` | Resolves `{{cell_id}}` dependencies, runs SQL, syncs previews |
| `onConnect` | Creates edges + syncs to collaborators |
| `nodesWithCallback` | Injects `onRun` callback into SQL/Chart nodes |

**State Management:**
- Uses `useNodesState` and `useEdgesState` for local state
- `useYjs` hook for collaboration sync
- All data (results) stays local; only positions/edges/previews sync

---

### 2. useYjs Hook (`src/lib/collab/useYjs.ts`)

Manages WebSocket connection and sync callbacks.

```typescript
return {
  isSynced,          // Connection status
  users,             // Connected user count
  syncPosition,      // Send position update
  syncEdge,          // Send edge creation
  syncPreview,       // Send query result preview
  onRemotePositionChange,  // Receive position updates
  onRemoteEdgeChange,      // Receive edge creations
  onRemotePreviewChange    // Receive query previews
};
```

**Message Protocol:**
```json
{ "type": "position", "nodeId": "sql-1", "position": { "x": 100, "y": 200 } }
{ "type": "edge", "edge": { "id": "e123", "source": "sql-1", "target": "sql-2" } }
{ "type": "preview", "nodeId": "sql-1", "preview": { "columns": [...], "rows": [...], "totalRows": 10 } }
```

---

### 3. WebSocket Server (`server/websocket.mjs`)

Simple broadcast server using `ws` package.

**Key Logic:**
```javascript
if (msg.type === 'position' || msg.type === 'edge' || msg.type === 'preview') {
  // Broadcast to all other clients in the room
  rooms.get(roomName)?.forEach((client) => {
    if (client !== ws) client.send(JSON.stringify(msg));
  });
}
```

**Room-based:** Clients connect to `/roomName` (e.g., `ws://localhost:1234/demo`)

---

### 4. DuckDB Engine (`src/lib/query/DuckDBEngine.ts`)

Singleton wrapper for DuckDB WASM.

| Method | Description |
|--------|-------------|
| `init()` | Initializes DuckDB with Web Workers |
| `query(sql)` | Executes SQL, returns `{ columns, rows }` |
| `createTableFromJSON(name, data)` | Creates temp table from JS objects |

**Cell Chaining:** When you write `SELECT * FROM {{sql-1}}`, DataCanvas:
1. Parses `{{sql-1}}` → extracts dependency
2. Gets results from `sql-1` node
3. Calls `createTableFromJSON('sql_1', results)`
4. Replaces `{{sql-1}}` with `sql_1` in SQL
5. Executes against DuckDB

---

### 5. Cell Components

#### SqlCell (`src/components/canvas/nodes/SqlCell.tsx`)
- Monaco Editor for SQL editing
- "Run" button triggers `onRun` callback
- Displays results table or preview from collaborators

#### ChartCell (`src/components/canvas/nodes/ChartCell.tsx`)
- ECharts for visualization
- Can execute SQL queries for dynamic data
- Supports bar, line, pie, bigNumber chart types

#### TextCell (`src/components/canvas/nodes/TextCell.tsx`)
- Simple Markdown text display

---

## Collaboration Flow

```
┌─────────── User A ───────────┐     ┌─────────── User B ───────────┐
│                              │     │                              │
│  1. Drags node               │     │                              │
│     ↓                        │     │                              │
│  2. handleNodesChange fires  │     │                              │
│     ↓                        │     │                              │
│  3. syncPosition() called    │────►│  4. onRemotePositionChange   │
│                              │     │     ↓                        │
│                              │     │  5. setNodes() updates UI    │
│                              │     │                              │
│  6. Runs SQL query           │     │                              │
│     ↓                        │     │                              │
│  7. DuckDB executes locally  │     │                              │
│     ↓                        │     │                              │
│  8. syncPreview() called     │────►│  9. onRemotePreviewChange    │
│                              │     │     ↓                        │
│                              │     │  10. Shows "Preview:" UI     │
└──────────────────────────────┘     └──────────────────────────────┘
```

---

## Running the Project

```bash
# Install dependencies
npm install

# Run both dev server and collab server
npm run dev:all

# Or separately:
npm run dev      # Next.js on :3000
npm run collab   # WebSocket on :1234
```

**Test Collaboration:**
1. Open `http://localhost:3000/canvas` in two tabs
2. Click "Go Live" in both
3. Drag nodes / connect nodes / run queries
4. Watch changes sync in real-time

---

## File Structure

```
Quarry/
├── src/
│   ├── app/
│   │   ├── page.tsx           # Landing page
│   │   └── canvas/page.tsx    # Canvas route
│   ├── components/
│   │   └── canvas/
│   │       ├── DataCanvas.tsx     # Main canvas orchestrator
│   │       └── nodes/
│   │           ├── SqlCell.tsx    # SQL editor node
│   │           ├── ChartCell.tsx  # Visualization node
│   │           └── TextCell.tsx   # Text/markdown node
│   └── lib/
│       ├── query/
│       │   └── DuckDBEngine.ts    # DuckDB WASM wrapper
│       └── collab/
│           └── useYjs.ts          # WebSocket collaboration hook
├── server/
│   └── websocket.mjs              # Collaboration server
└── package.json
```
