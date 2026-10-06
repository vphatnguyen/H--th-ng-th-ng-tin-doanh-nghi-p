require('dotenv').config();

let sqlServerPool = null;
let activeEngine = 'none';

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

const db = {
  get engine() {
    return activeEngine;
  },

  get databaseName() {
    return process.env.DB_DATABASE || 'CosmeticsCRM_DB';
  },

  async init() {
    if (activeEngine !== 'none') return db;

    console.log(`Dang ket noi Microsoft SQL Server (${process.env.DB_SERVER || 'localhost\\SQLEXPRESS'})...`);
    sqlServerPool = await initSqlServer();
    activeEngine = 'mssql';
    console.log(`Da ket noi thanh cong toi Microsoft SQL Server: ${db.databaseName}`);
    return db;
  },

  prepare(sqlQuery) {
    return {
      async get(...args) {
        const params = args.flat();
        const { formattedSql, paramMap } = formatSqlForMssql(sqlQuery, params);
        const req = sqlServerPool.request();
        for (const [key, val] of Object.entries(paramMap)) {
          req.input(key, val === undefined ? null : val);
        }
        const res = await req.query(formattedSql);
        return res.recordset && res.recordset.length > 0 ? res.recordset[0] : undefined;
      },

      async all(...args) {
        const params = args.flat();
        const { formattedSql, paramMap } = formatSqlForMssql(sqlQuery, params);
        const req = sqlServerPool.request();
        for (const [key, val] of Object.entries(paramMap)) {
          req.input(key, val === undefined ? null : val);
        }
        const res = await req.query(formattedSql);
        return res.recordset || [];
      },

      async run(...args) {
        const params = args.flat();
        const isInsert = /^\s*INSERT\s+INTO/i.test(sqlQuery);
        let wrappedSql = sqlQuery;
        if (isInsert && !/SCOPE_IDENTITY/i.test(sqlQuery)) {
          wrappedSql += '; SELECT CAST(SCOPE_IDENTITY() AS INT) AS lastInsertRowid, @@ROWCOUNT AS changes;';
        } else if (!/@@ROWCOUNT/i.test(sqlQuery)) {
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
      }
    };
  },

  async close() {
    if (sqlServerPool) {
      await sqlServerPool.close();
      sqlServerPool = null;
    }
    activeEngine = 'none';
  }
};

module.exports = db;
