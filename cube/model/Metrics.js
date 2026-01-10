cube(`Metrics`, {
  sql_table: `metrics`,
  
  data_source: `default`,
  
  joins: {},
  
  measures: {
    count: {
      type: `count`,
      description: `Total number of metrics`,
    },
  },
  
  dimensions: {
    id: {
      sql: `id`,
      type: `number`,
      primary_key: true,
    },
    
    name: {
      sql: `name`,
      type: `string`,
      description: `Metric name`,
    },
    
    description: {
      sql: `description`,
      type: `string`,
      description: `Metric description`,
    },
    
    table_name: {
      sql: `table_name`,
      type: `string`,
      description: `Source table`,
    },
    
    column_name: {
      sql: `column_name`,
      type: `string`,
      description: `Source column`,
    },
    
    aggregation: {
      sql: `aggregation`,
      type: `string`,
      description: `Aggregation function (count, sum, avg, min, max)`,
    },
    
    created_at: {
      sql: `created_at`,
      type: `time`,
      description: `Metric creation timestamp`,
    },
    
    updated_at: {
      sql: `updated_at`,
      type: `time`,
      description: `Last update timestamp`,
    },
  },
});
