import { Pool } from "pg";

const globalForDb = global as unknown as { pool: Pool };

// Connection pool configuration
const poolConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: String(process.env.DB_PASSWORD || ""), // Ensure password is string
  port: Number(process.env.DB_PORT) || 5432,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection not established
  maxUses: 7500, // Close connection after 7500 queries (prevents memory leaks)
};

export const pool =
  globalForDb.pool ||
  new Pool(poolConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err);
});

// Optional: Log pool events for debugging (remove in production if not needed)
if (process.env.NODE_ENV !== "production") {
  pool.on('connect', () => {
    console.log('✅ New database client connected');
  });
  
  pool.on('remove', () => {
    console.log('🔌 Database client removed from pool');
  });
}

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

// Graceful shutdown
const closePool = async () => {
  try {
    await pool.end();
    console.log('✅ Database pool closed gracefully');
  } catch (error) {
    console.error('❌ Error closing database pool:', error);
  }
};

process.on('SIGTERM', closePool);
process.on('SIGINT', closePool);