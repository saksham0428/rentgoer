import { exec } from 'child_process';

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('Starting server with healthy DB...');
  const server = exec('npx tsx src/index.ts', { env: { ...process.env, PORT: '5005' } });
  
  // Wait for server to start
  await delay(5000);

  try {
    console.log('\n--- Testing healthy DB ---');
    const res1 = await fetch('http://localhost:5005/api/health');
    console.log('HTTP Status:', res1.status);
    console.log('Response Body:', await res1.json());
  } catch (err) {
    console.error('Healthy DB test failed:', err);
  } finally {
    server.kill();
  }

  await delay(2000); // Give port time to clear

  console.log('\nStarting server with broken DB connection string...');
  const badServer = exec('npx tsx src/index.ts', { env: { ...process.env, PORT: '5006', DATABASE_URL: 'postgresql://invalid:invalid@localhost:5432/invalid?schema=public' } });
  
  await delay(5000);

  try {
    console.log('\n--- Testing broken DB ---');
    const res2 = await fetch('http://localhost:5006/api/health');
    console.log('HTTP Status:', res2.status);
    console.log('Response Body:', await res2.json());
  } catch (err) {
    console.error('Broken DB test failed:', err);
  } finally {
    badServer.kill();
  }
}

runTests().catch(console.error);
