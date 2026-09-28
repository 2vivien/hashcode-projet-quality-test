import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const IGNORE = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.hashcode-quality', '.turbo', '.vercel']);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out); else out.push(path);
  }
  return out;
}

function nextRoute(file, cwd) {
  const rel = relative(cwd, file).replaceAll('\\\\', '/');
  const app = rel.match(/(?:^|\\/)app\\/(.*)\\/(?:page|route)\\.(?:tsx?|jsx?|mjs|cjs)$/) || rel.match(/(?:^|\\/)app\\/(page|route)\\.(?:tsx?|jsx?|mjs|cjs)$/);
  if (app) {
    const raw = app[1] || '';
    if (raw === 'page' || raw === 'route') return '/';
    const segments = raw.split('/').filter(Boolean).filter(function (s) { return !/^\\(.+\\)$/.test(s); });
    return '/' + segments.map(function (s) {
      if (s.startsWith('[...') && s.endsWith(']')) return '*' + s.slice(4, -1);
      if (s.startsWith('[') && s.endsWith(']')) return ':' + s.slice(1, -1);
      return s;
    }).join('/');
  }
  const pages = rel.match(/(?:^|\\/)pages\\/(.*)\\.(?:tsx?|jsx?|mjs|cjs)$/);
  if (pages && !pages[1].startsWith('_') && !pages[1].startsWith('api/')) {
    const raw = pages[1].replace(/\\/index$/, '').replace(/^index$/, '');
    return '/' + raw.split('/').filter(Boolean).map(function (s) {
      return s.startsWith('[') && s.endsWith(']') ? ':' + s.slice(1, -1) : s;
    }).join('/');
  }
  return null;
}

function apiRoute(file, cwd) {
  const rel = relative(cwd, file).replaceAll('\\\\', '/');
  const m = rel.match(/(?:^|\\/)pages\\/(api\\/.*)\\.(?:tsx?|jsx?|mjs|cjs)$/) || rel.match(/(?:^|\\/)app\\/(api\\/.*?)(?:\\/route)?\\.(?:tsx?|jsx?|mjs|cjs)$/);
  return m ? '/' + m[1].replace(/\\/route$/, '').replace(/\\/index$/, '') : null;
}

function methodsFromSource(content) {
  return [...new Set([...content.matchAll(/export\\s+(?:async\\s+)?function\\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\\b/g)].map(function (m) { return m[1]; }))];
}

function discoverOpenApi(cwd, files) {
  const candidates = files.filter(function (f) { return /(?:^|\\/)openapi\\.(?:ya?ml|json)$/i.test(relative(cwd, f)); });
  const specs = [];
  for (const file of candidates) {
    const raw = readFileSync(file, 'utf8');
    try {
      const doc = JSON.parse(raw);
      for (const [path, item] of Object.entries(doc.paths || {})) {
        for (const [method, operation] of Object.entries(item || {})) {
          if (/^(get|post|put|patch|delete|head|options)$/i.test(method)) {
            specs.push({ source: relative(cwd, file), path, method: method.toUpperCase(), operationId: operation && operation.operationId || null, summary: operation && operation.summary || null, tags: operation && operation.tags || [], security: operation && operation.security || item.security || doc.security || null });
          }
        }
      }
    } catch {
      let current = null;
      for (const line of raw.split(/\r?\n/)) {
        const pm = line.match(/^\\s{2}([^\\s][^:]*):\\s*$/);
        if (pm && pm[1].startsWith('/')) current = pm[1];
        const mm = line.match(/^\\s{4,}(get|post|put|patch|delete|head|options):\\s*$/i);
        if (mm && current) specs.push({ source: relative(cwd, file), path: current, method: mm[1].toUpperCase(), operationId: null, summary: null, tags: [], security: null });
      }
    }
  }
  return specs;
}

export function discoverApplicationSurface(cwd = process.cwd()) {
  const files = walk(cwd);
  const routes = [];
  const apis = [];
  for (const file of files) {
    const route = nextRoute(file, cwd);
    if (route) routes.push({ path: route, source: relative(cwd, file), kind: 'page', methods: ['GET'], dynamic: route.includes(':') || route.includes('*') });
    const api = apiRoute(file, cwd);
    if (api) {
      const methods = methodsFromSource(readFileSync(file, 'utf8'));
      for (const method of methods) apis.push({ path: api, method, source: relative(cwd, file) });
    }
  }
  return {
    routes: [...new Map(routes.map(function (x) { return [x.path, x]; })).values()].sort(function (a, b) { return a.path.localeCompare(b.path); }),
    apiRoutes: [...new Map(apis.map(function (x) { return [x.method + ':' + x.path, x]; })).values()],
    openapi: discoverOpenApi(cwd, files),
    filesScanned: files.length
  };
}

export function inferRoles(cwd = process.cwd()) {
  const files = walk(cwd).filter(function (f) { return /\\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(f); });
  const hits = new Map();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\\b(?:role|roles|permissions?|authorize|authorization)\\b[^\\n]{0,120}?\\b(admin|administrator|manager|gerant|seller|vendeur|editor|moderator|teacher|student|parent|user|member|support)\\b/gi)) {
      const role = match[1].toLowerCase();
      hits.set(role, (hits.get(role) || 0) + 1);
    }
  }
  return [...hits.entries()].sort(function (a, b) { return b[1] - a[1]; }).map(function (x) { return { role: x[0], occurrences: x[1] }; });
}