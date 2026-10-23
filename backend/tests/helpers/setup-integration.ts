import { applyTestEnvironment, sanitizeErrorMessage } from './test-db-guard';

// Fail-closed test environment setup:
// Strictly overrides process.env before ANY application module or test file is evaluated
try {
  applyTestEnvironment();
} catch (err) {
  console.error('FAIL-CLOSED SAFETY ABORT in setup-integration:', sanitizeErrorMessage(err));
  throw err;
}
