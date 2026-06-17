import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = resolve(__dirname, '../serviceAccountKey.json');

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function detectIssues(product) {
  const issues = [];
  const baseUnit = (product.baseUnit || product.unit || '').toLowerCase();
  const variants = Array.isArray(product.variants) ? product.variants : [];

  if (product.hasVariants) {
    if (!product.baseUnit) {
      issues.push('missing baseUnit');
    }
    if (!variants.length) {
      issues.push('hasVariants=true but variants is empty');
    }
    for (const v of variants) {
      const rate = toNum(v.conversionRate, 1);
      const unit = (v.unit || '').toLowerCase();
      if (!v.unit) issues.push(`variant "${v.name || 'unnamed'}" missing unit`);
      if (rate <= 0) issues.push(`variant "${v.name || 'unnamed'}" has non-positive conversionRate`);
      if (rate > 1 && unit && unit === baseUnit) {
        issues.push(`variant "${v.name || 'unnamed'}" unit equals baseUnit (${v.unit}) with conversionRate ${rate}`);
      }
    }
  }

  return issues;
}

async function main() {
  const snap = await db.collection('products').get();
  const rows = [];

  snap.forEach((doc) => {
    const p = doc.data();
    const variants = Array.isArray(p.variants) ? p.variants : [];
    const issues = detectIssues(p);

    rows.push({
      id: doc.id,
      name: p.name || '',
      hasVariants: !!p.hasVariants,
      baseUnit: p.baseUnit || '',
      stock: toNum(p.stock, 0),
      variants: variants.map((v) => ({
        id: v.id || '',
        name: v.name || '',
        unit: v.unit || '',
        conversionRate: toNum(v.conversionRate, 1),
      })),
      issues,
    });
  });

  rows.sort((a, b) => a.name.localeCompare(b.name));

  console.log('=== UNIT CONVERSION AUDIT ===');
  for (const row of rows) {
    console.log(`\n- ${row.name} (${row.id})`);
    console.log(`  hasVariants: ${row.hasVariants} | baseUnit: ${row.baseUnit || '-'} | stock: ${row.stock}`);
    if (row.variants.length) {
      for (const v of row.variants) {
        console.log(`  variant: ${v.name} | unit: ${v.unit} | conversionRate: ${v.conversionRate}`);
      }
    }
    if (row.issues.length) {
      for (const issue of row.issues) {
        console.log(`  ISSUE: ${issue}`);
      }
    }
  }

  const withIssues = rows.filter((r) => r.issues.length > 0);
  console.log(`\nSummary: ${rows.length} products checked, ${withIssues.length} product(s) with issue(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
