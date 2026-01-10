cube('Products', {
  sql_table: 'products',
  
  measures: {
    count: {
      type: 'count',
      description: 'Total number of products'
    },
    
    totalPrice: {
      sql: 'price',
      type: 'sum',
      description: 'Sum of all product prices'
    },
    
    averagePrice: {
      sql: 'price',
      type: 'avg',
      description: 'Average product price'
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
      description: 'Product name'
    },
    
    category: {
      sql: 'category',
      type: 'string',
      description: 'Product category'
    },
    
    price: {
      sql: 'price',
      type: 'number',
      description: 'Product price'
    }
  }
});
