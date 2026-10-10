import { execSync } from 'child_process';
import path from 'path';

const tests = [
  'test.ts',
  'test-properties.ts',
  'test-search.ts',
  'test-property-images.ts',
  'test-favorites.ts',
  'test-rental-requests.ts',
  'test-owner-rental-requests.ts',
  'test-issue1-regression.ts',
  'test-chat.ts',
  'test-notifications.ts',
  'test-reviews.ts',
  'test-reports.ts',
  'test-verification.ts',
  'test-admin-dashboard.ts'
];

async function runAll() {
  console.log('--- STARTING MASTER QA RUN ---');
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\n==================================================`);
    console.log(`RUNNING: ${test}`);
    console.log(`==================================================`);
    try {
      execSync(`npx tsx ${test}`, { 
        stdio: 'inherit', 
        cwd: __dirname,
      });
      console.log(`\n✅ PASS: ${test}`);
      passed++;
    } catch (e) {
      console.error(`\n❌ FAIL: ${test}`);
      failed++;
    }
  }

  console.log(`\n==================================================`);
  console.log(`QA RUN COMPLETE`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`==================================================`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runAll();
