exports.up = (pgm) => {
  // Column metadata for semantic layer
  pgm.createTable('column_metadata', {
    id: 'id',
    table_name: { type: 'varchar(255)', notNull: true },
    column_name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    alias: { type: 'varchar(255)' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  });
  pgm.addConstraint('column_metadata', 'unique_table_column', {
    unique: ['table_name', 'column_name'],
  });
  pgm.createIndex('column_metadata', 'table_name');

  // Relationships between tables
  pgm.createTable('relationships', {
    id: 'id',
    from_table: { type: 'varchar(255)', notNull: true },
    from_column: { type: 'varchar(255)', notNull: true },
    to_table: { type: 'varchar(255)', notNull: true },
    to_column: { type: 'varchar(255)', notNull: true },
    relationship_type: { type: 'varchar(50)', default: 'one-to-many' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  });
  pgm.createIndex('relationships', ['from_table', 'to_table']);

  // Calculated fields / Metrics
  pgm.createTable('metrics', {
    id: 'id',
    name: { type: 'varchar(255)', notNull: true, unique: true },
    display_name: { type: 'varchar(255)' },
    description: { type: 'text' },
    table_name: { type: 'varchar(255)', notNull: true },
    expression: { type: 'text', notNull: true },
    metric_type: { type: 'varchar(50)', default: 'measure' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  });

  // Saved canvases
  pgm.createTable('canvases', {
    id: 'id',
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    nodes: { type: 'jsonb', notNull: true, default: '[]' },
    edges: { type: 'jsonb', notNull: true, default: '[]' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('canvases');
  pgm.dropTable('metrics');
  pgm.dropTable('relationships');
  pgm.dropTable('column_metadata');
};
