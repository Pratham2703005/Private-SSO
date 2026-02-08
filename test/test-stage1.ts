import { strict as assert } from 'assert';
import { TestHttpClient } from './utils/http-client';
import { TEST_USER } from './fixtures/test-users';

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

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║    STAGE 1: IDP MASTER SESSION TESTS   ║');
  console.log('╚════════════════════════════════════════╝\n');

  const overallStartTime = Date.now();

  // Test 1: Login with valid credentials → should set auth cookie
  await runTest(1, 'Login with valid credentials', async () => {
    const client = new TestHttpClient();
    const result = await client.loginWithCredentials(
      TEST_USER.email,
      TEST_USER.password
    );
    
    assert.strictEqual(
      result.status,
      200,
      `Expected status 200, got ${result.status}`
    );
    
    const authCookies = client.getAuthCookies();
    assert.ok(
      Object.keys(authCookies).length > 0,
      `Expected at least one auth cookie (sso/session/auth/token), got: ${JSON.stringify(client.getAllCookies())}`
    );
  });

  // Test 2: Check session with cookie
  await runTest(2, 'Check session with cookie', async () => {
    const client = new TestHttpClient();
    const loginResult = await client.loginWithCredentials(
      TEST_USER.email,
      TEST_USER.password
    );
    
    assert.strictEqual(
      loginResult.status,
      200,
      `Login failed with status ${loginResult.status}`
    );
    
    const sessionResult = await client.checkSession();
    assert.strictEqual(
      sessionResult.status,
      200,
      `Expected session check status 200, got ${sessionResult.status}`
    );
  });

  // Test 3: Logout returns 200
  await runTest(3, 'Logout returns 200', async () => {
    const client = new TestHttpClient();
    await client.loginWithCredentials(TEST_USER.email, TEST_USER.password);
    
    const logoutResult = await client.logout();
    assert.strictEqual(
      logoutResult.status,
      200,
      `Expected logout status 200, got ${logoutResult.status}`
    );
  });

  // Test 4: Session fails after logout
  await runTest(4, 'Session check fails after logout', async () => {
    const client = new TestHttpClient();
    await client.loginWithCredentials(TEST_USER.email, TEST_USER.password);
    await client.logout();
    
    const sessionResult = await client.checkSession();
    assert.strictEqual(
      sessionResult.status,
      401,
      `Expected status 401 after logout, got ${sessionResult.status}`
    );
  });

  // Test 5: Login with wrong password should fail
  await runTest(5, 'Login with wrong password', async () => {
    const client = new TestHttpClient();
    const result = await client.loginWithCredentials(
      TEST_USER.email,
      'wrongpassword123'
    );
    
    assert.notStrictEqual(
      result.status,
      200,
      `Expected login to fail, but got status 200`
    );
  });

  // Test 6: Login with non-existent email should fail
  await runTest(6, 'Login with non-existent email', async () => {
    const client = new TestHttpClient();
    const result = await client.loginWithCredentials(
      'nonexistent@example.com',
      TEST_USER.password
    );
    
    assert.notStrictEqual(
      result.status,
      200,
      `Expected login to fail, but got status 200`
    );
  });

  // Test 7: Check session without cookies should fail
  await runTest(7, 'Check session without cookie', async () => {
    const client = new TestHttpClient();
    const sessionResult = await client.checkSession();
    
    assert.strictEqual(
      sessionResult.status,
      401,
      `Expected status 401 without session, got ${sessionResult.status}`
    );
  });

  // Test 8: Session check fails after logout (verify)
  await runTest(8, 'Session fails after logout (verify)', async () => {
    const client = new TestHttpClient();
    await client.loginWithCredentials(TEST_USER.email, TEST_USER.password);
    
    const authCookiesBeforeLogout = client.getAuthCookies();
    assert.ok(
      Object.keys(authCookiesBeforeLogout).length > 0,
      'Expected auth cookies after login'
    );
    
    await client.logout();
    
    // Session check should fail with 401 (session cookie cleared)
    const sessionResult = await client.checkSession();
    assert.strictEqual(
      sessionResult.status,
      401,
      `Expected status 401 after logout, got ${sessionResult.status}`
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
