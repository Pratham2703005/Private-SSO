/**
 * Quick Phase 1 & 2 Test
 * Tests Widget endpoints without database setup
 * Requires: Already logged-in user with session
 */

const IDP_URL = 'http://localhost:3000';

async function testWidgetScript() {
  console.log('\n[TEST 1] GET /api/widget.js - Widget Script\n');

  try {
    const response = await fetch(`${IDP_URL}/api/widget.js`);

    if (response.status !== 200) {
      console.log(`✗ FAILED: Expected 200, got ${response.status}`);
      return false;
    }

    const contentType = response.headers.get('content-type');
    const cors = response.headers.get('access-control-allow-origin');

    const script = await response.text();
    const checks = {
      'JavaScript content-type': contentType?.includes('javascript'),
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

    console.log(`\n✓ Widget script test: ${passed}/${Object.keys(checks).length} checks passed\n`);
    return passed === Object.keys(checks).length;
  } catch (error) {
    console.log(`✗ FAILED:`, error);
    return false;
  }
}

async function testAccountSwitcherPage() {
  console.log('\n[TEST 2] GET /widget/account-switcher - Account Switcher Page\n');

  try {
    // Note: This requires an active session (cookie)
    // If you're testing from Node, you'll need to set proper cookies
    const response = await fetch(`${IDP_URL}/widget/account-switcher`, {
      credentials: 'include',
    });

    if (response.status !== 200) {
      console.log(`✗ FAILED: Expected 200, got ${response.status}`);
      return false;
    }

    const html = await response.text();

    const checks = {
      'Page has content': html.length > 100,
      'Contains account info': html.includes('account') || html.includes('Account'),
      'No critical errors': !html.includes('Error loading accounts'),
    };

    let passed = 0;
    Object.entries(checks).forEach(([check, result]) => {
      console.log(`  ${result ? '✓' : '✗'} ${check}`);
      if (result) passed++;
    });

    console.log(`\n✓ Account switcher page test: ${passed}/${Object.keys(checks).length} checks passed\n`);
    return passed === Object.keys(checks).length;
  } catch (error) {
    console.log(`✗ FAILED:`, error);
    return false;
  }
}

async function testCspHeaders() {
  console.log('\n[TEST 3] Middleware CSP Headers\n');

  try {
    const response = await fetch(`${IDP_URL}/widget/account-switcher`, {
      credentials: 'include',
    });

    const csp = response.headers.get('content-security-policy');

    const checks = {
      'CSP header exists': !!csp,
      'CSP contains frame-ancestors': csp?.includes('frame-ancestors'),
    };

    let passed = 0;
    Object.entries(checks).forEach(([check, result]) => {
      console.log(`  ${result ? '✓' : '✗'} ${check}`);
      if (result) passed++;
    });

    if (csp) {
      console.log(`\n  CSP: ${csp.substring(0, 120)}...`);
    }

    console.log(`\n✓ CSP headers test: ${passed}/${Object.keys(checks).length} checks passed\n`);
    return passed === Object.keys(checks).length;
  } catch (error) {
    console.log(`✗ FAILED:`, error);
    return false;
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  Phase 1 & 2 Quick Integration Test    ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    const test1 = await testWidgetScript();
    const test2 = await testAccountSwitcherPage();
    const test3 = await testCspHeaders();

    console.log('\n═══════════════════════════════════════\n');
    console.log('📋 TEST SUMMARY\n');

    const results = [
      { name: 'Widget Script Load', passed: test1 },
      { name: 'Account Switcher Page', passed: test2 },
      { name: 'CSP Headers', passed: test3 },
    ];

    const passedCount = results.filter((r) => r.passed).length;

    results.forEach((r) => {
      console.log(`${r.passed ? '✅' : '❌'} ${r.name}`);
    });

    console.log(`\n${passedCount}/${results.length} tests passed\n`);

    if (passedCount === results.length) {
      console.log('✅ All Phase 1 & 2 tests PASSED!');
      console.log('\n🎯 Next Step: Test widget embeding on client domains');
      console.log('   See WIDGET_MANUAL_TESTING_GUIDE.md for Phase 4 setup');
    } else {
      console.log('⚠️  Some tests failed. Review output above.');
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Test failed:', error);
    process.exit(1);
  }
}

main();
