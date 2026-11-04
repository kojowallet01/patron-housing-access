 import { randomBytes } from 'node:crypto';
import { deleteAllSessions, init, setSetting } from './db.js';

const CAMPUS_LIST = [
  'TESANO CAMPUS',
  'CANTOMENT CAMPUS',
  'ASHIAMAN CAMPUS',
  'LEGON CAMPUS',
  'TEMA CAMPUS'
];

const ROLE_KEYS = {
  admin: 'campus_admin_tokens',
  security: 'campus_security_tokens',
  'super-admin': 'campus_super_admin_tokens'
};

function parseArgs(argv) {
  const args = { reset: true, clearOnly: false, dryRun: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--clear-only') args.clearOnly = true;
    if (arg === '--dry-run') args.dryRun = true;
    if (arg === '--no-reset') args.reset = false;
    if (arg === '--help' || arg === '-h') args.help = true;
  }

  return args;
}

function securePassword(length = 24) {
  return randomBytes(length).toString('base64url').slice(0, length);
}

function makeMap(valueFactory) {
  return Object.fromEntries(CAMPUS_LIST.map((campus) => [campus, valueFactory(campus)]));
}

function printUsage() {
  console.log('Usage: node server/reset-campus-passwords.js [--clear-only] [--dry-run] [--no-reset]');
  console.log('');
  console.log('Defaults to generating fresh secure passwords for all campuses and roles.');
  console.log('--clear-only   Writes empty maps instead of generating new passwords.');
  console.log('--dry-run     Prints the result without writing to the database.');
  console.log('--no-reset    Clears the stored values without replacing them.');
}

async function writeCampusMap(role, map, dryRun) {
  const key = ROLE_KEYS[role];
  if (dryRun) {
    return map;
  }

  await setSetting(key, JSON.stringify(map));
  return map;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  await init();

  const output = {};
  for (const role of Object.keys(ROLE_KEYS)) {
    const map = options.clearOnly || !options.reset
      ? makeMap(() => '')
      : makeMap(() => securePassword());

    output[role] = map;
    await writeCampusMap(role, map, options.dryRun);
  }

  if (!options.dryRun) {
    await deleteAllSessions();
  }

  console.log('Campus password reset complete.');
  if (options.dryRun) {
    console.log('Dry run only — no database changes were written.');
  }

  console.log(JSON.stringify(output, null, 2));
  console.log('');
  console.log('Store these values in a secure credential manager or your deployment secret store.');
  console.log('Do not commit them to source control or print them in shared logs.');
}

main().catch((error) => {
  console.error('Password reset failed:', error);
  process.exitCode = 1;
});
