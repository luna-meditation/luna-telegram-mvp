import assert from 'node:assert/strict';
// PostgREST serializes timestamptz with +00:00, while JS writes ISO Z. Compare
// the same instant rather than treating an equivalent serialization as drift.
// Values are NOT rewritten; restoration still uses updated-at compare-and-set.
export function comparableQaSettings(row){return Object.fromEntries(Object.entries(row).filter(([key])=>key!=='updated_at').map(([key,value])=>[key,typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(value)&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():value]));}
export function assertQaSettingsUnchanged(actual,expected){assert.deepEqual(comparableQaSettings(actual),comparableQaSettings(expected),'Do not overwrite concurrent staging configuration');}
