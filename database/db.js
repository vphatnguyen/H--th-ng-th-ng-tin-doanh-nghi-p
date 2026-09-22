require('dotenv').config();
const path = require('path');
const fs = require('fs');

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DB_TYPE = (process.env.DB_TYPE || (isServerless ? 'sqlite' : 'mssql')).toLowerCase();

let sqlServerPool = null;
let sqliteDb = null;
let activeEngine = 'none'; // 'mssql' or 'sqlite'

// ========== MSSQL IMPLEMENTATION ==========
async function initSqlServer() {
  const sql = require('mssql/msnodesqlv8');
  const server = process.env.DB_SERVER || 'localhost\\SQLEXPRESS';
  const database = process.env.DB_DATABASE || 'CosmeticsCRM_DB';

  let connConfig;
  if (process.env.DB_USER && process.env.DB_PASSWORD) {
    connConfig = {
      server,
      database,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      options: {
        encrypt: false,
        trustServerCertificate: true
      }
    };
  } else {
    // Windows Authentication qua ODBC
    const connStr = `Driver={ODBC Driver 18 for SQL Server};Server=${server};Database=${database};Trusted_Connection=yes;TrustServerCertificate=yes;`;
    connConfig = { connectionString: connStr };
  }

  const pool = new sql.ConnectionPool(connConfig);
  await pool.connect();
  return pool;
}

function formatSqlForMssql(query, params) {
  let paramIndex = 0;
  const paramMap = {};
  const formattedSql = query.replace(/\?/g, () => {
    const pName = `arg_${paramIndex}`;
    paramMap[pName] = params[paramIndex];
    paramIndex++;
    return `@${pName}`;
  });
  return { formattedSql, paramMap };
}

// ========== SQLITE FALLBACK IMPLEMENTATION ==========
const DB_PATH = isServerless
  ? path.join(require('os').tmpdir(), 'cosmetics_crm.db')
  : path.join(__dirname, 'cosmetics_crm.db');

async function initSqlite() {
  const initSqlJs = require('sql.js');
  let wasmBinary = null;
  const localWasm = path.join(__dirname, 'sql-wasm.wasm');
  const nodeModulesWasm = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');

  if (fs.existsSync(localWasm)) {
    wasmBinary = fs.readFileSync(localWasm);
  } else if (fs.existsSync(nodeModulesWasm)) {
    wasmBinary = fs.readFileSync(nodeModulesWasm);
  }

  const SQL = await initSqlJs(wasmBinary ? { wasmBinary } : {});
  let dbInstance = null;

  if (fs.existsSync(DB_PATH)) {
    try {
      const buffer = fs.readFileSync(DB_PATH);
      dbInstance = new SQL.Database(buffer);
    } catch {
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }
  return dbInstance;
}

function saveSqliteDb() {
  if (!sqliteDb) return;
  try {
    const data = sqliteDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (err) {
    console.warn('Cảnh báo khi lưu SQLite:', err.message);
  }
}

// ========== UNIFIED DATABASE ADAPTER ==========
const db = {
  get engine() {
    return activeEngine;
  },

  async init() {
    if (activeEngine !== 'none') return db;

    if (DB_TYPE === 'mssql' && !isServerless) {
      try {
        console.log(`Đang kết nối Microsoft SQL Server (${process.env.DB_SERVER || 'PHAZT\\SQLEXPRESS'})...`);
        sqlServerPool = await initSqlServer();
        activeEngine = 'mssql';
        console.log('✅ Đã kết nối thành công tới Microsoft SQL Server: CosmeticsCRM_DB');
        return db;
      } catch (err) {
        console.warn('⚠️ Không thể kết nối SQL Server, chuyển sang SQLite dự phòng:', err.message);
      }
    }

    // Fallback SQLite
    console.log('Đang khởi tạo SQLite Database...');
    sqliteDb = await initSqlite();
    activeEngine = 'sqlite';
    console.log('✅ Đã kết nối SQLite Database');
    return db;
  },

  prepare(sqlQuery) {
    return {
      async get(...args) {
        const params = args.flat();
        if (activeEngine === 'mssql') {
          const { formattedSql, paramMap } = formatSqlForMssql(sqlQuery, params);
          const req = sqlServerPool.request();
          for (const [key, val] of Object.entries(paramMap)) {
            req.input(key, val === undefined ? null : val);
          }
          const res = await req.query(formattedSql);
          return res.recordset && res.recordset.length > 0 ? res.recordset[0] : undefined;
        } else {
          const stmt = sqliteDb.prepare(sqlQuery);
          try {
            if (params.length > 0) stmt.bind(params);
            if (stmt.step()) return stmt.getAsObject();
            return undefined;
          } finally {
            stmt.free();
          }
        }
      },

      async all(...args) {
        const params = args.flat();
        if (activeEngine === 'mssql') {
          const { formattedSql, paramMap } = formatSqlForMssql(sqlQuery, params);
          const req = sqlServerPool.request();
          for (const [key, val] of Object.entries(paramMap)) {
            req.input(key, val === undefined ? null : val);
          }
          const res = await req.query(formattedSql);
          return res.recordset || [];
        } else {
          const stmt = sqliteDb.prepare(sqlQuery);
          try {
            if (params.length > 0) stmt.bind(params);
            const rows = [];
            while (stmt.step()) {
              rows.push(stmt.getAsObject());
            }
            return rows;
          } finally {
            stmt.free();
          }
        }
      },

      async run(...args) {
        const params = args.flat();
        if (activeEngine === 'mssql') {
          const isInsert = /^\s*INSERT\s+INTO/i.test(sqlQuery);
          let wrappedSql = sqlQuery;
          if (isInsert && !/SELECT\s+.*SCOPE_IDENTITY/i.test(sqlQuery)) {
            wrappedSql += '; SELECT CAST(SCOPE_IDENTITY() AS INT) AS lastInsertRowid, @@ROWCOUNT AS changes;';
          } else if (!/SELECT\s+.*@@ROWCOUNT/i.test(sqlQuery)) {
            wrappedSql += '; SELECT CAST(0 AS INT) AS lastInsertRowid, @@ROWCOUNT AS changes;';
          }

          const { formattedSql, paramMap } = formatSqlForMssql(wrappedSql, params);
          const req = sqlServerPool.request();
          for (const [key, val] of Object.entries(paramMap)) {
            req.input(key, val === undefined ? null : val);
          }
          const res = await req.query(formattedSql);
          const info = res.recordset && res.recordset.length > 0 ? res.recordset[0] : {};
          return {
            lastInsertRowid: info.lastInsertRowid || 0,
            changes: info.changes || res.rowsAffected?.[0] || 0
          };
        } else {
          const stmt = sqliteDb.prepare(sqlQuery);
          try {
            if (params.length > 0) stmt.bind(params);
            stmt.step();
          } finally {
            stmt.free();
          }
          const info = sqliteDb.exec("SELECT last_insert_rowid() AS id, changes() AS chg");
          let lastInsertRowid = 0;
          let changes = 0;
          if (info.length > 0 && info[0].values.length > 0) {
            lastInsertRowid = info[0].values[0][0];
            changes = info[0].values[0][1];
          }
          saveSqliteDb();
          return { lastInsertRowid, changes };
        }
      }
    };
  },

  async close() {
    if (sqlServerPool) {
      await sqlServerPool.close();
      sqlServerPool = null;
    }
    if (sqliteDb) {
      saveSqliteDb();
      sqliteDb.close();
      sqliteDb = null;
    }
    activeEngine = 'none';
  }
};

module.exports = db;
