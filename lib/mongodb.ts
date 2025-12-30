import { MongoClient, Db } from 'mongodb';

// Ensure all required environment variables are present
if (!process.env.MONGODB_URI) {
  throw new Error('Please add your MongoDB URI to .env.local');
}

if (!process.env.MONGODB_URI_PROD) {
  console.warn('Production MongoDB URI not found. Only development environment will be available.');
}

const devUri = process.env.MONGODB_URI;
const prodUri = process.env.MONGODB_URI_PROD || process.env.MONGODB_URI;
const options = {};

interface MongoClients {
  dev?: MongoClient;
  prod?: MongoClient;
}

interface MongoClientPromises {
  dev?: Promise<MongoClient>;
  prod?: Promise<MongoClient>;
}

let clients: MongoClients = {};
let clientPromises: MongoClientPromises = {};

if (process.env.NODE_ENV === 'development') {
  // In development mode, use global variables so that values
  // are preserved across module reloads caused by HMR.
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromises?: MongoClientPromises;
  };

  if (!globalWithMongo._mongoClientPromises) {
    globalWithMongo._mongoClientPromises = {};
    
    // Initialize dev client
    clients.dev = new MongoClient(devUri, options);
    globalWithMongo._mongoClientPromises.dev = clients.dev.connect();
    
    // Initialize prod client if available
    if (prodUri !== devUri) {
      clients.prod = new MongoClient(prodUri, options);
      globalWithMongo._mongoClientPromises.prod = clients.prod.connect();
    } else {
      globalWithMongo._mongoClientPromises.prod = globalWithMongo._mongoClientPromises.dev;
    }
  }
  
  clientPromises = globalWithMongo._mongoClientPromises;
} else {
  // In production mode, it's best to not use a global variable.
  clients.dev = new MongoClient(devUri, options);
  clientPromises.dev = clients.dev.connect();
  
  if (prodUri !== devUri) {
    clients.prod = new MongoClient(prodUri, options);
    clientPromises.prod = clients.prod.connect();
  } else {
    clientPromises.prod = clientPromises.dev;
  }
}

/**
 * Get a database connection based on environment
 * @param env The environment variable name to use, or 'dev'/'prod' directly
 * @returns Connected database instance
 */
export async function getDatabase(env: string = 'MONGODB_URI'): Promise<Db> {
  // Determine which client to use
  const clientType = env === 'MONGODB_URI_PROD' || env === 'prod' ? 'prod' : 'dev';
  
  try {
    // Make sure we have a valid client promise
    if (!clientPromises[clientType] && !clientPromises.dev) {
      throw new Error(`No MongoDB client available for ${clientType}`);
    }
    
    // Get the client promise or fall back to dev
    const clientPromise = clientPromises[clientType] || clientPromises.dev;
    
    if (!clientPromise) {
      throw new Error('No MongoDB client promise available');
    }
    
    // Wait for the connection
    const client = await clientPromise;
    
    // Simple database name selection
    let databaseName: string;
    if (clientType === 'dev') {
      databaseName = 'productowner-mode-dev';
    } else {
      databaseName = 'productowner-mode-prod';
    }
    
    console.log(`Connecting to ${clientType} database: ${databaseName}`);
    
    return client.db(databaseName);
  } catch (error) {
    console.error(`Failed to connect to ${clientType} database:`, error);
    // Fallback to dev database if prod fails and dev is available
    if (clientType === 'prod' && clientPromises.dev) {
      console.warn('Falling back to development database');
      const devClient = await clientPromises.dev;
      return devClient.db('productowner-mode-dev');
    }
    throw error;
  }
}

// Export a module-scoped MongoClient promise for dev environment
export default clientPromises.dev;