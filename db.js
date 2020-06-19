const { Client } = require('pg');

exports.connect = function(){
  let client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});  
  
  client.connect()
  return client;
}