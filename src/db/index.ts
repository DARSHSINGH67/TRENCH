// src/db/index.ts
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: Pool | undefined;
  var _drizzleDb: NodePgDatabase<typeof schema> | undefined;
}

export const isSqlDatabaseConfigured = (): boolean =>
  Boolean(
    process.env.SQL_HOST?.trim() &&
      process.env.SQL_USER?.trim() &&
      process.env.SQL_DB_NAME?.trim()
  );

// Function to create or retrieve the connection pool using the Object Method.
export const createPool = (): Pool | null => {
  if (!isSqlDatabaseConfigured()) {
    return null;
  }

  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    // Prevent unhandled pool-level errors from crashing the application
    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

// Lazily retrieve Drizzle instance only when SQL_* env vars are configured.
export const getDb = (): NodePgDatabase<typeof schema> | null => {
  if (!isSqlDatabaseConfigured()) {
    return null;
  }

  if (!global._drizzleDb) {
    const pool = createPool();
    if (!pool) return null;
    global._drizzleDb = drizzle(pool, { schema });
  }
  return global._drizzleDb;
};
