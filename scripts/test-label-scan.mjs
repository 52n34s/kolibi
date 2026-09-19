#!/usr/bin/env node
/**
 * Manual smoke test for the label mode of the meal-vision-analyze edge function.
 *
 *   TEST_EMAIL=... TEST_PASSWORD=... node scripts/test-label-scan.mjs photo.jpg [more.jpg ...]
 *
 * Signs in as a real user, posts the photos in exactly the shape the app sends
 * (see src/services/mealVision/MealVisionService.ts) plus features: ['label'],
 * and prints the raw JSON response.
 *
 * Credentials come from the environment, Supabase URL/anon key from .env.local
 * or .env. Nothing is hard-coded here and nothing secret is printed.
 */

import { readFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';

import { createClient } from '@supabase/supabase-js';

const ENV_FILES = ['.env.local', '.env'];
const LANGUAGE = 'de';
const FEATURES = ['label'];

// Mirrors the edge function's own limits so we fail here instead of on a 400.
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 8 * 1024 * 1024;

const MEDIA_TYPE_BY_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

/** Minimal KEY=value reader; no export/quoting cleverness beyond trimming quotes. */
function readEnvFile(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return {};
  }

  const values = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

/** process.env wins, then .env.local, then .env. */
function loadEnv() {
  const merged = {};
  for (const file of [...ENV_FILES].reverse()) {
    Object.assign(merged, readEnvFile(resolve(process.cwd(), file)));
  }
  return { ...merged, ...process.env };
}

function requireEnv(env, key, hint) {
  const value = env[key]?.trim();
  if (!value) {
    fail(`${key} is not set (${hint})`);
  }
  return value;
}

function encodeImage(path) {
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch (error) {
    fail(`cannot read ${path}: ${error.message}`);
  }

  const mediaType = MEDIA_TYPE_BY_EXTENSION[extname(path).toLowerCase()];
  if (!mediaType) {
    fail(`${basename(path)}: only .jpg, .jpeg, .png and .webp are accepted`);
  }

  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    fail(
      `${basename(path)} is ${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB, ` +
        `the function rejects anything over ${MAX_IMAGE_BYTES / 1024 / 1024} MB`,
    );
  }

  return { bytes: bytes.byteLength, image: { mediaType, data: bytes.toString('base64') } };
}

function summarizePlausibility(plausibility) {
  if (!plausibility) {
    return null;
  }

  if (!plausibility.checked) {
    return 'plausibility: not checked (a macro was missing)';
  }

  const expected = [
    plausibility.expected_kcal_eu == null ? null : `EU ${plausibility.expected_kcal_eu}`,
    plausibility.expected_kcal_us == null ? null : `US ${plausibility.expected_kcal_us}`,
  ]
    .filter(Boolean)
    .join(', ');

  return `plausibility: ${plausibility.passed ? 'passed' : 'FAILED'} (expected ${expected} kcal)`;
}

async function main() {
  const imagePaths = process.argv.slice(2);
  if (imagePaths.length === 0) {
    console.error('usage: TEST_EMAIL=... TEST_PASSWORD=... node scripts/test-label-scan.mjs <image> [image ...]');
    process.exit(1);
  }

  if (imagePaths.length > MAX_IMAGES) {
    fail(`at most ${MAX_IMAGES} images per request`);
  }

  const env = loadEnv();
  const supabaseUrl = requireEnv(env, 'EXPO_PUBLIC_SUPABASE_URL', 'expected in .env.local or .env');
  const anonKey = requireEnv(env, 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'expected in .env.local or .env');
  const email = requireEnv(env, 'TEST_EMAIL', 'pass it in the environment, not in a file');
  const password = requireEnv(env, 'TEST_PASSWORD', 'pass it in the environment, not in a file');

  const encoded = imagePaths.map((path) => encodeImage(path));
  const totalBytes = encoded.reduce((sum, entry) => sum + entry.bytes, 0);
  if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
    fail(
      `${(totalBytes / 1024 / 1024).toFixed(2)} MB total, the function rejects anything over ` +
        `${MAX_TOTAL_IMAGE_BYTES / 1024 / 1024} MB`,
    );
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    fail(`sign-in failed: ${signInError.message}`);
  }

  const accessToken = signIn.session?.access_token;
  if (!accessToken) {
    fail('sign-in returned no session');
  }

  console.log(`signed in as ${email}`);
  console.log(
    `posting ${encoded.length} image(s), ${(totalBytes / 1024).toFixed(0)} KB, ` +
      `features=${JSON.stringify(FEATURES)}, language=${LANGUAGE}`,
  );

  const startedAt = Date.now();
  const response = await fetch(`${supabaseUrl}/functions/v1/meal-vision-analyze`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      images: encoded.map((entry) => entry.image),
      features: FEATURES,
      language: LANGUAGE,
    }),
  });

  const elapsedMs = Date.now() - startedAt;
  const bodyText = await response.text();

  console.log(`HTTP ${response.status} in ${elapsedMs} ms\n`);

  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    console.log(bodyText);
    await supabase.auth.signOut();
    process.exit(response.ok ? 0 : 1);
  }

  console.log(JSON.stringify(payload, null, 2));

  const summary = summarizePlausibility(payload?.plausibility);
  if (summary) {
    console.log(`\n${summary}`);
  }
  if (payload?.image_type === 'meal') {
    console.log('\nnote: the model classified this photo as a meal, not a label');
  }

  await supabase.auth.signOut();
  process.exit(response.ok ? 0 : 1);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
