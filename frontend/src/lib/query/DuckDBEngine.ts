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

      // Create sample data
      await this.createSampleData();

      console.log('DuckDB initialized with sample data');
    })();

    return this.initPromise;
  }

  private async createSampleData(): Promise<void> {
    const conn = this.state.conn;
    if (!conn) return;

    // Customers table
    await conn.query(`
      CREATE TABLE customers (
        id INTEGER PRIMARY KEY,
        name VARCHAR,
        email VARCHAR,
        country VARCHAR,
        created_at DATE
      )
    `);

    await conn.query(`
      INSERT INTO customers VALUES
        (1, 'Alice Johnson', 'alice@example.com', 'USA', '2023-01-15'),
        (2, 'Bob Smith', 'bob@example.com', 'Canada', '2023-02-20'),
        (3, 'Clara Martinez', 'clara@example.com', 'Mexico', '2023-03-10'),
        (4, 'David Lee', 'david@example.com', 'USA', '2023-04-05'),
        (5, 'Eva Brown', 'eva@example.com', 'UK', '2023-05-12'),
        (6, 'Frank Wilson', 'frank@example.com', 'Germany', '2023-06-18'),
        (7, 'Grace Kim', 'grace@example.com', 'South Korea', '2023-07-22'),
        (8, 'Henry Chen', 'henry@example.com', 'China', '2023-08-30'),
        (9, 'Iris Patel', 'iris@example.com', 'India', '2023-09-14'),
        (10, 'Jack Thompson', 'jack@example.com', 'Australia', '2023-10-25')
    `);

    // Products table
    await conn.query(`
      CREATE TABLE products (
        id INTEGER PRIMARY KEY,
        name VARCHAR,
        category VARCHAR,
        price DECIMAL(10,2),
        stock INTEGER
      )
    `);

    await conn.query(`
      INSERT INTO products VALUES
        (1, 'Laptop Pro', 'Electronics', 1299.99, 50),
        (2, 'Wireless Mouse', 'Electronics', 29.99, 200),
        (3, 'USB-C Hub', 'Electronics', 49.99, 150),
        (4, 'Standing Desk', 'Furniture', 599.00, 30),
        (5, 'Ergonomic Chair', 'Furniture', 449.00, 25),
        (6, 'Monitor 27"', 'Electronics', 349.99, 75),
        (7, 'Keyboard Mechanical', 'Electronics', 129.99, 100),
        (8, 'Webcam HD', 'Electronics', 79.99, 120),
        (9, 'Desk Lamp', 'Furniture', 39.99, 80),
        (10, 'Notebook Set', 'Office', 12.99, 300)
    `);

    // Orders table
    await conn.query(`
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        customer_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        total DECIMAL(10,2),
        status VARCHAR,
        order_date DATE
      )
    `);

    await conn.query(`
      INSERT INTO orders VALUES
        (1, 1, 1, 1, 1299.99, 'delivered', '2024-01-05'),
        (2, 1, 2, 2, 59.98, 'delivered', '2024-01-05'),
        (3, 2, 4, 1, 599.00, 'delivered', '2024-01-10'),
        (4, 3, 6, 2, 699.98, 'shipped', '2024-01-15'),
        (5, 4, 1, 1, 1299.99, 'delivered', '2024-01-20'),
        (6, 5, 5, 1, 449.00, 'processing', '2024-01-25'),
        (7, 6, 3, 3, 149.97, 'delivered', '2024-02-01'),
        (8, 7, 7, 1, 129.99, 'shipped', '2024-02-05'),
        (9, 8, 8, 2, 159.98, 'delivered', '2024-02-10'),
        (10, 9, 10, 5, 64.95, 'delivered', '2024-02-15'),
        (11, 10, 2, 1, 29.99, 'processing', '2024-02-20'),
        (12, 1, 9, 2, 79.98, 'delivered', '2024-02-25'),
        (13, 2, 7, 1, 129.99, 'shipped', '2024-03-01'),
        (14, 3, 1, 1, 1299.99, 'processing', '2024-03-05'),
        (15, 4, 6, 1, 349.99, 'delivered', '2024-03-10'),
        (16, 5, 4, 1, 599.00, 'delivered', '2024-03-15'),
        (17, 6, 8, 1, 79.99, 'shipped', '2024-03-20'),
        (18, 7, 5, 1, 449.00, 'processing', '2024-03-25'),
        (19, 8, 3, 2, 99.98, 'delivered', '2024-03-30'),
        (20, 9, 2, 3, 89.97, 'delivered', '2024-04-01')
    `);
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

