import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_PATH = '.hashcode-quality/authorization-fixtures.json';

function normalizeRole(value, name) {
  if (!value) return null;
  if (typeof value === 'string') return { name: value, tokenEnv: 'HASHCODE_QA_ROLE_' + value.toUpperCase().replace(/[^A-Z0-9]+/g, '_') + '_TOKEN' };
  return { name: name || value.name, tokenEnv: value.tokenEnv || ('HASHCODE_QA_ROLE_' + String(name || value.name).toUpperCase().replace(/[^A-Z0-9]+/g, '_') + '_TOKEN'), headers: value.headers || {}, ...value };
}

export function loadAuthorizationFixtures(cwd = process.cwd(), file = DEFAULT_PATH) {
  const path = resolve(cwd, file);
  if (!existsSync(path)) return { path: null, roles: [], objects: {}, authorization: [], functionAuthorization: [], workflows: [], properties: [] };
  let data;
  try { data = JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { return { path, error: error.message, roles: [], objects: {}, authorization: [], functionAuthorization: [], workflows: [], properties: [] }; }
  const roles = Array.isArray(data.roles)
    ? data.roles.map(x => normalizeRole(x))
    : Object.entries(data.roles || {}).map(([name, value]) => normalizeRole(value, name));
  return {
    path,
    roles,
    objects: data.objects || {},
    authorization: data.authorization || [],
    functionAuthorization: data.functionAuthorization || [],
    workflows: data.workflows || [],
    properties: data.properties || []
  };
}

export function resolveRoleHeaders(role, fixtures) {
  if (!role || role === 'anonymous') return {};
  const item = (fixtures.roles || []).find(x => x.name === role);
  if (!item) return null;
  if (item.headers && Object.keys(item.headers).length) return item.headers;
  if (item.token) return { authorization: 'Bearer ' + item.token };
  if (item.tokenEnv && process.env[item.tokenEnv]) return { authorization: 'Bearer ' + process.env[item.tokenEnv] };
  return null;
}

export function listFixtureRoles(fixtures) {
  return ['anonymous', ...(fixtures.roles || []).map(x => x.name).filter(Boolean)];
}

export function findObjectFixture(fixtures, objectType, id) {
  const collection = fixtures.objects?.[objectType];
  if (!collection) return null;
  const items = Array.isArray(collection) ? collection : Object.values(collection);
  return items.find(item => String(item.id) === String(id)) || null;
}

export function objectIdsForRole(fixtures, objectType, role) {
  const collection = fixtures.objects?.[objectType];
  if (!collection) return [];
  const items = Array.isArray(collection) ? collection : Object.values(collection);
  return items.filter(item => item.ownerRole === role || (Array.isArray(item.allowedRoles) && item.allowedRoles.includes(role))).map(item => item.id);
}
