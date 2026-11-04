#!/usr/bin/env node
// Local-only: validate the source templates or print the hosted Auth PATCH body.
// This script makes no network request and does not read credentials.
import { readFileSync } from 'node:fs';
import { dirname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
  throw new Error('Usage: node supabase/templates/build-config.mjs [--check]');
}

const expectedIds = new Set([
  'confirmation', 'invite', 'magic_link', 'email_change', 'recovery',
  'reauthentication', 'password_changed_notification',
  'email_changed_notification', 'phone_changed_notification',
  'identity_linked_notification', 'identity_unlinked_notification',
  'mfa_factor_enrolled_notification', 'mfa_factor_unenrolled_notification',
]);
const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8'));
if (manifest.version !== 1 || manifest.locale !== 'ms' || manifest.templates.length !== 13) {
  throw new Error('Expected the version 1 Malay manifest with all 13 templates.');
}

const payload = {};
let notifications = 0;
for (const template of manifest.templates) {
  if (!expectedIds.delete(template.id) || basename(template.file) !== template.file ||
      template.file !== `${template.id}.html`) {
    throw new Error(`Unknown, duplicate or unsafe template: ${template.id}`);
  }
  if (template.subject_key !== `mailer_subjects_${template.id}` ||
      template.content_key !== `mailer_templates_${template.id}_content`) {
    throw new Error(`Unexpected Management API field for ${template.id}`);
  }
  const html = readFileSync(join(directory, template.file), 'utf8');
  const actualVariables = new Set([...html.matchAll(/\.([A-Z][A-Za-z]*)\b/g)].map(match => match[1]));
  if (!template.subject || !html.startsWith('<!doctype html>') || !html.includes('lang="ms"') ||
      actualVariables.size !== template.variables.length ||
      template.variables.some(variable => !actualVariables.has(variable))) {
    throw new Error(`Invalid HTML, subject or variable declaration for ${template.id}`);
  }
  payload[template.subject_key] = template.subject;
  payload[template.content_key] = html;
  if (template.category === 'security') {
    const event = template.id.replace(/_notification$/, '');
    if (template.enabled_key !== `mailer_notifications_${event}_enabled`) {
      throw new Error(`Unexpected notification field for ${template.id}`);
    }
    payload[template.enabled_key] = true;
    notifications += 1;
  } else if (template.category !== 'authentication' || template.enabled_key) {
    throw new Error(`Invalid category or notification field for ${template.id}`);
  }
}
if (expectedIds.size || notifications !== 7 || Object.keys(payload).length !== 33) {
  throw new Error('Expected 13 templates, seven notification flags and 33 Auth fields.');
}

if (args[0] === '--check') {
  console.log('Validated 13 Malay templates, seven notification flags and 33 Auth fields.');
} else {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}
