/**
 * react-native-country-picker-modal still imports SafeAreaView from
 * 'react-native' (deprecated). Swap it for react-native-safe-area-context.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const target = join(
  process.cwd(),
  'node_modules/react-native-country-picker-modal/lib/CountryModal.js',
);

if (!existsSync(target)) {
  console.warn('[patch-country-picker] package not found, skip');
  process.exit(0);
}

const source = readFileSync(target, 'utf8');
const fromRn =
  "import { SafeAreaView, StyleSheet, Platform } from 'react-native';";
const toSafe = [
  "import { StyleSheet, Platform } from 'react-native';",
  "import { SafeAreaView } from 'react-native-safe-area-context';",
].join('\n');

if (source.includes("from 'react-native-safe-area-context'")) {
  console.log('[patch-country-picker] already patched');
  process.exit(0);
}

if (!source.includes(fromRn)) {
  console.warn('[patch-country-picker] unexpected file contents, skip');
  process.exit(0);
}

writeFileSync(target, source.replace(fromRn, toSafe), 'utf8');
console.log('[patch-country-picker] patched CountryModal.js');
