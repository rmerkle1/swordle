#!/usr/bin/env node

/**
 * Database setup script for Swordle.
 *
 * Usage:
 *   npm run setup-db          # create database + run schema
 *   npm run setup-db -- --reset  # drop and recreate everything
 *
 * Reads DB connection info from .env (or .env.example defaults).
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DB_NAME = process.env.DB_NAME || 'swordle_dev';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

const reset = process.argv.includes('--reset');

async function run() {
  // 1) Connect to the default 'postgres' database to create/drop the app database
  const adminClient = new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: 'postgres',
  });

  try {
    await adminClient.connect();
    console.log('Connected to PostgreSQL server.');

    if (reset) {
      // Disconnect everyone from the target database before dropping
      await adminClient.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()
      `, [DB_NAME]);
      await adminClient.query(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
      console.log(`Dropped database "${DB_NAME}".`);
    }

    // Check if database exists
    const dbCheck = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [DB_NAME]
    );

    if (dbCheck.rows.length === 0) {
      await adminClient.query(`CREATE DATABASE "${DB_NAME}"`);
      console.log(`Created database "${DB_NAME}".`);
    } else {
      console.log(`Database "${DB_NAME}" already exists.`);
    }
  } finally {
    await adminClient.end();
  }

  // 2) Connect to the app database and run schema.sql
  const appClient = new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  try {
    await appClient.connect();
    console.log(`Connected to "${DB_NAME}".`);

    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    await appClient.query(schema);
    console.log('Schema applied successfully.');
  } finally {
    await appClient.end();
  }

  console.log('\nDatabase setup complete! You can now run: npm run dev');
}

run().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
