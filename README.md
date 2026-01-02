# Quarry

**Open Source Canvas-Based Business Intelligence Platform**

A modern data exploration tool that combines the power of SQL with an infinite canvas interface. Query your data, visualize results, and collaborate in real-time.

---

## Features

- **Canvas-Based Interface** - Drag-and-drop SQL cells, charts, and notes on an infinite canvas
- **In-Browser SQL Engine** - Powered by DuckDB WASM for instant client-side query execution
- **Real-Time Collaboration** - Work together with live cursors, synced queries, and shared results
- **Cell Chaining** - Reference results from other cells using `{{cell_id}}` syntax
- **Visualizations** - Built-in charting with bar, line, pie, and big number displays
- **Multiple Data Sources** - Connect to PostgreSQL, upload CSV/Parquet files, or query in-memory data

## Quick Start

```bash
# Install dependencies
npm install

# Run development server with collaboration support
npm run dev:all
```

Open [http://localhost:3000/canvas](http://localhost:3000/canvas) to start exploring.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐  │
│  │   SQL Cell     │  │   Text Cell    │  │  Chart Cell   │  │
│  └───────┬────────┘  └───────┬────────┘  └───────┬───────┘  │
│          └───────────────────┼───────────────────┘          │
│                              ▼                              │
│                    ┌─────────────────┐                      │
│                    │   DataCanvas    │                      │
│                    │ (React Flow)    │                      │
│                    └────────┬────────┘                      │
│          ┌──────────────────┼──────────────────┐            │
│          ▼                  ▼                  ▼            │
│  ┌───────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │ DuckDB WASM   │  │  WebSocket   │  │  Local State   │   │
│  │ (SQL Engine)  │  │  (Collab)    │  │  (React)       │   │
│  └───────────────┘  └──────────────┘  └────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js development server |
| `npm run collab` | Start WebSocket collaboration server |
| `npm run dev:all` | Start both servers concurrently |
| `npm run build` | Build for production |

## Project Structure

```
src/
├── app/
│   ├── canvas/           # Canvas page
│   ├── settings/         # Settings page
│   └── api/connectors/   # Database connector API routes
├── components/canvas/
│   ├── DataCanvas.tsx    # Main canvas orchestrator
│   ├── CanvasMenu.tsx    # Top menu bar
│   └── nodes/            # Cell components (SQL, Text, Chart)
└── lib/
    ├── connectors/       # Database driver framework
    ├── collab/           # Collaboration hooks
    └── query/            # DuckDB WASM wrapper

server/
└── websocket.mjs         # Collaboration WebSocket server
```

## Database Connectors

Quarry uses a driver-based architecture inspired by Metabase:

| Driver | Status | Execution |
|--------|--------|-----------|
| DuckDB WASM | Ready | Client-side |
| PostgreSQL | Ready | Server-side (API route) |
| CSV/Parquet Upload | Ready | Client-side |

## Collaboration

Enable real-time collaboration by clicking "Go Live" in the canvas. Features include:

- Node position syncing
- Edge/connection syncing
- SQL text syncing (debounced)
- Query result previews (first 5 rows)
- New node syncing

## Technology Stack

- **Framework**: Next.js 15
- **Canvas**: React Flow
- **SQL Engine**: DuckDB WASM
- **Collaboration**: WebSocket + Custom Protocol
- **Charts**: ECharts
- **Editor**: Monaco Editor

## License

AGPL-3.0

---

For detailed technical documentation, see [ARCHITECTURE.md](./ARCHITECTURE.md).
