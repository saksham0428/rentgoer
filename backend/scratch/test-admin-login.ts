import fetch from 'node-fetch';

async function testAdminLogin() {
  const res = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin.report@test.com',
      password: 'Password123!',
    }),
  });

  const data: any = await res.json();
  console.log('Login status:', res.status);
  console.log('Login response:', JSON.stringify(data, null, 2));
  const cookie = res.headers.get('set-cookie');
  console.log('Cookie received:', !!cookie);

  if (res.ok && cookie) {
    // Try fetching /api/admin/stats
    const statsRes = await fetch('http://localhost:5000/api/admin/stats', {
      headers: { Cookie: cookie.split(';')[0] },
    });
    const statsData = await statsRes.json();
    console.log('Stats status:', statsRes.status);
    console.log('Stats response:', JSON.stringify(statsData, null, 2));
  }
}

testAdminLogin().catch(console.error);
