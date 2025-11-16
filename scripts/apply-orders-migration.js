const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  const connection = await mysql.createConnection({
    host: 'lux0.mysql.tools',
    port: 3306,
    user: 'lux0_base',
    password: '7#8dEn6Sf(',
    database: 'lux0_base',
  });

  try {
    console.log('Connected to database');

    // Read migration SQL
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '..', 'prisma', 'migrations', '20251115_add_orders', 'migration.sql'),
      'utf8'
    );

    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 50) + '...');
      await connection.execute(statement);
      console.log('✓ Success');
    }

    // Mark migration as applied
    await connection.execute(`
      INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES (
        UUID(),
        '',
        NOW(),
        '20251115_add_orders',
        NULL,
        NULL,
        NOW(),
        1
      )
    `);

    console.log('\n✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

applyMigration().catch(console.error);
