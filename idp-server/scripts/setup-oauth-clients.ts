// idp-server/scripts/setup-oauth-clients.ts
// Direct PostgreSQL connection to create and seed oauth_clients table

import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Error: Supabase credentials not configured");
  console.error("   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY");
  process.exit(1);
}

// Parse Supabase URL to get host
// Format: https://PROJECT_ID.supabase.co -> PROJECT_ID.supabase.co
const urlParts = supabaseUrl.replace('https://', '').replace('http://', '');
const host = urlParts.replace(/\/$/, '');
const dbName = 'postgres'; // Default Supabase database
const user = 'postgres';

// Supabase connection string format can be found in project settings
// For now, we'll try to construct it or user must provide DATABASE_URL
const connectionString = process.env.DATABASE_URL ||
  `postgresql://${user}:${supabaseKey}@${host}:5432/${dbName}`;

async function setupOAuthClients() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('📦 OAuth Clients Setup Script');
    console.log('============================\n');
    
    console.log('Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Read the SQL file
    const sqlPath = path.join(__dirname, '../migrations/001_phase0_oauth_schema.sql');
    if (!fs.existsSync(sqlPath)) {
      console.error(`❌ Migration file not found: ${sqlPath}`);
      process.exit(1);
    }

    const fullSql = fs.readFileSync(sqlPath, 'utf-8');

    // First, just try to create the table
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS oauth_clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id TEXT UNIQUE NOT NULL,
        client_secret_hash TEXT NOT NULL,
        client_name TEXT,
        allowed_redirect_uris TEXT[] NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(client_id);
      CREATE INDEX IF NOT EXISTS idx_oauth_clients_active ON oauth_clients(is_active);
    `;

    console.log('📝 Creating oauth_clients table...');
    await client.query(createTableSql);
    console.log('✅ Table created!\n');

    // Now seed the test data
    console.log('🌱 Seeding test data...');
    const seedSql = `
      INSERT INTO oauth_clients (client_id, client_secret_hash, client_name, allowed_redirect_uris, is_active)
      VALUES 
        ('client-a', 'test_secret_hash_a', 'Client App A', ARRAY['http://localhost:3001/api/auth/callback', 'http://localhost:3001/login'], true),
        ('client-b', 'test_secret_hash_b', 'Client App B', ARRAY['http://localhost:3002/api/auth/callback', 'http://localhost:3002/login'], true),
        ('client-inactive', 'test_secret_hash_inactive', 'Inactive Test Client', ARRAY['http://localhost:3001/api/auth/callback'], false)
      ON CONFLICT (client_id) DO UPDATE SET 
        client_secret_hash = EXCLUDED.client_secret_hash,
        client_name = EXCLUDED.client_name,
        allowed_redirect_uris = EXCLUDED.allowed_redirect_uris,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();
    `;

    const result = await client.query(seedSql);
    console.log('✅ Test data seeded!\n');

    // Verify
    console.log('📋 Verifying data...');
    const verifyResult = await client.query('SELECT * FROM oauth_clients ORDER BY created_at;');
    console.log(`✅ Found ${verifyResult.rows.length} oauth clients:\n`);
    
    verifyResult.rows.forEach(row => {
      console.log(`  • ${row.client_id} (active: ${row.is_active})`);
    });

    console.log('\n✅ OAuth clients setup complete!');
  } catch (error: any) {
    if (error.message?.includes('password authentication failed')) {
      console.error('❌ Password authentication failed');
      console.error('   The SUPABASE_SERVICE_KEY may not be the correct PostgreSQL password');
      console.error('   Please set DATABASE_URL environment variable with the correct PostgreSQL connection string');
      console.error('   Example: postgresql://postgres:YOUR_PASSWORD@host:5432/postgres');
    } else {
      console.error('❌ Setup failed:', error.message);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupOAuthClients();
