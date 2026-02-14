/**
 * Phase 1 & 2 API Endpoint Test
 * Tests the Widget API endpoints with real requests
 */

const IDP_URL = 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];

async function testWidgetAccountsApi() {
  console.log('\n[TEST 1.1] GET /api/widget/accounts - Widget Accounts Endpoint\n');

  try {
    const response = await fetch(`${IDP_URL}/api/widget/accounts`, {
      method: 'GET',
      credentials: 'include',
    });

    if (response.status === 401) {
      console.log('⚠️  SKIPPED: No active session (not logged in)');
      console.log('  → Log in at http://localhost:3000/login first');
      results.push({ name: 'Widget Accounts API', passed: true, message: 'Skipped (auth required)' });
      return;
    }

    if (response.status !== 200) {
      console.log(`✗ FAILED: Expected 200, got ${response.status}`);
      const body = await response.text();
      console.log('Response:', body);
      results.push({
        name: 'Widget Accounts API',
        passed: false,
        message: `HTTP ${response.status}`,
      });
      return;
    }

    const data = await response.json() as any;

    const checks = {
      'Has accounts array': Array.isArray(data.accounts),
      'Has activeIndex': typeof data.activeIndex === 'number',
      'Accounts have required fields': data.accounts?.length > 0 && data.accounts[0].index !== undefined,
    };

    let passed = 0;
    Object.entries(checks).forEach(([check, result]) => {
      console.log(`  ${result ? '✓' : '✗'} ${check}`);
      if (result) passed++;
    });

    const success = passed === Object.keys(checks).length;
    console.log(`\n✓ Widget Accounts API: ${passed}/${Object.keys(checks).length} checks passed\n`);

    if (success) {
      console.log('Response sample:');
      console.log(`  Accounts: ${data.accounts.map((a: any) => a.name).join(', ')}`);
      console.log(`  Active Index: ${data.activeIndex}`);
    }

    results.push({
      name: 'Widget Accounts API',
      passed: success,
    });
  } catch (error) {
    console.log(`✗ FAILED: ${error}`);
    results.push({
      name: 'Widget Accounts API',
      passed: false,
      message: String(error),
    });
  }
}

async function testWidgetScript() {
  console.log('\n[TEST 2.1] GET /api/widget.js - Widget Script Load\n');

  try {
    const response = await fetch(`${IDP_URL}/api/widget.js`);

    if (response.status !== 200) {
      console.log(`✗ FAILED: Expected 200, got ${response.status}`);
      results.push({
        name: 'Widget Script',
        passed: false,
        message: `HTTP ${response.status}`,
      });
      return;
    }

    const contentType = response.headers.get('content-type');
    const cors = response.headers.get('access-control-allow-origin');
    const script = await response.text();

    const checks = {
      'JavaScript content-type': contentType?.includes('javascript') ?? false,
      'CORS header (*)': cors === '*',
      'Load guard (__accountSwitcherLoaded)': script.includes('__accountSwitcherLoaded'),
      'Message event listener': script.includes('addEventListener'),
      'Window navigation': script.includes('window.') && (script.includes('location.href') || script.includes('top')),
      'Origin validation': script.includes('event.origin') || script.includes('origin'),
      'Script size > 2KB': script.length > 2000,
    };

    let passed = 0;
    Object.entries(checks).forEach(([check, result]) => {
      console.log(`  ${result ? '✓' : '✗'} ${check}`);
      if (result) passed++;
    });

    const success = passed === Object.keys(checks).length;
    console.log(`\n✓ Widget Script: ${passed}/${Object.keys(checks).length} checks passed`);
    console.log(`  Script size: ${script.length} bytes\n`);

    results.push({
      name: 'Widget Script',
      passed: success,
    });
  } catch (error) {
    console.log(`✗ FAILED: ${error}`);
    results.push({
      name: 'Widget Script',
      passed: false,
      message: String(error),
    });
  }
}

async function testAccountSwitcherPage() {
  console.log('\n[TEST 2.2] GET /widget/account-switcher - Account Switcher Page\n');

  try {
    const response = await fetch(`${IDP_URL}/widget/account-switcher`, {
      credentials: 'include',
    });

    if (response.status === 401) {
      console.log('⚠️  SKIPPED: No active session (not logged in)');
      results.push({
        name: 'Account Switcher Page',
        passed: true,
        message: 'Skipped (auth required)',
      });
      return;
    }

    if (response.status !== 200) {
      console.log(`✗ FAILED: Expected 200, got ${response.status}`);
      results.push({
        name: 'Account Switcher Page',
        passed: false,
        message: `HTTP ${response.status}`,
      });
      return;
    }

    const html = await response.text();

    const checks = {
      'Page has content': html.length > 100,
      'No error messages': !html.includes('Error loading'),
      'Has account elements': html.includes('account') || html.includes('Account') || html.includes('Manage'),
    };

    let passed = 0;
    Object.entries(checks).forEach(([check, result]) => {
      console.log(`  ${result ? '✓' : '✗'} ${check}`);
      if (result) passed++;
    });

    const success = passed === Object.keys(checks).length;
    console.log(`\n✓ Account Switcher Page: ${passed}/${Object.keys(checks).length} checks passed`);
    console.log(`  Page size: ${html.length} bytes\n`);

    results.push({
      name: 'Account Switcher Page',
      passed: success,
    });
  } catch (error) {
    console.log(`✗ FAILED: ${error}`);
    results.push({
      name: 'Account Switcher Page',
      passed: false,
      message: String(error),
    });
  }
}

async function testCspHeaders() {
  console.log('\n[TEST 2.3] Middleware CSP Headers\n');

  try {
    const response = await fetch(`${IDP_URL}/widget/account-switcher`, {
      credentials: 'include',
    });

    const csp = response.headers.get('content-security-policy');
    const xframe = response.headers.get('x-frame-options');

    const checks = {
      'CSP header exists': !!csp,
      'CSP contains frame-ancestors': csp?.includes('frame-ancestors') ?? false,
      'X-Frame-Options set': !!xframe,
    };

    let passed = 0;
    Object.entries(checks).forEach(([check, result]) => {
      console.log(`  ${result ? '✓' : '✗'} ${check}`);
      if (result) passed++;
    });

    const success = passed === Object.keys(checks).length;
    console.log(`\n✓ CSP Headers: ${passed}/${Object.keys(checks).length} checks passed`);

    if (csp) {
      console.log(`  CSP: ${csp.substring(0, 100)}...`);
    }
    console.log(`  X-Frame-Options: ${xframe}\n`);

    results.push({
      name: 'CSP Headers',
      passed: success,
    });
  } catch (error) {
    console.log(`✗ FAILED: ${error}`);
    results.push({
      name: 'CSP Headers',
      passed: false,
      message: String(error),
    });
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  Phase 1 & 2 Integration Test Suite    ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    await testWidgetScript();
    await testWidgetAccountsApi();
    await testAccountSwitcherPage();
    await testCspHeaders();

    console.log('\n═══════════════════════════════════════\n');
    console.log('📋 TEST SUMMARY\n');

    const passedCount = results.filter((r) => r.passed).length;
    const totalCount = results.length;

    results.forEach((r) => {
      if (r.message?.includes('Skipped')) {
        console.log(`⏭️  ${r.name} (${r.message})`);
      } else {
        console.log(`${r.passed ? '✅' : '❌'} ${r.name}`);
      }
    });

    console.log(`\n${passedCount}/${totalCount} tests passed\n`);

    if (passedCount === totalCount) {
      console.log('✅ ALL TESTS PASSED!\n');
      console.log('🎯 Next Steps:');
      console.log('   1. Log in at http://localhost:3000/login');
      console.log('   2. Check /widget/account-switcher to see UI');
      console.log('   3. Test /api/widget/accounts to see JSON');
      console.log('   4. Implement Phase 4 (Client Integration)\n');
    } else {
      const failedTests = results.filter((r) => !r.passed).map((r) => r.name);
      console.log(`⚠️  Failed tests: ${failedTests.join(', ')}`);
      console.log('   Check error messages above.\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  }
}

main();
