import { strict as assert } from 'assert';
import crypto from 'crypto';
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
  testFn: () => void
): Promise<void> {
  const startTime = Date.now();
  try {
    testFn();
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

// Helper: Check if string is URL-safe base64
function isUrlSafeBase64(str: string): boolean {
  // URL-safe base64 should only contain: A-Z, a-z, 0-9, -, _
  // Should NOT contain: +, /, =
  return /^[A-Za-z0-9\-_]+$/.test(str);
}

function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════╗');
  console.log('║     STAGE 4: PKCE UTILITY TESTS        ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('\n');

  // Test 1: PKCE generation produces valid pairs
  runTest(
    1,
    'PKCE generation: valid verifier + challenge',
    () => {
      const pkce = generatePKCE();

      // Verifier checks
      assert.ok(
        pkce.verifier,
        'Verifier should exist'
      );

      assert.ok(
        pkce.verifier.length >= 43,
        `Verifier length should be >= 43, got ${pkce.verifier.length}`
      );

      assert.ok(
        isUrlSafeBase64(pkce.verifier),
        `Verifier should be URL-safe base64, got: ${pkce.verifier}`
      );

      // Challenge checks
      assert.ok(
        pkce.challenge,
        'Challenge should exist'
      );

      assert.strictEqual(
        pkce.challenge.length,
        43,
        `Challenge length should be 43, got ${pkce.challenge.length}`
      );

      assert.ok(
        isUrlSafeBase64(pkce.challenge),
        `Challenge should be URL-safe base64, got: ${pkce.challenge}`
      );

      console.log(`      Verifier: ${pkce.verifier.substring(0, 20)}... (length: ${pkce.verifier.length})`);
      console.log(`      Challenge: ${pkce.challenge.substring(0, 20)}... (length: ${pkce.challenge.length})`);
    }
  );

  // Test 2: PKCE math correctness
  runTest(
    2,
    'PKCE math: SHA256(verifier) matches challenge',
    () => {
      const pkce = generatePKCE();

      // Recompute challenge from verifier
      const recomputedChallenge = crypto
        .createHash('sha256')
        .update(pkce.verifier)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      assert.strictEqual(
        recomputedChallenge,
        pkce.challenge,
        `Recomputed challenge should match. Expected: ${pkce.challenge}, Got: ${recomputedChallenge}`
      );

      console.log(`      ✓ SHA256(verifier) correctly produces challenge`);
    }
  );

  // Test 3: Format validation (no padding)
  runTest(
    3,
    'PKCE format: no padding characters',
    () => {
      const pkce = generatePKCE();

      // Verifier should have no padding
      assert.ok(
        !pkce.verifier.includes('='),
        `Verifier should not contain padding '=', got: ${pkce.verifier}`
      );

      // Challenge should have no padding
      assert.ok(
        !pkce.challenge.includes('='),
        `Challenge should not contain padding '=', got: ${pkce.challenge}`
      );

      // Verify no standard base64 characters that shouldn't be in URL-safe version
      assert.ok(
        !pkce.verifier.includes('+'),
        `Verifier should not contain '+', got: ${pkce.verifier}`
      );

      assert.ok(
        !pkce.verifier.includes('/'),
        `Verifier should not contain '/', got: ${pkce.verifier}`
      );

      assert.ok(
        !pkce.challenge.includes('+'),
        `Challenge should not contain '+', got: ${pkce.challenge}`
      );

      assert.ok(
        !pkce.challenge.includes('/'),
        `Challenge should not contain '/', got: ${pkce.challenge}`
      );

      console.log(`      ✓ No padding characters found`);
      console.log(`      ✓ Only URL-safe characters (A-Z, a-z, 0-9, -, _)`);
    }
  );

  // Test 4: Multiple generations produce different pairs
  runTest(
    4,
    'PKCE: multiple generations are unique',
    () => {
      const pkce1 = generatePKCE();
      const pkce2 = generatePKCE();
      const pkce3 = generatePKCE();

      assert.notStrictEqual(
        pkce1.verifier,
        pkce2.verifier,
        'Different PKCE pairs should have different verifiers'
      );

      assert.notStrictEqual(
        pkce2.verifier,
        pkce3.verifier,
        'Different PKCE pairs should have different verifiers'
      );

      assert.notStrictEqual(
        pkce1.challenge,
        pkce2.challenge,
        'Different PKCE pairs should have different challenges'
      );

      console.log(`      ✓ Generated 3 unique PKCE pairs`);
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

main();
