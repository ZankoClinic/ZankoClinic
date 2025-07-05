// ===== MYSQL DATABASE CONFIGURATION =====
const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'zanko_clinic',
    port: process.env.DB_PORT || 3306,
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Connected to MySQL database successfully');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Error connecting to MySQL database:', error.message);
        return false;
    }
}

module.exports = {
    pool,
    testConnection
};
