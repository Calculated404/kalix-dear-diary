import pg from 'pg';

const { Pool } = pg;

export function createPool() {
  const databaseUrl = process.env['DATABASE_URL'];
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  return new Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

export type { Pool, PoolClient } from 'pg';
