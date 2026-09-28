function resolvePath(path) {
  return path.replace(/\{([^}]+)\}/g, function (_, name) {
    return /id|uuid/i.test(name) ? '00000000-0000-0000-0000-000000000001' : 'test';
  });
}

export async function probeApi({ baseUrl, endpoints = [], timeoutMs = 10000, allowMutations = false, headers = {} } = {}) {
  if (!baseUrl) return { status: 'BLOCKED', requests: [], findings: [] };
  const requests = [];
  const findings = [];
  for (const endpoint of endpoints) {
    const mutation = /^(POST|PUT|PATCH|DELETE)$/.test(endpoint.method);
    if (mutation && !allowMutations) continue;
    const url = new URL(resolvePath(endpoint.path), baseUrl).href;
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    const started = Date.now();
    try {
      const response = await fetch(url, { method: endpoint.method, headers: { accept: 'application/json', ...headers }, signal: controller.signal });
      const body = await response.text();
      const item = { url, method: endpoint.method, status: response.status, durationMs: Date.now() - started, bodySample: body.slice(0, 2000) };
      requests.push(item);
      if (response.status >= 500) findings.push({ type: 'API_SERVER_ERROR', severity: 'HIGH', title: 'API ' + endpoint.method + ' ' + endpoint.path + ' returned ' + response.status, summary: 'The API returned a server error during autonomous probing.', evidence: item });
    } catch (error) {
      findings.push({ type: 'API_PROBE_BLOCKED', severity: 'MEDIUM', title: 'API probe failed: ' + endpoint.method + ' ' + endpoint.path, summary: error.message, evidence: { url, method: endpoint.method } });
    } finally {
      clearTimeout(timer);
    }
  }
  return { status: 'PASS', requests, findings };
}