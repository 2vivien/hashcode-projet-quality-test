import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

async function loadPlaywright() {
  try { return await import('playwright'); } catch { return null; }
}

export async function exploreBrowser({ baseUrl, routes = [], outDir, maxPages = 30, maxDepth = 2, timeoutMs = 15000, screenshotAll = false } = {}) {
  const playwright = await loadPlaywright();
  if (!playwright) return { status: 'MISSING_CAPABILITY', reason: 'Playwright is not installed.', pages: [], findings: [] };
  if (!baseUrl) return { status: 'BLOCKED', reason: 'No base URL configured.', pages: [], findings: [] };
  mkdirSync(outDir, { recursive: true });
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const queue = routes.map(function (r) { return { url: new URL(r.path, baseUrl).href, depth: 0 }; });
  const seen = new Set();
  const pages = [];
  const findings = [];
  let index = 0;
  try {
    while (queue.length && pages.length < maxPages) {
      const item = queue.shift();
      if (seen.has(item.url) || item.depth > maxDepth) continue;
      seen.add(item.url);
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      const failedRequests = [];
      const serverErrors = [];
      page.on('console', function (m) { if (m.type() === 'error') consoleErrors.push(m.text()); });
      page.on('pageerror', function (e) { pageErrors.push(e.message); });
      page.on('requestfailed', function (r) { failedRequests.push({ url: r.url(), failure: r.failure() && r.failure().errorText || 'unknown' }); });
      page.on('response', function (r) { if (r.status() >= 500) serverErrors.push({ url: r.url(), status: r.status() }); });
      const artifactBase = join(outDir, String(++index).padStart(3, '0'));
      const screenshot = artifactBase + '.png';
      const trace = artifactBase + '.trace.zip';
      await context.tracing.start({ screenshots: true, snapshots: true });
      let status = 'PASS';
      let error = null;
      try {
        const response = await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        const httpStatus = response && response.status() || null;
        const title = await page.title().catch(function () { return ''; });
        const links = await page.locator('a[href]').evaluateAll(function (as) { return as.map(function (a) { return a.href; }).filter(Boolean); }).catch(function () { return []; });
        for (const href of links) {
          try {
            const u = new URL(href);
            const b = new URL(baseUrl);
            if (u.origin === b.origin && !u.hash && !seen.has(u.href)) queue.push({ url: u.href, depth: item.depth + 1 });
          } catch {}
        }
        if (httpStatus >= 500) { status = 'FAIL'; error = 'Server returned 5xx.'; }
        if (pageErrors.length || consoleErrors.length || serverErrors.length) { status = 'FAIL'; error = error || 'Browser runtime or network errors detected.'; }
        if (httpStatus >= 400 && httpStatus !== 404) { status = 'FAIL'; error = error || 'Unexpected HTTP ' + httpStatus + '.'; }
        if (screenshotAll || status === 'FAIL') await page.screenshot({ path: screenshot, fullPage: true });
        await context.tracing.stop({ path: trace });
        pages.push({ url: item.url, depth: item.depth, httpStatus, title, status, screenshot: existsSync(screenshot) ? screenshot : null, trace, consoleErrors, pageErrors, failedRequests, serverErrors });
        if (status === 'FAIL') findings.push({ type: 'BROWSER_FAILURE', severity: serverErrors.length ? 'HIGH' : 'MEDIUM', title: 'Browser anomaly on ' + item.url, summary: error, evidence: { url: item.url, httpStatus, screenshot: existsSync(screenshot) ? screenshot : null, trace, consoleErrors, pageErrors, failedRequests, serverErrors } });
      } catch (e) {
        try { await page.screenshot({ path: screenshot, fullPage: true }); } catch {}
        try { await context.tracing.stop({ path: trace }); } catch {}
        pages.push({ url: item.url, depth: item.depth, httpStatus: null, title: null, status: 'FAIL', screenshot, trace, error: e.message, consoleErrors, pageErrors, failedRequests, serverErrors });
        findings.push({ type: 'BROWSER_FAILURE', severity: 'HIGH', title: 'Navigation failure on ' + item.url, summary: e.message, evidence: { url: item.url, screenshot, trace, consoleErrors, pageErrors, failedRequests, serverErrors } });
      } finally {
        await page.close().catch(function () {});
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }
  return { status: 'PASS', pages, findings, visited: seen.size };
}