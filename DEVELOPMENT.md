# Lokale Development Setup

## Vereisten
- Node.js 20+
- Docker (alleen voor Postgres en backend services)

## Quick Start

### 1. Start alleen de essentiële services
```bash
docker compose up db backend cubejs collab -d
```

### 2. Frontend lokaal draaien
```bash
cd frontend
npm install
npm run dev
```

Nu draait frontend lokaal op http://localhost:3000 met hot reload.

### 3. Backend lokaal (optioneel)
Als je ook backend lokaal wilt:
```bash
cd backend
npm install
npm run dev
```

## Performance Tips
- Frontend lokaal = geen Docker overhead
- DuckDB WASM gebruikt browser resources, niet server
- Hot reload is veel sneller
- Gebruik browser dev tools om geheugen te monitoren

## Environment Variables
Frontend gebruikt:
- NEXT_PUBLIC_API_URL=http://localhost:4000
- NEXT_PUBLIC_WS_URL=ws://localhost:1234
