const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: 'c237-adib-mysql.mysql.database.azure.com',
    user: 'c237_026',
    password: 'c237026@2026!',
    database: 'c237_026_team1_gamenight',
    ssl: {
        rejectUnauthorized: false // Enforces encrypted SSL transport for Azure
    }
});

module.exports = db;