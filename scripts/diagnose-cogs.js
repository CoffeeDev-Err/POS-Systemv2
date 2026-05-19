/**
 * Diagnostic: Find transaction items where COGS > item total (cost > selling price)
 * Run: node scripts/diagnose-cogs.js
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
  console.error('ERROR: serviceAccountKey.json not found.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  const productsSnap = await db.collection('products').get();

  const variantCostMap = new Map();
  const variantNameMap = new Map();
  const productCostMap = new Map();
  const productNameMap = new Map();

  productsSnap.forEach(doc => {
    const p = doc.data();
    productCostMap.set(doc.id, Number(p.cost || 0));
    productNameMap.set(doc.id, p.name || doc.id);
    if (p.hasVariants && Array.isArray(p.variants)) {
      p.variants.forEach(v => {
        if (v.id) {
          variantCostMap.set(v.id, Number(v.cost || 0));
          variantNameMap.set(v.id, v.name || v.id);
        }
      });
    }
  });

  const txnsSnap = await db.collection('transactions').get();

  let totalSales = 0;
  let totalCogs = 0;
  let problemCount = 0;

  for (const txnDoc of txnsSnap.docs) {
    const txn = txnDoc.data();
    if (txn.status === 'void') continue;

    for (const item of (txn.items || [])) {
      const qty   = Number(item.qty || 0);
      const price = Number(item.price || 0);
      const saleAmt = Number(item.total || (qty * price));

      let unitCost = 0;
      let costSource = '';
      if (Number(item.cost) > 0) {
        unitCost = Number(item.cost);
        costSource = 'saved';
      } else if (item.variantId) {
        const vc = variantCostMap.get(item.variantId);
        unitCost = (Number.isFinite(vc) && vc > 0) ? vc : 0;
        costSource = unitCost > 0 ? 'variantMap' : 'missing(0)';
      } else {
        const pc = productCostMap.get(String(item.productId));
        unitCost = (Number.isFinite(pc) && pc > 0) ? pc : 0;
        costSource = unitCost > 0 ? 'productMap' : 'missing(0)';
      }

      const itemCost = unitCost * qty;
      totalSales += saleAmt;
      totalCogs  += itemCost;

      if (itemCost > saleAmt + 0.01) {
        problemCount++;
        const productName = productNameMap.get(String(item.productId)) || item.name || '?';
        const variantName = item.variantId ? (variantNameMap.get(item.variantId) || item.variantName || item.variantId) : '-';
        console.log(`\n⚠️  COGS > Sale | txn: ${txnDoc.id} | date: ${txn.date}`);
        console.log(`   Product  : ${productName} / variant: ${variantName}`);
        console.log(`   qty      : ${qty}  |  price: ${price}  |  sale: ${saleAmt}`);
        console.log(`   unitCost : ${unitCost} (${costSource})  |  COGS: ${itemCost}`);
        console.log(`   variantId: ${item.variantId || 'none'}`);
        console.log(`   convRate : ${item.conversionRate || 1}`);
      }
    }
  }

  console.log(`\n── Summary ──────────────────────────`);
  console.log(`Total Sales : ₱${totalSales.toFixed(2)}`);
  console.log(`Total COGS  : ₱${totalCogs.toFixed(2)}`);
  console.log(`Margin      : ₱${(totalSales - totalCogs).toFixed(2)}`);
  console.log(`Problem items: ${problemCount}`);
}

main().catch(err => { console.error(err); process.exit(1); });
