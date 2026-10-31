const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');

const base = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  decimalNumbers: true,
};
const MASTER_DB = process.env.MASTER_DB || 'mk_master';

// Master pool: companies + platform admin
const master = mysql.createPool({ ...base, database: MASTER_DB, waitForConnections: true, connectionLimit: 10 });

// One pool per company database (cached)
const tenants = new Map();
const tenantPool = (dbName) => {
  if (!tenants.has(dbName)) tenants.set(dbName, mysql.createPool({ ...base, database: dbName, waitForConnections: true, connectionLimit: 6 }));
  return tenants.get(dbName);
};
const dropTenantPool = async (dbName) => {
  const p = tenants.get(dbName);
  if (p) { tenants.delete(dbName); await p.end().catch(() => {}); }
};

// Admin connection (no default DB) used to CREATE DATABASE and run migrations
const rootConn = () => mysql.createConnection({ ...base, multipleStatements: true });

module.exports = { master, tenantPool, dropTenantPool, rootConn, MASTER_DB };
