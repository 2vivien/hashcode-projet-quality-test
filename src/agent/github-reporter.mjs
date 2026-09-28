import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

function apiUrl(repo, path) { return 'https://api.github.com/repos/' + repo + (path || ''); }
function headers(token) { return { accept: 'application/vnd.github+json', authorization: 'Bearer ' + token, 'x-github-api-version': '2026-03-10', 'user-agent': 'hashcode-quality-autonomous-qa' }; }
async function gh(token, repo, path, options = {}) {
  const response = await fetch(apiUrl(repo, path), { ...options, headers: { ...headers(token), ...(options.headers || {}) } });
  const body = await response.json().catch(function () { return {}; });
  if (!response.ok) throw new Error('GitHub API ' + response.status + ': ' + (body.message || response.statusText));
  return body;
}
export function fingerprint(finding) {
  return createHash('sha256').update(JSON.stringify({ type: finding.type, title: finding.title, url: finding.evidence && finding.evidence.url, method: finding.evidence && finding.evidence.method, summary: finding.summary })).digest('hex').slice(0, 20);
}
function issueBody(finding, meta, artifactUrls) {
  const e = finding.evidence || {};
  const lines = [
    '<!-- HASHCODE-QA -->',
    '<!-- fingerprint:' + fingerprint(finding) + ' -->',
    '',
    '## Autonomous QA finding',
    '**Severity:** ' + (finding.severity || 'MEDIUM'),
    '**Confidence:** ' + (finding.confidence == null ? 1 : finding.confidence),
    '**Run:** ' + meta.runId,
    '**Git SHA:** ' + (meta.gitSha || 'unknown'),
    '',
    '### Summary',
    finding.summary || 'No summary provided.',
    '',
    '### Reproduction',
    'METHOD: ' + (e.method || 'GET'),
    'URL: ' + (e.url || 'See captured trace.'),
    '',
    '### Evidence'
  ];
  for (const item of artifactUrls || []) lines.push('- Screenshot: ![' + item.label + '](' + item.url + ')');
  if (e.trace) lines.push('- Trace: ' + e.trace);
  lines.push('', '### Scope', 'The agent reports only what it observed. Absence of a finding is not proof of absence.', '', '### Suggested verification', 'Re-run the exact reproduction and confirm the behavior with an independent oracle.');
  return lines.join('\n');
}
async function uploadArtifact(token, repo, file, remotePath, branch) {
  const content = readFileSync(file).toString('base64');
  const body = { message: 'chore(qa): publish autonomous QA artifact', content, branch };
  return gh(token, repo, '/contents/' + remotePath, { method: 'PUT', body: JSON.stringify(body) });
}
export async function reportFindings({ findings = [], repo, token, branch = 'main', runId, gitSha, publishArtifacts = true, labels = ['qa', 'automated'] } = {}) {
  if (!token || !repo) return { status: 'BLOCKED', reason: 'GitHub token and repository are required.', issues: [] };
  const issues = [];
  const failures = [];
  let openIssues;
  try { openIssues = await gh(token, repo, '/issues?state=open&per_page=100'); } catch (e) { return { status: 'BLOCKED', reason: e.message, issues: [] }; }
  for (const finding of findings) {
    const fp = fingerprint(finding);
    if (openIssues.some(function (i) { return String(i.body || '').includes('fingerprint:' + fp); })) { issues.push({ fingerprint: fp, status: 'DUPLICATE' }); continue; }
    const artifacts = [];
    if (publishArtifacts && finding.evidence) {
      const files = [];
      if (finding.evidence.screenshot && existsSync(finding.evidence.screenshot)) files.push({ label: 'screenshot', file: finding.evidence.screenshot });
      if (finding.evidence.trace && existsSync(finding.evidence.trace)) files.push({ label: 'trace', file: finding.evidence.trace });
      for (const artifact of files) {
        const remote = 'qa-artifacts/' + runId + '/' + artifact.file.split('/').at(-1);
        try {
          const uploaded = await uploadArtifact(token, repo, artifact.file, remote, branch);
          const url = uploaded.content && (uploaded.content.download_url || uploaded.content.html_url);
          if (url) artifacts.push({ label: artifact.label, url });
        } catch (e) { failures.push({ fingerprint: fp, error: 'artifact upload: ' + e.message }); }
      }
    }
    try {
      const created = await gh(token, repo, '/issues', { method: 'POST', body: JSON.stringify({ title: '[HashCode QA] ' + finding.title, body: issueBody(finding, { runId, gitSha }, artifacts), labels }) });
      issues.push({ fingerprint: fp, status: 'CREATED', number: created.number, url: created.html_url });
    } catch (e) { failures.push({ fingerprint: fp, error: 'issue creation: ' + e.message }); }
  }
  return { status: failures.length ? 'PARTIAL' : 'OK', issues, failures };
}