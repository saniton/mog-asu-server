// mongodb.js
const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017/upqrade';
const dbName = 'upqrade';
const collectionName = 'dataentries';

async function connectToMongoDB() {
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    await client.connect();
    console.log('Connected to the database');
    return client.db(dbName).collection(collectionName);
  } catch (error) {
    console.error('Error connecting to the database:', error);
    throw error;
  }
}

module.exports = { connectToMongoDB };
