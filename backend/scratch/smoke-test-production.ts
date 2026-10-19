import { performance } from 'perf_hooks';

interface Measurement {
  iteration: number;
  status: number;
  statusText: string;
  durationMs: number;
  headers: Record<string, string>;
  validation: {
    passed: boolean;
    details: string;
  };
}

async function testEndpoint(
  name: string,
  url: string,
  validate: (bodyText: string, status: number, headers: Headers) => { passed: boolean; details: string },
  runs: number = 5
) {
  console.log(`\n========================================================================`);
  console.log(`📡 SMOKE TESTING: ${name}`);
  console.log(`URL: ${url}`);
  console.log(`========================================================================`);

  const measurements: Measurement[] = [];

  for (let i = 1; i <= runs; i++) {
    const start = performance.now();
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'RentGoer-Production-QA/1.0',
          'Accept': url.includes('/api/') ? 'application/json' : 'text/html,*/*',
        },
        redirect: 'manual', // do not silently follow redirects so we detect unexpected redirects
      });
      const end = performance.now();
      const durationMs = Math.round((end - start) * 100) / 100;

      const bodyText = await res.text();
      const val = validate(bodyText, res.status, res.headers);

      const headerSubset: Record<string, string> = {};
      const interestingHeaders = [
        'content-type',
        'x-render-origin-server',
        'x-vercel-id',
        'x-vercel-cache',
        'x-matched-path',
        'server',
        'cache-control',
        'age',
      ];
      for (const h of interestingHeaders) {
        const valHeader = res.headers.get(h);
        if (valHeader) headerSubset[h] = valHeader;
      }

      measurements.push({
        iteration: i,
        status: res.status,
        statusText: res.statusText,
        durationMs,
        headers: headerSubset,
        validation: val,
      });

      console.log(
        `  Run ${i}: Status ${res.status} | Latency: ${durationMs.toFixed(1)}ms | Validation: ${
          val.passed ? '✅ PASS' : '❌ FAIL'
        } (${val.details})`
      );
    } catch (err: any) {
      const end = performance.now();
      const durationMs = Math.round((end - start) * 100) / 100;
      console.error(`  Run ${i}: ERROR after ${durationMs.toFixed(1)}ms - ${err.message}`);
      measurements.push({
        iteration: i,
        status: 0,
        statusText: err.message,
        durationMs,
        headers: {},
        validation: { passed: false, details: `Network exception: ${err.message}` },
      });
    }

    // Small sequential pause (500ms) between runs
    if (i < runs) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Summary statistics
  const validRuns = measurements.filter((m) => m.status === 200);
  const durations = validRuns.map((m) => m.durationMs);
  const firstDuration = measurements[0]?.durationMs || 0;
  const subsequentDurations = measurements.slice(1).map((m) => m.durationMs);
  const subsequentAvg =
    subsequentDurations.length > 0
      ? subsequentDurations.reduce((a, b) => a + b, 0) / subsequentDurations.length
      : 0;
  const overallAvg = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  console.log(`\n  --- Summary for ${name} ---`);
  console.log(`  Total runs: ${runs} | Successful (200 OK): ${validRuns.length}/${runs}`);
  console.log(`  Run 1 (Initial): ${firstDuration.toFixed(1)}ms`);
  console.log(`  Runs 2-${runs} Warm Avg: ${subsequentAvg.toFixed(1)}ms`);
  console.log(`  Overall Mean: ${overallAvg.toFixed(1)}ms`);
  console.log(`  Min: ${Math.min(...durations).toFixed(1)}ms | Max: ${Math.max(...durations).toFixed(1)}ms`);
  if (measurements[0]?.headers) {
    console.log(`  Notable Headers:`, JSON.stringify(measurements[0].headers, null, 2));
  }

  return {
    name,
    url,
    measurements,
    firstDuration,
    subsequentAvg,
    overallAvg,
    validRunsCount: validRuns.length,
  };
}

async function runProductionSmokeTests() {
  console.log('========================================================================');
  console.log('🧪 RENTGOER PRODUCTION SMOKE & PERFORMANCE VERIFICATION');
  console.log('Target Backend: https://rentgoer.onrender.com (Singapore)');
  console.log('Target Frontend: https://rentgoer.vercel.app');
  console.log('========================================================================');

  // 1. Backend Health Endpoint
  const healthResult = await testEndpoint(
    'Backend Health Check',
    'https://rentgoer.onrender.com/api/health',
    (bodyText, status) => {
      if (status !== 200) return { passed: false, details: `Non-200 status: ${status}` };
      try {
        const json = JSON.parse(bodyText);
        if (json.status === 'ok') {
          return { passed: true, details: `status="${json.status}", message="${json.message}"` };
        }
        return { passed: false, details: `Unexpected payload: ${bodyText}` };
      } catch (e: any) {
        return { passed: false, details: `Invalid JSON: ${e.message}` };
      }
    }
  );

  // 2. Backend Properties Endpoint
  let samplePropertiesCount = 0;
  let sampleTotalCount = 0;
  const propertiesResult = await testEndpoint(
    'Backend Properties API',
    'https://rentgoer.onrender.com/api/properties',
    (bodyText, status) => {
      if (status !== 200) return { passed: false, details: `Non-200 status: ${status}` };
      try {
        const json = JSON.parse(bodyText);
        if (json.success !== true) return { passed: false, details: `success is not true` };
        if (!Array.isArray(json.data)) return { passed: false, details: `data is not an array` };
        if (!json.pagination || typeof json.pagination.total !== 'number') {
          return { passed: false, details: `missing pagination metadata` };
        }
        samplePropertiesCount = json.data.length;
        sampleTotalCount = json.pagination.total;

        // Verify property shape if properties exist
        if (json.data.length > 0) {
          const first = json.data[0];
          const hasRequiredFields =
            first.id &&
            first.title &&
            first.rent !== undefined &&
            first.owner !== undefined &&
            first.averageRating !== undefined &&
            first.reviewCount !== undefined;
          if (!hasRequiredFields) {
            return { passed: false, details: `Property object missing required fields (id, title, owner, ratings)` };
          }
        }

        return {
          passed: true,
          details: `Returned ${json.data.length} properties, total=${json.pagination.total}, pages=${json.pagination.totalPages}`,
        };
      } catch (e: any) {
        return { passed: false, details: `Invalid JSON: ${e.message}` };
      }
    }
  );

  // 3. Frontend Home Page
  const frontendHomeResult = await testEndpoint(
    'Frontend Home Page',
    'https://rentgoer.vercel.app/',
    (bodyText, status, headers) => {
      if (status !== 200) return { passed: false, details: `Non-200 status: ${status}` };
      const contentType = headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        return { passed: false, details: `Unexpected content-type: ${contentType}` };
      }
      if (!bodyText.includes('RentGoer') && !bodyText.includes('Find your place')) {
        return { passed: false, details: `HTML does not contain expected RentGoer branding strings` };
      }
      return { passed: true, details: `HTML document returned, contains RentGoer branding` };
    }
  );

  // 4. Frontend Properties Page (Server-Rendered RSC / SSR)
  const frontendPropertiesResult = await testEndpoint(
    'Frontend Properties Page (RSC/SSR)',
    'https://rentgoer.vercel.app/properties',
    (bodyText, status, headers) => {
      if (status !== 200) return { passed: false, details: `Non-200 status: ${status}` };
      const contentType = headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        return { passed: false, details: `Unexpected content-type: ${contentType}` };
      }
      if (!bodyText.includes('Browse Properties') && !bodyText.includes('RentGoer')) {
        return { passed: false, details: `HTML does not contain "Browse Properties" heading` };
      }
      return { passed: true, details: `HTML document returned, contains "Browse Properties"` };
    }
  );

  console.log('\n========================================================================');
  console.log('📊 FINAL SMOKE TEST SUMMARY TABLE');
  console.log('========================================================================');
  console.table([
    {
      Endpoint: healthResult.name,
      Status: `${healthResult.validRunsCount}/5 passed`,
      'Run 1 (ms)': healthResult.firstDuration.toFixed(1),
      'Runs 2-5 Avg (ms)': healthResult.subsequentAvg.toFixed(1),
      'Overall Mean (ms)': healthResult.overallAvg.toFixed(1),
    },
    {
      Endpoint: propertiesResult.name,
      Status: `${propertiesResult.validRunsCount}/5 passed`,
      'Run 1 (ms)': propertiesResult.firstDuration.toFixed(1),
      'Runs 2-5 Avg (ms)': propertiesResult.subsequentAvg.toFixed(1),
      'Overall Mean (ms)': propertiesResult.overallAvg.toFixed(1),
    },
    {
      Endpoint: frontendHomeResult.name,
      Status: `${frontendHomeResult.validRunsCount}/5 passed`,
      'Run 1 (ms)': frontendHomeResult.firstDuration.toFixed(1),
      'Runs 2-5 Avg (ms)': frontendHomeResult.subsequentAvg.toFixed(1),
      'Overall Mean (ms)': frontendHomeResult.overallAvg.toFixed(1),
    },
    {
      Endpoint: frontendPropertiesResult.name,
      Status: `${frontendPropertiesResult.validRunsCount}/5 passed`,
      'Run 1 (ms)': frontendPropertiesResult.firstDuration.toFixed(1),
      'Runs 2-5 Avg (ms)': frontendPropertiesResult.subsequentAvg.toFixed(1),
      'Overall Mean (ms)': frontendPropertiesResult.overallAvg.toFixed(1),
    },
  ]);
}

runProductionSmokeTests().catch(console.error);
