
const mysql = require('mysql2/promise');
require('dotenv').config();

async function applyMigration() {
  console.log('🔄 Starting manual migration...');
  
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log('✓ Connected to database');
    

    const [columns] = await connection.query(
      "SHOW COLUMNS FROM `Product` LIKE 'views'"
    );
    
    if (columns.length > 0) {
      console.log('⚠️  Views column already exists. Skipping migration.');
      return;
    }
    

    console.log('📝 Adding views column...');
    await connection.query(
      'ALTER TABLE `Product` ADD COLUMN `views` INT NOT NULL DEFAULT 0'
    );
    console.log('✓ Views column added');
    

    console.log('🎲 Setting random initial values (3000-17000)...');
    await connection.query(
      'UPDATE `Product` SET `views` = FLOOR(3000 + (RAND() * 14000))'
    );
    console.log('✓ Initial values set');
    

    const migrationId = 'add_views_field_' + Date.now();
    await connection.query(
      `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) 
       VALUES (?, ?, NOW(), ?, NULL, NULL, NOW(), 1)`,
      [
        migrationId,
        '', // Empty checksum for manual migration
        'add_views_field'
      ]
    );
    console.log('✓ Migration recorded in history');
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run: npx prisma generate');
    console.log('2. Restart your backend server');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await connection.end();
    console.log('✓ Database connection closed');
  }
}

applyMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
