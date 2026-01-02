interface DuckDBState {
  db: any;
  conn: any;
  isInitialized: boolean;
}

class DuckDBEngine {
  private static instance: DuckDBEngine;
  private state: DuckDBState = {
    db: null,
    conn: null,
    isInitialized: false,
  };
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): DuckDBEngine {
    if (!DuckDBEngine.instance) {
      DuckDBEngine.instance = new DuckDBEngine();
    }
    return DuckDBEngine.instance;
  }

  public async init(): Promise<void> {
    if (this.state.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const duckdb = await import('@duckdb/duckdb-wasm');
      const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

      // Select bundle based on browser capabilities
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
      
      const worker = await duckdb.createWorker(bundle.mainWorker!);
      const logger = new duckdb.ConsoleLogger();
      
      const db = new duckdb.AsyncDuckDB(logger, worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      
      const conn = await db.connect();
      
      this.state = {
        db,
        conn,
        isInitialized: true,
      };

      console.log('🦆 DuckDB Initialized');
    })();

    return this.initPromise;
  }

  public async query(sql: string): Promise<{ columns: string[]; rows: unknown[][] }> {
    if (!this.state.isInitialized || !this.state.conn) {
      await this.init();
    }

    const result = await this.state.conn!.query(sql);
    
    // Convert Apache Arrow result to simple JSON
    const columns = result.schema.fields.map((f: any) => f.name);
    const rows = result.toArray().map((row: any) => row.toArray());

    return { columns, rows };
  }

  public async createTableFromJSON(tableName: string, data: Record<string, unknown>[]): Promise<void> {
    if (!this.state.isInitialized || !this.state.db) {
      await this.init();
    }
    
    // Check if table exists and drop it
    await this.state.conn!.query(`DROP TABLE IF EXISTS ${tableName}`);
    
    // Register file (simulated)
    const jsonContent = JSON.stringify(data);
    await this.state.db!.registerFileText(`${tableName}.json`, jsonContent);
    
    // Create table from JSON
    await this.state.conn!.query(`
      CREATE TABLE ${tableName} AS 
      SELECT * FROM read_json_auto('${tableName}.json')
    `);
  }

  /**
   * Load a .duckdb file from an ArrayBuffer
   */
  public async loadDatabaseFile(buffer: ArrayBuffer, filename: string = 'uploaded.duckdb'): Promise<string[]> {
    if (!this.state.isInitialized || !this.state.db) {
      await this.init();
    }

    // Register the file in DuckDB's virtual filesystem
    const uint8Array = new Uint8Array(buffer);
    await this.state.db!.registerFileBuffer(filename, uint8Array);
    
    // Attach the database (READ_ONLY since we can't persist changes anyway)
    await this.state.conn!.query(`ATTACH '${filename}' AS uploaded (READ_ONLY)`);
    
    // Set search path so tables in 'uploaded' are directly accessible
    await this.state.conn!.query(`SET search_path = 'uploaded,main'`);
    
    // Get list of tables in the uploaded database
    const result = await this.query(`
      SELECT table_name FROM uploaded.information_schema.tables 
      WHERE table_schema = 'main'
    `);
    const tables = result.rows.map(row => row[0] as string);
    
    console.log(`Loaded database file: ${filename}. Tables: ${tables.join(', ')}`);
    return tables;
  }

  /**
   * Load a CSV file from an ArrayBuffer
   */
  public async loadCSVFile(buffer: ArrayBuffer, tableName: string): Promise<void> {
    if (!this.state.isInitialized || !this.state.db) {
      await this.init();
    }

    const filename = `${tableName}.csv`;
    const uint8Array = new Uint8Array(buffer);
    await this.state.db!.registerFileBuffer(filename, uint8Array);
    
    await this.state.conn!.query(`DROP TABLE IF EXISTS ${tableName}`);
    await this.state.conn!.query(`
      CREATE TABLE ${tableName} AS 
      SELECT * FROM read_csv_auto('${filename}')
    `);
    
    console.log(`🦆 Loaded CSV as table: ${tableName}`);
  }

  /**
   * Load a Parquet file from an ArrayBuffer
   */
  public async loadParquetFile(buffer: ArrayBuffer, tableName: string): Promise<void> {
    if (!this.state.isInitialized || !this.state.db) {
      await this.init();
    }

    const filename = `${tableName}.parquet`;
    const uint8Array = new Uint8Array(buffer);
    await this.state.db!.registerFileBuffer(filename, uint8Array);
    
    await this.state.conn!.query(`DROP TABLE IF EXISTS ${tableName}`);
    await this.state.conn!.query(`
      CREATE TABLE ${tableName} AS 
      SELECT * FROM read_parquet('${filename}')
    `);
    
    console.log(`🦆 Loaded Parquet as table: ${tableName}`);
  }

  /**
   * Get list of tables in the database
   */
  public async getTables(): Promise<string[]> {
    const result = await this.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
    `);
    return result.rows.map(row => row[0] as string);
  }
}

export const duckDB = DuckDBEngine.getInstance();

