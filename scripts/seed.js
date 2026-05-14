/**
 * Firebase Seed Script
 * Run: node scripts/seed.js
 * Requires: serviceAccountKey.json in project root (download from Firebase Console)
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
  console.error('Download it from: Firebase Console → Project Settings → Service accounts → Generate new private key');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth();
const db = admin.firestore();

// ── seed data ──────────────────────────────────────────────────────────────────

const USERS = [
  { name: 'Carren Santos',  username: 'owner',    email: 'owner@carrens.store',    password: 'owner123',   role: 'superadmin', active: true  },
  { name: 'Maria Cruz',     username: 'admin',    email: 'admin@carrens.store',    password: 'admin123',   role: 'admin',      active: true  },
  { name: 'Juan Dela Cruz', username: 'cashier1', email: 'cashier1@carrens.store', password: 'cashier123', role: 'cashier',    active: true  },
  { name: 'Ana Reyes',      username: 'cashier2', email: 'cashier2@carrens.store', password: 'cashier456', role: 'cashier',    active: false },
];

const CATEGORIES = ['Eggs', 'Mantika', 'Daily Needs'];

const PRODUCTS = [
  { name: 'Itlog (per piraso)',   category: 'Eggs',        price: 8,   unit: 'pc',     stock: 360, lowStockAlert: 50  },
  { name: 'Itlog (per tray/30)', category: 'Eggs',        price: 210, unit: 'tray',   stock: 20,  lowStockAlert: 5   },
  { name: 'Mantika 250ml',        category: 'Mantika',     price: 35,  unit: 'btl',    stock: 48,  lowStockAlert: 10  },
  { name: 'Mantika 500ml',        category: 'Mantika',     price: 65,  unit: 'btl',    stock: 24,  lowStockAlert: 8   },
  { name: 'Mantika 1L',           category: 'Mantika',     price: 120, unit: 'btl',    stock: 4,   lowStockAlert: 5   },
  { name: 'Asin',                category: 'Daily Needs', price: 15,  unit: 'pack',   stock: 30,  lowStockAlert: 10  },
  { name: 'Toyo (Marca Pina)',    category: 'Daily Needs', price: 20,  unit: 'btl',    stock: 25,  lowStockAlert: 10  },
  { name: 'Suka',                category: 'Daily Needs', price: 18,  unit: 'btl',    stock: 6,   lowStockAlert: 8   },
  { name: 'Lucky Me Noodles',     category: 'Daily Needs', price: 12,  unit: 'pack',   stock: 100, lowStockAlert: 20  },
  { name: '3-in-1 Kape',          category: 'Daily Needs', price: 8,   unit: 'sachet', stock: 200, lowStockAlert: 30  },
  { name: 'Bigas (1kg)',          category: 'Daily Needs', price: 52,  unit: 'kg',     stock: 50,  lowStockAlert: 10  },
  { name: 'Sukang Maasim',        category: 'Daily Needs', price: 22,  unit: 'btl',    stock: 15,  lowStockAlert: 5   },
];

const SETTINGS = {
  storeName: "CARREN'S STORE",
  address: 'Urdaneta, Ilocos',
  phone: '09XX-XXX-XXXX',
  receiptFooter: 'Salamat sa inyong pagbili! Please come again :)',
};

// ── helpers ────────────────────────────────────────────────────────────────────

async function seedUsers() {
  console.log('\n[Users]');
  for (const u of USERS) {
    try {
      // Create Firebase Auth user
      const record = await auth.createUser({ email: u.email, password: u.password, displayName: u.name });
      // Store profile in Firestore (no password)
      await db.collection('users').doc(record.uid).set({
        name: u.name,
        username: u.username,
        email: u.email,
        role: u.role,
        active: u.active,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`  ✓ ${u.username} (${u.role}) — uid: ${record.uid}`);
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        console.log(`  ~ ${u.username} already exists, skipping Auth creation`);
      } else {
        console.error(`  ✗ ${u.username}: ${err.message}`);
      }
    }
  }
}

async function seedCategories() {
  console.log('\n[Categories]');
  for (const name of CATEGORIES) {
    const ref = await db.collection('categories').add({ name });
    console.log(`  ✓ ${name} — id: ${ref.id}`);
  }
}

async function seedProducts() {
  console.log('\n[Products]');
  for (const p of PRODUCTS) {
    const ref = await db.collection('products').add({ ...p, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`  ✓ ${p.name} — id: ${ref.id}`);
  }
}

async function seedSettings() {
  console.log('\n[Settings]');
  await db.collection('settings').doc('global').set(SETTINGS);
  console.log('  ✓ global settings saved');
}

// ── main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Firebase Seed Script ===');
  console.log(`Project: ${serviceAccount.project_id}`);

  await seedUsers();
  await seedCategories();
  await seedProducts();
  await seedSettings();

  console.log('\n✅ Seeding complete!');
  console.log('\nLogin credentials:');
  for (const u of USERS) {
    console.log(`  ${u.role.padEnd(12)} username: ${u.username.padEnd(10)} email: ${u.email.padEnd(28)} password: ${u.password}`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
