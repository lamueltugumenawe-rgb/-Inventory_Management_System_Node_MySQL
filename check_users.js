const mysql = require('mysql2/promise');

async function check() {
  console.log('Trying to connect with password Charity@123...');
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Charity@123',
    database: 'inventory_management',
    port: 3306
  });

  const [rows] = await pool.query('SELECT * FROM users');
  console.log('\n=== ALL SYSTEM USERS ===');
  console.table(rows);
  console.log(`Total users: ${rows.length}`);
  process.exit();
}

check();