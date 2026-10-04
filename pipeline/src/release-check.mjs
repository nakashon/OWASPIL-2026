#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../..');

export function publicationBlocker(file) {
  if (file.startsWith('data/') &&
      !/^data\/(?:README\.md|derived\/stats\.(?:md|json))$/.test(file)) {
    return 'Dataset stage or artifact not approved for publication';
  }
  if (file.startsWith('pipeline/') &&
      !/^pipeline\/(?:package\.json|(?:src|test)\/[^/]+\.mjs)$/.test(file)) {
    return 'Unexpected pipeline artifact; only source, tests, and package manifest are publishable';
  }
  if (/(?:^|\/)(?:_chat\.txt|\.env(?:\..*)?|ANON_SALT[^/]*|[^/]+\.salt)$/i.test(file) ||
      /\.zip$/i.test(file)) {
    return 'Potential chat export, environment file, or anonymization salt';
  }
  return null;
}

export function findBlockedPaths(files) {
  return [...new Set(files)].filter(Boolean).flatMap((file) => {
    const reason = publicationBlocker(file);
    return reason ? [{ file, reason }] : [];
  });
}

export function hasPrivatePhone(text) {
  return /\+9725[0-9]{8}/.test(text);
}

function git(args) {
  return execFileSync('git', ['-C', ROOT, ...args], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

function printBlockers(label, blockers) {
  if (!blockers.length) return;
  console.error(`${label}: ${blockers.length} blocked path(s).`);
  for (const { file, reason } of blockers.slice(0, 10)) {
    console.error(`  ${JSON.stringify(file)}: ${reason}`);
  }
  if (blockers.length > 10) console.error('  Further paths omitted; inspect filenames with git ls-files.');
}

function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--history')) {
    console.error('Usage: npm run check:release -- [--history]');
    process.exitCode = 2;
    return;
  }
  const files = [...new Set(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
    .split('\0').filter(Boolean))];
  const blockers = findBlockedPaths(files);
  printBlockers('Working tree/index publication check', blockers);

  // Do not read restricted data to report that its path is not publishable.
  const phones = [];
  for (const file of files) {
    if (publicationBlocker(file) || !/\.(?:md|mjs|html|json|ya?ml|txt|svg)$/.test(file)) continue;
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) {
      blockers.push({ file, reason: 'Tracked file is missing; stage or restore its intended state' });
      console.error(`Missing tracked file: ${JSON.stringify(file)}`);
      continue;
    }
    if (hasPrivatePhone(fs.readFileSync(full, 'utf8'))) phones.push(file);
  }
  for (const file of phones) console.error(`Possible private phone number in ${JSON.stringify(file)} (value suppressed).`);

  let history = [];
  let incompleteHistory = false;
  if (args.includes('--history')) {
    incompleteHistory = git(['rev-parse', '--is-shallow-repository']).trim() === 'true';
    if (incompleteHistory) {
      console.error('History check is incomplete: a shallow checkout cannot establish publication readiness.');
    }
    history = findBlockedPaths(git(['log', '--all', '--format=', '--name-only', '-z'])
      .split('\0').map((file) => file.replace(/^\n+/, '')).filter(Boolean));
    printBlockers('Reachable local history publication check', history);
  }

  if (blockers.length || phones.length || history.length || incompleteHistory) {
    console.error('NOT READY for publication. Ignoring or deleting a file does not remove earlier revisions.');
    console.error('Keep the repository private pending review. This check does not rewrite or delete anything.');
    process.exitCode = 1;
    return;
  }
  console.log('Automated path and phone checks passed for the inspected scope.');
  console.log('Not a privacy certification: manually review prose, media, names, secrets, and release history.');
  if (!args.includes('--history')) console.log('Before publishing, also run with --history in a complete checkout.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
