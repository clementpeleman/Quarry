cube('Customers', {
  sql_table: 'customers',
  
  measures: {
    count: {
      type: 'count',
      description: 'Total number of customers'
    }
  },
  
  dimensions: {
    id: {
      sql: 'id',
      type: 'number',
      primary_key: true
    },
    
    name: {
      sql: 'name',
      type: 'string',
      description: 'Customer full name'
    },
    
    email: {
      sql: 'email',
      type: 'string',
      description: 'Customer email address'
    },
    
    createdAt: {
      sql: 'created_at',
      type: 'time',
      description: 'Customer registration date'
    }
  }
});
