# Cube.js Integration in Quarry

## Setup

De Cube.js service is toegevoegd aan de Docker compose configuratie en draait op poort `:4545`.

### Services

```yaml
cubejs:
  image: cubejs/cube:latest
  ports:
    - "4545:4000"  # Cube API toegankelijk op http://localhost:4545
  environment:
    CUBEJS_DB_TYPE: postgres
    CUBEJS_DB_HOST: db
    CUBEJS_API_SECRET: quarry_cube_secret_key_min_32_chars_long
```

### Backend Dependencies

Toegevoegd aan `backend/package.json`:
- `jsonwebtoken` - Voor JWT signing bij Cube API calls
- `node-fetch` - Voor HTTP requests naar Cube

### Frontend Dependencies

Toegevoegd aan `frontend/package.json`:
- `@cubejs-client/core` - Cube.js JavaScript SDK

## Cube Schema Files

Locatie: `/cube/model/`

Initiële cubes:
- `Customers.js` - Customer data cube
- `Orders.js` - Orders cube met measures (count, totalAmount, averageAmount)
- `Products.js` - Products cube met price measures

## API Endpoints

### Backend (http://localhost:4000)

1. **GET `/api/cube/meta`**
   - Proxy naar Cube.js metadata endpoint
   - Returns: Beschikbare cubes, measures, dimensions

2. **POST `/api/cube/load`**
   - Proxy naar Cube.js query endpoint
   - Body: `{ measures, dimensions, filters, etc. }`
   - Returns: Query results

3. **POST `/api/cube/sync`**
   - Sync Quarry metrics → Cube schemas
   - Reads `metrics`, `relationships`, `column_metadata` tables
   - Generates Cube schema files in `cube/model/generated/`

## Frontend Integration

### Cube Client

Locatie: `frontend/src/lib/cube/client.ts`

Functies:
- `getCubeClient()` - Singleton Cube.js client instance
- `executeCubeQuery(query)` - Execute Cube query
- `getCubeMeta()` - Fetch metadata
- `sqlToCubeQuery(sql)` - Basic SQL → Cube query converter

### SqlCell Toggle

In `SqlCell.tsx` is een toggle toegevoegd:
- **🖥️ Local** - DuckDB WASM (client-side)
- **☁️ Cube** - Cube.js semantic layer (server-side)

## Usage

### Start Services

```bash
cd /root/Quarry
docker compose up -d
```

Services starten:
- PostgreSQL: `:5432`
- Backend API: `:4000`
- Frontend: `:3000`
- Collab WS: `:1234`
- **Cube.js**: `:4545`

### Install Dependencies

```bash
# Backend
cd backend && npm install

# Frontend  
cd frontend && npm install
```

### Sync Metrics to Cube

```bash
curl -X POST http://localhost:4000/api/cube/sync
```

Dit genereert schema files in `cube/model/generated/` based op Quarry's metrics tables.

### Query via Cube

In de frontend, selecteer **☁️ Cube** mode in een SQL cell en voer een query uit.

Huidige implementatie toont Cube query results in console. Volgende stappen:
- Resultaat integratie in DataCanvas state
- Pre-aggregation setup
- Schema browser met Cube metadata
- Native Cube query builder UI

## Cube.js Playground

Cube heeft een ingebouwde development UI:

http://localhost:4545

(Alleen in dev mode met `CUBEJS_DEV_MODE=true`)

## Environment Variables

Voor productie, stel deze in:

```env
# Backend
CUBE_API_URL=http://cubejs:4000
CUBE_API_SECRET=<your-secret-min-32-chars>

# Frontend
NEXT_PUBLIC_CUBE_API_URL=http://localhost:4000
```

## Next Steps

1. **Installeer dependencies**: `npm install` in backend en frontend
2. **Start services**: `docker compose up -d`
3. **Test Cube health**: `curl http://localhost:4545/readyz`
4. **Sync schemas**: `curl -X POST http://localhost:4000/api/cube/sync`
5. **Open frontend**: http://localhost:3000/canvas
6. **Toggle Cube mode** in een SQL cell en test!
