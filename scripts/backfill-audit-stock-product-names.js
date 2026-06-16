/**
 * Backfill Audit Logs: Replace Stock-in product IDs with product names
 *
 * Usage:
 *   node scripts/backfill-audit-stock-product-names.js          # dry run
 *   node scripts/backfill-audit-stock-product-names.js --apply  # write changes
 *
 * Requires: serviceAccountKey.json in project root
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = resolve(__dirname, '../serviceAccountKey.json');
const isApply = process.argv.includes('--apply');

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
} catch {
  console.error('ERROR: serviceAccountKey.json not found in project root.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Matches: Stock-in: 100 × "abc123..."  (quote can be single or double)
const STOCK_IN_REGEX = /^(Stock-in:\s*[0-9]+(?:\.[0-9]+)?\s*[x×]\s*)(["'])([^"']+)(["'])/i;

async function main() {
  console.log('=== Backfill Stock-in Audit Product Names ===');
  console.log(`Mode: ${isApply ? 'APPLY' : 'DRY-RUN'}`);

  const productsSnap = await db.collection('products').get();
  const productNameById = new Map();
  productsSnap.forEach((docSnap) => {
    const data = docSnap.data() || {};
    productNameById.set(docSnap.id, data.name || docSnap.id);
  });

  const logsSnap = await db.collection('auditLogs').get();

  let scanned = 0;
  let stockInEntries = 0;
  let idMatched = 0;
  let alreadyNamed = 0;
  let changed = 0;

  let batch = db.batch();
  let batchOps = 0;
  const BATCH_LIMIT = 400;

  for (const logDoc of logsSnap.docs) {
    scanned += 1;
    const data = logDoc.data() || {};
    const action = String(data.action || '');
    const match = action.match(STOCK_IN_REGEX);

    if (!match) continue;
    stockInEntries += 1;

    const productToken = match[3];
    const resolvedName = productNameById.get(productToken);

    if (!resolvedName) {
      // Token is likely already a product name, not a product document id.
      alreadyNamed += 1;
      continue;
    }

    idMatched += 1;

    if (resolvedName === productToken) {
      alreadyNamed += 1;
      continue;
    }

    const updatedAction = `${match[1]}${match[2]}${resolvedName}${match[4]}${action.slice(match[0].length)}`;

    console.log(`- ${logDoc.id}`);
    console.log(`  old: ${action}`);
    console.log(`  new: ${updatedAction}`);

    changed += 1;

    if (isApply) {
      batch.update(logDoc.ref, {
        action: updatedAction,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      batchOps += 1;

      if (batchOps >= BATCH_LIMIT) {
        await batch.commit();
        batch = db.batch();
        batchOps = 0;
      }
    }
  }

  if (isApply && batchOps > 0) {
    await batch.commit();
  }

  console.log('\n=== Summary ===');
  console.log(`Scanned logs       : ${scanned}`);
  console.log(`Stock-in entries   : ${stockInEntries}`);
  console.log(`Product-id matches : ${idMatched}`);
  console.log(`Converted entries  : ${changed}`);
  console.log(`Already named      : ${alreadyNamed}`);

  if (!isApply) {
    console.log('\nDry-run only. Re-run with --apply to persist changes.');
  } else {
    console.log('\nApplied successfully.');
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
