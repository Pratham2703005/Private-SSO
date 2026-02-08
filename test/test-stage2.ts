import { strict as assert } from 'assert';
import axios from 'axios';
import { TestHttpClient } from './utils/http-client';
import { TEST_USER } from './fixtures/test-users';
import { OAUTH_CLIENTS, VALID_REDIRECT_URIS, INVALID_REDIRECT_URIS } from './fixtures/oauth-clients';

async function seedOAuthClients() {
  try {
    console.log('🌱 Seeding OAuth clients...');
    const response = await axios.post('http://localhost:3000/api/setup/seed-oauth-clients', {}, {
      validateStatus: () => true
    });
    
    if (response.status === 200) {
      // Check the actual seeding results
      const results = response.data.results || [];
      const allCreatedOrExists = results.every((r: any) => 
        r.status === 'created' || r.status === 'already_exists'
      );
      
      if (allCreatedOrExists) {
        console.log('✅ OAuth clients seeded successfully (results:', response.data.results.map((r: any) => `${r.clientId}:${r.status}`).join(', '), ')\n');
        return true;
      } else {
        const errors = results.filter((r: any) => r.status === 'error');
        const hasTableNotFound = errors.some((e: any) => 
          e.error?.includes("Can't find") || e.error?.includes('not found')
        );
        
        if (hasTableNotFound) {
          console.error('\n❌ SETUP REQUIRED: oauth_clients table does not exist!\n');
          console.error('   Please run: See OAUTH-CLIENTS-SETUP.md for instructions\n');
          console.error('   Quick option: Execute test/setup/oauth-clients-setup.sql');
          console.error('               in Supabase SQL Editor\n');
          return false;
        }
        
        console.log(`⚠️  Seeding had errors:`, errors, '\n');
        return false;
      }
    } else {
      console.log(`⚠️  Seeding returned status ${response.status}:`, response.data, '\n');
      return false;
    }
  } catch (error: any) {
    console.log(`⚠️  Could not seed via API: ${error.message}, continuing...\n`);
    return false;
  }
}

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(
  testNumber: number,
  testName: string,
  testFn: () => Promise<void>
): Promise<void> {
  const startTime = Date.now();
  try {
    await testFn();
    const duration = Date.now() - startTime;
    results.push({ name: testName, passed: true, duration });
    console.log(`  [✅] Test ${testNumber}: ${testName} (${duration}ms)`);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    results.push({
      name: testName,
      passed: false,
      duration,
      error: error.message
    });
    console.log(`  [❌] Test ${testNumber}: ${testName} (${duration}ms)`);
    console.log(`      Error: ${error.message}`);
  }
}

function parseQueryParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return params;
  
  const queryString = url.substring(queryStart + 1);
  queryString.split('&').forEach(pair => {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
  });
  return params;
}

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   STAGE 2: OAUTH CLIENT VALIDATION     ║');
  console.log('╚════════════════════════════════════════╝\n');

  // Seed OAuth clients before running tests
  await seedOAuthClients();

  const overallStartTime = Date.now();

  // Test 1: Unknown client rejected with invalid_client
  await runTest(1, 'Unknown client rejected', async () => {
    const client = new TestHttpClient();
    const result = await client.authorizeWithSession(
      'unknown-client',
      'http://localhost:9999/callback',
      'random-state-123'
    );

    assert.notStrictEqual(
      result.status,
      302,
      `Expected error status, but got 302 redirect (unknown client should be rejected)`
    );

    assert.strictEqual(
      result.status,
      400,
      `Expected status 400, got ${result.status}`
    );

    assert.ok(
      result.body?.error || result.locationHeader?.includes('error'),
      `Expected error response, got: ${JSON.stringify(result.body)}`
    );
  });

  // Test 2: Valid client + invalid redirect_uri rejected
  await runTest(2, 'Valid client + invalid redirect_uri rejected', async () => {
    const client = new TestHttpClient();
    const result = await client.authorizeWithSession(
      OAUTH_CLIENTS.VALID_CLIENT_A.clientId,
      INVALID_REDIRECT_URIS.WRONG_PORT,
      'random-state-456'
    );

    assert.notStrictEqual(
      result.status,
      302,
      `Expected error status, but got 302 redirect (invalid redirect_uri should be rejected)`
    );

    assert.strictEqual(
      result.status,
      400,
      `Expected status 400, got ${result.status}`
    );

    assert.ok(
      result.body?.error || result.locationHeader?.includes('error'),
      `Expected error response for invalid redirect_uri`
    );
  });

  // Test 3: Inactive client rejected
  await runTest(3, 'Inactive client rejected', async () => {
    const client = new TestHttpClient();
    const result = await client.authorizeWithSession(
      OAUTH_CLIENTS.INACTIVE_CLIENT.clientId,
      OAUTH_CLIENTS.INACTIVE_CLIENT.allowedRedirectUris[0],
      'random-state-789'
    );

    assert.notStrictEqual(
      result.status,
      302,
      `Expected error status, but got 302 redirect (inactive client should be rejected)`
    );

    assert.strictEqual(
      result.status,
      400,
      `Expected status 400, got ${result.status}`
    );

    assert.ok(
      result.body?.error || result.locationHeader?.includes('error'),
      `Expected error response for inactive client`
    );
  });

  // Test 4: Valid client + valid redirect_uri (NO session) → redirect to login
  await runTest(4, 'Valid client + valid redirect_uri (no session) → redirect to /login', async () => {
    const client = new TestHttpClient();
    const state = 'state-test-4';
    const result = await client.authorizeWithSession(
      OAUTH_CLIENTS.VALID_CLIENT_A.clientId,
      VALID_REDIRECT_URIS.CLIENT_A,
      state
    );

    assert.ok(
      result.status === 302 || result.status === 307,
      `Expected redirect status 302 or 307, got ${result.status}`
    );

    assert.ok(
      result.locationHeader,
      `Expected Location header in redirect response`
    );

    // Check that redirect goes to login page with preserved params
    assert.ok(
      result.locationHeader.includes('/login'),
      `Expected redirect to /login, got: ${result.locationHeader}`
    );

    // Parse location and check params are preserved
    const params = parseQueryParams(result.locationHeader);
    assert.strictEqual(
      params.client_id,
      OAUTH_CLIENTS.VALID_CLIENT_A.clientId,
      `Expected client_id preserved in redirect`
    );

    assert.strictEqual(
      params.redirect_uri,
      VALID_REDIRECT_URIS.CLIENT_A,
      `Expected redirect_uri preserved in redirect`
    );

    assert.strictEqual(
      params.state,
      state,
      `Expected state preserved in redirect`
    );
  });

  // Test 5: Valid client + valid redirect_uri (WITH session) → redirect to callback with state
  await runTest(5, 'Valid client + valid redirect_uri (with session) → redirect to callback', async () => {
    const client = new TestHttpClient();

    // First, login
    const loginResult = await client.loginWithCredentials(
      TEST_USER.email,
      TEST_USER.password
    );

    assert.strictEqual(
      loginResult.status,
      200,
      `Login failed with status ${loginResult.status}`
    );

    // Then, authorize with session
    const state = 'state-test-5';
    const result = await client.authorizeWithSession(
      OAUTH_CLIENTS.VALID_CLIENT_A.clientId,
      VALID_REDIRECT_URIS.CLIENT_A,
      state
    );

    assert.ok(
      result.status === 302 || result.status === 307,
      `Expected redirect status 302 or 307, got ${result.status}`
    );

    assert.ok(
      result.locationHeader,
      `Expected Location header in redirect response`
    );

    // Check that redirect goes back to client callback
    assert.ok(
      result.locationHeader.includes(VALID_REDIRECT_URIS.CLIENT_A),
      `Expected redirect to ${VALID_REDIRECT_URIS.CLIENT_A}, got: ${result.locationHeader}`
    );

    // Parse location and check state is present
    const params = parseQueryParams(result.locationHeader);
    assert.strictEqual(
      params.state,
      state,
      `Expected state=${state} in redirect location, got: ${result.locationHeader}`
    );

    // Should have either code or access_token parameter
    const hasCode = 'code' in params;
    const hasAccessToken = 'access_token' in params;
    assert.ok(
      hasCode || hasAccessToken,
      `Expected either 'code' or 'access_token' in redirect, got: ${result.locationHeader}`
    );
  });

  // Print summary
  const totalDuration = Date.now() - overallStartTime;
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║         TEST SUMMARY REPORT            ║');
  console.log('╚════════════════════════════════════════╝\n');

  results.forEach((result, index) => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} Test ${index + 1}: ${result.name}`);
    if (result.error) {
      console.log(`   └─ Error: ${result.error}`);
    }
  });

  console.log('\n' + '-'.repeat(42));
  console.log(`TOTAL: ${passedCount}/${totalCount} PASSED ${passedCount === totalCount ? '✅' : '❌'}`);
  console.log(`Execution Time: ${totalDuration}ms`);
  console.log('-'.repeat(42) + '\n');

  process.exit(passedCount === totalCount ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
