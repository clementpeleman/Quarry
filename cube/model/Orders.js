cube('Orders', {
  sql_table: 'orders',
  
  measures: {
    count: {
      type: 'count',
      description: 'Total number of orders'
    },
    
    totalAmount: {
      sql: 'total',
      type: 'sum',
      description: 'Total order amount'
    },
    
    averageAmount: {
      sql: 'total',
      type: 'avg',
      description: 'Average order amount'
    }
  },
  
  dimensions: {
    id: {
      sql: 'id',
      type: 'number',
      primary_key: true
    },
    
    status: {
      sql: 'status',
      type: 'string',
      description: 'Order status (pending, completed, shipped, processing)'
    },
    
    completedAt: {
      sql: 'completed_at',
      type: 'time',
      description: 'Order completion timestamp'
    },
    
    createdAt: {
      sql: 'created_at',
      type: 'time',
      description: 'Order creation timestamp'
    }
  },
  
  joins: {
    Customers: {
      relationship: 'many_to_one',
      sql: `${CUBE}.customer_id = ${Customers}.id`
    }
  }
});
