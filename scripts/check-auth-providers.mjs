#!/usr/bin/env node
// Read public Auth configuration without starting an authentication flow.
// Endpoint: https://supabase.com/docs/guides/self-hosting/self-hosted-oauth
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const PROJECT_REF = 'ahvyieyojqciohdogsqc';
const PROJECT_ORIGIN = `https://${PROJECT_REF}.supabase.co`;
const APP_URL = 'https://undead41.github.io/xylo-studio/';
const TIMEOUT_MS = 10_000;

class CheckError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function help() {
  console.log(`Usage: node scripts/check-auth-providers.mjs [--config path] [--require-all]

Read public Supabase Auth settings for e-Instru Studio only.
This makes one GET /auth/v1/settings request with a publishable apikey.
It does not sign in, create users, or send email/SMS.

Configuration:
  Without --config, set EINSTRU_SUPABASE_URL and
  EINSTRU_SUPABASE_PUBLISHABLE_KEY in the environment.
  --config path reads a JSON object containing only:
    { "supabaseUrl": "${PROJECT_ORIGIN}", "publishableKey": "sb_publishable_..." }
  The file replaces environment configuration; no other files are read.
  Only sb_publishable_ keys and the exact project above are accepted.

Options:
  --config path   Read the explicitly supplied public JSON configuration.
  --require-all   Exit 2 if email, Google, or phone is not reported enabled.
  --help         Show this help without reading configuration or using the network.

Output contains public configuration flags only; delivery and sign-in remain untested.
Request timeout: 10 seconds. HTTP redirects are refused.
Exit codes: 0 settings read, 1 error, 2 required provider missing.
`);
}

function options() {
  try {
    return parseArgs({
      options: {
        config: { type: 'string' },
        'require-all': { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch {
    // Do not echo arguments: a caller may have accidentally supplied a secret.
    throw new CheckError('invalid_arguments', 'Invalid arguments. Use --help for usage.');
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function configuration(configPath) {
  if (configPath === undefined) {
    return {
      supabaseUrl: process.env.EINSTRU_SUPABASE_URL,
      publishableKey: process.env.EINSTRU_SUPABASE_PUBLISHABLE_KEY,
    };
  }

  let config;
  try {
    config = JSON.parse(await readFile(configPath, 'utf8'));
  } catch {
    throw new CheckError('invalid_config', 'Unable to read the supplied public JSON configuration.');
  }
  if (!isObject(config) || Object.keys(config).some(key => !['supabaseUrl', 'publishableKey'].includes(key))) {
    throw new CheckError('invalid_config', 'The configuration must contain only supabaseUrl and publishableKey.');
  }
  return { supabaseUrl: config.supabaseUrl, publishableKey: config.publishableKey };
}

function validateConfiguration({ supabaseUrl, publishableKey }) {
  let url;
  try {
    if (typeof supabaseUrl !== 'string' || !supabaseUrl.trim()) throw new Error();
    url = new URL(supabaseUrl.trim());
  } catch {
    throw new CheckError('invalid_project', 'A valid HTTPS Supabase project URL is required.');
  }
  if (url.origin !== PROJECT_ORIGIN || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new CheckError('invalid_project', `Only the HTTPS Supabase project ${PROJECT_REF} is allowed.`);
  }
  if (typeof publishableKey !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
    throw new CheckError('invalid_key', 'A public sb_publishable_ key is required; other key types are refused.');
  }
  return publishableKey;
}

function publicFlag(object, key) {
  const value = object[key];
  if (value === undefined) return null;
  if (typeof value !== 'boolean') {
    throw new CheckError('invalid_response', 'Auth settings contained an invalid public flag.');
  }
  return value;
}

function invertedFlag(object, key) {
  const value = publicFlag(object, key);
  return value === null ? null : !value;
}

async function check(publishableKey, requireAll) {
  let response;
  let settings;
  try {
    response = await fetch(`${PROJECT_ORIGIN}/auth/v1/settings`, {
      method: 'GET',
      headers: { apikey: publishableKey, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new CheckError('http_error', `Auth settings request failed (HTTP ${response.status}).`);
    }
    settings = await response.json();
  } catch (error) {
    if (error instanceof CheckError) throw error;
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new CheckError('timeout', 'Auth settings request exceeded the 10-second timeout.');
    }
    // Never expose transport messages, response bodies, headers, or credentials.
    throw new CheckError('request_failed', 'Unable to read Auth settings; check connectivity and public configuration.');
  }

  if (!isObject(settings) || !isObject(settings.external)) {
    throw new CheckError('invalid_response', 'Auth settings did not contain public provider flags.');
  }
  const providers = {
    email: publicFlag(settings.external, 'email'),
    google: publicFlag(settings.external, 'google'),
    phone: publicFlag(settings.external, 'phone'),
  };
  const missingProviders = Object.keys(providers).filter(provider => providers[provider] !== true);
  console.log(JSON.stringify({
    projectRef: PROJECT_REF,
    appUrl: APP_URL,
    checkedAt: new Date().toISOString(),
    providers,
    emailConfirmationRequired: invertedFlag(settings, 'mailer_autoconfirm'),
    phoneConfirmationRequired: invertedFlag(settings, 'phone_autoconfirm'),
    signupsEnabled: invertedFlag(settings, 'disable_signup'),
    verification: {
      publicSettingsRead: true,
      emailDelivery: 'untested',
      smsDelivery: 'untested',
      googleSignIn: 'untested',
      endToEndVerified: false,
    },
    ...(requireAll ? { missingProviders } : {}),
  }, null, 2));
  return requireAll && missingProviders.length ? 2 : 0;
}

try {
  const args = options();
  if (args.help) {
    help();
  } else {
    const publishableKey = validateConfiguration(await configuration(args.config));
    process.exitCode = await check(publishableKey, args['require-all']);
  }
} catch (error) {
  console.error(JSON.stringify({
    projectRef: PROJECT_REF,
    appUrl: APP_URL,
    checkedAt: new Date().toISOString(),
    error: error instanceof CheckError
      ? { code: error.code, message: error.message }
      : { code: 'check_failed', message: 'The public Auth settings check failed.' },
  }, null, 2));
  process.exitCode = 1;
}
