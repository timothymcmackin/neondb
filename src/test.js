require('dotenv').config();
const { Pool } = require('pg');

const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, ENDPOINT_ID } = process.env;
const URL = `postgres://${PGUSER}:${PGPASSWORD}@${PGHOST}/${PGDATABASE}?options=project%3D${ENDPOINT_ID}`;

// Hardcode ship data instead of getting it from the API to test Neon
const shipData = [
  {symbol: 'SHIP-1',  role: 'COMMAND',   cargoCapacity: 60, orders: 'deliver,mine'},
  {symbol: 'SHIP-10', role: 'EXCAVATOR', cargoCapacity: 60, orders: 'mine'},
  {symbol: 'SHIP-11', role: 'EXCAVATOR', cargoCapacity: 60, orders: 'mine'},
  {symbol: 'SHIP-2',  role: 'SATELLITE', cargoCapacity:  0, orders: 'monitor'},
  {symbol: 'SHIP-3',  role: 'EXCAVATOR', cargoCapacity: 30, orders: 'mine'},
  {symbol: 'SHIP-4',  role: 'EXCAVATOR', cargoCapacity: 30, orders: 'mine'},
  {symbol: 'SHIP-5',  role: 'EXCAVATOR', cargoCapacity: 30, orders: 'mine'},
  {symbol: 'SHIP-6',  role: 'EXCAVATOR', cargoCapacity: 60, orders: 'survey,mine'},
  {symbol: 'SHIP-7',  role: 'EXCAVATOR', cargoCapacity: 60, orders: 'survey,mine'},
];

const pool = new Pool({
  connectionString: URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function getPostgresVersion() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT version()');
    console.log(res.rows[0]);
  } finally {
    client.release();
  }
}

async function initDatabase() {
  const client = await pool.connect();
  try {
    const currentTablesResponse = await client.query(`SELECT *
      FROM pg_catalog.pg_tables
      WHERE schemaname != 'pg_catalog' AND
          schemaname != 'information_schema';`);
    const currentTables = currentTablesResponse.rows.map(({tablename}) => tablename);
    console.log('Current tables:', JSON.stringify(currentTables, null, 2));

    // Create a table to keep track of ships
    if (currentTables.includes('ships')) {
      await client.query('DROP TABLE ships');
    }
    // Should use a date data type for lastActive
    const createShipsTable = `CREATE TABLE ships (
      symbol varchar(255) NOT NULL,
      role varchar(255),
      cargoCapacity int,
      lastActive varchar(255),
      orders varchar(255),
      PRIMARY KEY (symbol)
    )`;
    await client.query(createShipsTable);

  } catch (error) {
    console.log(error);

  } finally {
    client.release();
  }
}

async function addData() {
  const client = await pool.connect();
  try {
    // add ship data
    await client.query('BEGIN')
    await Promise.all(shipData.map(({ symbol, role, cargoCapacity, orders }) =>
      client.query(`INSERT INTO ships (symbol, role, cargoCapacity, orders) VALUES ('${symbol}', '${role}', ${cargoCapacity}, '${orders}');`)
    ));
    await client.query('COMMIT');

  } catch (error) {
    console.log(error);
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }

}

getPostgresVersion()
  .then(initDatabase)
  .then(addData)
  .then(() => pool.end())