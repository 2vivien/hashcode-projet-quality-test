import { spawn } from 'node:child_process';
import { createEvidence, RESULT_STATUS } from './model.mjs';

function quote(value) {
  return /[^a-zA-Z0-9_./:@=-]/.test(value) ? JSON.stringify(value) : value;
}

export function commandString(command, args = []) {
  return [command, ...args].map(quote).join(' ');
}

export function runCommand({ command, args = [], cwd = process.cwd(), timeoutMs = 120000, env = process.env }) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(command, args, { cwd, env, shell: process.platform === 'win32', windowsHide: true });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutMs);
    child.stdout?.on('data', d => { stdout += d; });
    child.stderr?.on('data', d => { stderr += d; });
    child.on('error', error => {
      clearTimeout(timer);
      const evidence = createEvidence({ command: commandString(command, args), cwd, exitCode: null, stdout, stderr: `${stderr}\\n${error.message}`, durationMs: Date.now() - started, meta: { timedOut } });
      resolve({ status: RESULT_STATUS.BLOCKED, exitCode: null, stdout, stderr: evidence.stderr, durationMs: evidence.durationMs, evidence });
    });
    child.on('close', code => {
      clearTimeout(timer);
      const status = timedOut ? RESULT_STATUS.BLOCKED : code === 0 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL;
      const evidence = createEvidence({ command: commandString(command, args), cwd, exitCode: code, stdout, stderr, durationMs: Date.now() - started, meta: { timedOut } });
      resolve({ status, exitCode: code, stdout, stderr, durationMs: evidence.durationMs, evidence });
    });
  });
}

export function runCheck(check, context) {
  return runCommand({ command: check.command, args: check.args, cwd: context.cwd, timeoutMs: context.timeoutMs });
}
