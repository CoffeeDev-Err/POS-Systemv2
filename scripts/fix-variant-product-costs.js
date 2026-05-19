/**
 * Fix: Zero out item.cost for items sold as a simple product
 * but whose parent product NOW has variants (e.g. old Quail Eggs per-piece sales
 * that got cost=230 stamped from the bundle/tray cost).
 *
 * Run: node scripts/fix-variant-product-costs.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = resolve(__dirname, '../serviceAccountKey.json');

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
} catch {
  console.error('ERROR: serviceAccountKey.json not found.'); process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  // Build set of products that HAVE variants
  const productsSnap = await db.collection('products').get();
  const variantProductIds = new Set();
  productsSnap.forEach(doc => {
    if (doc.data().hasVariants) variantProductIds.add(doc.id);
  });
  console.log(`Variant products: ${[...variantProductIds].length}`);

  const txnsSnap = await db.collection('transactions').get();
  let updatedCount = 0;
  const batch = db.batch();
  let ops = 0;

  for (const txnDoc of txnsSnap.docs) {
    const txn = txnDoc.data();
    if (txn.status === 'void') continue;

    const items = txn.items || [];
    let needsUpdate = false;

    const updatedItems = items.map(item => {
      // Item was sold without a variant but its parent product now has variants
      // → the stamped cost is the bundle/parent cost, not per-selling-unit → clear it
      if (!item.variantId && variantProductIds.has(String(item.productId)) && Number(item.cost) > 0) {
        needsUpdate = true;
        console.log(`  Clear cost ${item.cost} → 0 | txn ${txnDoc.id} | product ${item.productId} | qty ${item.qty} @ ₱${item.price}`);
        return { ...item, cost: 0 };
      }
      return item;
    });

    if (needsUpdate) {
      batch.update(txnDoc.ref, { items: updatedItems });
      ops++;
      updatedCount++;
    }
  }

  if (ops > 0) {
    await batch.commit();
    console.log(`\n✅ Updated ${updatedCount} transactions.`);
  } else {
    console.log('\n✅ Nothing to fix.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
