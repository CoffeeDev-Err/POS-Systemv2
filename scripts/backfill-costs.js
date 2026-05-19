/**
 * Backfill Transaction Item Costs
 * 
 * Stamps the correct `cost` per selling unit onto every transaction item
 * that has no cost (or cost = 0). Uses current product/variant costs from Firestore.
 * 
 * Run: node scripts/backfill-costs.js
 * Requires: serviceAccountKey.json in project root
 *   Firebase Console → Project Settings → Service accounts → Generate new private key
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
  console.error('ERROR: serviceAccountKey.json not found in project root.');
  console.error('Download from: Firebase Console → Project Settings → Service accounts → Generate new private key');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  console.log('Loading products...');
  const productsSnap = await db.collection('products').get();

  // Build cost maps from current product data
  const variantCostMap = new Map();  // variantId → cost per selling unit
  const productCostMap = new Map();  // productId → cost per selling unit

  productsSnap.forEach(doc => {
    const p = doc.data();
    productCostMap.set(doc.id, Number(p.cost || 0));
    if (p.hasVariants && Array.isArray(p.variants)) {
      p.variants.forEach(v => {
        if (v.id) variantCostMap.set(v.id, Number(v.cost || 0));
      });
    }
  });

  console.log(`  ${productCostMap.size} products, ${variantCostMap.size} variants loaded.`);

  console.log('Loading transactions...');
  const txnsSnap = await db.collection('transactions').get();
  console.log(`  ${txnsSnap.size} transactions found.`);

  let updatedCount = 0;
  let skippedCount = 0;
  const batchSize = 400; // Firestore batch limit is 500
  let batch = db.batch();
  let opsInBatch = 0;

  for (const txnDoc of txnsSnap.docs) {
    const txn = txnDoc.data();
    if (txn.status === 'void') { skippedCount++; continue; }

    const items = txn.items || [];
    let needsUpdate = false;

    const updatedItems = items.map(item => {
      // Skip items that already have a valid cost saved
      if (Number(item.cost) > 0) return item;

      let unitCost = 0;
      if (item.variantId) {
        const vc = variantCostMap.get(item.variantId);
        unitCost = (typeof vc === 'number' && vc > 0) ? vc : 0;
      } else {
        const pc = productCostMap.get(String(item.productId));
        unitCost = (typeof pc === 'number' && pc > 0) ? pc : 0;
      }

      if (unitCost > 0) {
        needsUpdate = true;
        return { ...item, cost: unitCost };
      }
      return item;
    });

    if (needsUpdate) {
      batch.update(txnDoc.ref, { items: updatedItems });
      opsInBatch++;
      updatedCount++;

      if (opsInBatch >= batchSize) {
        await batch.commit();
        console.log(`  Committed batch of ${opsInBatch} updates...`);
        batch = db.batch();
        opsInBatch = 0;
      }
    } else {
      skippedCount++;
    }
  }

  if (opsInBatch > 0) {
    await batch.commit();
    console.log(`  Committed final batch of ${opsInBatch} updates.`);
  }

  console.log('\n✅ Done!');
  console.log(`   Updated : ${updatedCount} transactions`);
  console.log(`   Skipped : ${skippedCount} transactions (void or already had costs)`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
