
import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg; // Destructure Pool from the imported package

// Create a connection pool to handle database requests
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE, // e.g., 'rfp_management_system'
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL Database');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err);
    // In a real application, you might attempt a controlled exit or restart here
});

// Export the query function for use in your routes (using default export)
const db = {
    query: (text, params) => pool.query(text, params),
};

export default db;