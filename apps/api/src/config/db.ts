import mysql, { Pool, RowDataPacket } from 'mysql2/promise';

interface DatabaseRow extends RowDataPacket {
  database_name: string | null;
}

const pool: Pool = mysql.createPool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: Number(process.env.DATABASE_PORT || 3306),
  user: process.env.DATABASE_USER || 'root',
  password: process.env.DATABASE_PASSWORD || '',
  database: process.env.DATABASE_NAME || 'sigma_ucotesis',

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

export async function testDatabaseConnection(): Promise<void> {
  const connection = await pool.getConnection();

  try {
    const [rows] = await connection.query<DatabaseRow[]>(
      'SELECT DATABASE() AS database_name',
    );

    console.log(
      `✅ MySQL conectado | Base de datos: ${rows[0]?.database_name}`,
    );
  } finally {
    connection.release();
  }
}

export default pool;
