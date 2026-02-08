import { strict as assert } from 'assert';
import axios from 'axios';
import { TestHttpClient } from './utils/http-client';
import { TEST_USER } from './fixtures/test-users';
import { OAUTH_CLIENTS, VALID_REDIRECT_URIS } from './fixtures/oauth-clients';
import { generatePKCE } from './fixtures/pkce';

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
      error: error.message,
    });
    console.log(`  [❌] Test ${testNumber}: ${testName}`);
    console.log(`      Error: ${error.message}\n`);
  }
}

// Helper to parse query params from URL
function parseQueryParams(url: string): Record<string, string> {
  try {
    const urlObj = new URL(url);
    const params: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch {
    return {};
  }
}

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════╗');
  console.log('║   STAGE 3: AUTHORIZATION CODE FLOW     ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('\n');

  const pkce = generatePKCE();
  console.log(`Generated PKCE pair for tests`);
  console.log(`  Verifier length: ${pkce.verifier.length}`);
  console.log(`  Challenge length: ${pkce.challenge.length}\n`);

  // Test 1: No session → redirect to /login with params preserved
  await runTest(
    1,
    'No session → redirect to /login with params preserved',
    async () => {
      const client = new TestHttpClient();
      const state = `state-test-1-${Date.now()}`;

      // Make authorize request without session
      const result = await client.authorizeWithSession(
        OAUTH_CLIENTS.VALID_CLIENT_A.clientId,
        VALID_REDIRECT_URIS.CLIENT_A,
        state
      );

      // Should get 307/302 redirect to /login
      assert.ok(
        result.status === 302 || result.status === 307,
        `Expected redirect status 302 or 307, got ${result.status}`
      );

      assert.ok(
        result.locationHeader,
        `Expected Location header in redirect response`
      );

      // Should redirect to /login
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

      assert.strictEqual(
        params.scopes,
        'profile,email',
        `Expected scopes preserved in redirect`
      );
    }
  );

  // Test 2: With session → redirect to callback with code + state (no access_token)
  await runTest(
    2,
    'With session → redirect to callback with code + state (no access_token)',
    async () => {
      const client = new TestHttpClient();
      const state = `state-test-2-${Date.now()}`;

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

      // Now make authorize request WITH session
      const authResult = await client.authorizeWithSession(
        OAUTH_CLIENTS.VALID_CLIENT_A.clientId,
        VALID_REDIRECT_URIS.CLIENT_A,
        state
      );

      // Should get 307/302 redirect to callback
      assert.ok(
        authResult.status === 302 || authResult.status === 307,
        `Expected redirect status 302 or 307, got ${authResult.status}`
      );

      assert.ok(
        authResult.locationHeader,
        `Expected Location header in redirect response`
      );

      // Should redirect to client callback
      assert.ok(
        authResult.locationHeader.includes(VALID_REDIRECT_URIS.CLIENT_A),
        `Expected redirect to ${VALID_REDIRECT_URIS.CLIENT_A}, got: ${authResult.locationHeader}`
      );

      // Parse location and check params
      const params = parseQueryParams(authResult.locationHeader);

      // CRITICAL: Must have code
      assert.ok(
        params.code,
        `Expected code parameter in redirect, got: ${authResult.locationHeader}`
      );

      // Code must be non-empty and look random (>= 20 chars)
      assert.ok(
        params.code.length >= 20,
        `Expected code length >= 20, got ${params.code.length}`
      );

      // Must have state
      assert.strictEqual(
        params.state,
        state,
        `Expected state preserved in redirect`
      );

      // CRITICAL: Must NOT have access_token
      assert.ok(
        !params.access_token,
        `access_token should NOT be in redirect URL (got: ${params.access_token})`
      );

      // CRITICAL: Must NOT have token_type
      assert.ok(
        !params.token_type,
        `token_type should NOT be in redirect URL`
      );

      // CRITICAL: Must NOT have expires_in
      assert.ok(
        !params.expires_in,
        `expires_in should NOT be in redirect URL`
      );

      console.log(`      [Code generated] Length: ${params.code.length}, State: ${params.state}`);
    }
  );

  // Print summary
  console.log('\n');
  console.log('╔════════════════════════════════════════╗');
  console.log('║         TEST SUMMARY REPORT            ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('\n');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  results.forEach((result) => {
    if (result.passed) {
      console.log(`✅ ${result.name}`);
    } else {
      console.log(`❌ ${result.name}`);
      if (result.error) {
        console.log(`   └─ Error: ${result.error}\n`);
      }
    }
  });

  console.log('');
  console.log('-'.repeat(40));
  console.log(
    `TOTAL: ${passed}/${results.length} PASSED ${failed > 0 ? '❌' : '✅'}`
  );
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
  console.log(`Execution Time: ${totalTime}ms`);
  console.log('-'.repeat(40));
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
