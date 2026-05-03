const today = new Date();
const yd = new Date(today); yd.setDate(yd.getDate() - 1);
const td = (d) => d.toISOString().split('T')[0];

export const USERS = [
  { id: 1, name: 'Carren Santos',   username: 'owner',    password: 'owner123',   role: 'superadmin', active: true, createdAt: '2025-01-01' },
  { id: 2, name: 'Maria Cruz',      username: 'admin',    password: 'admin123',   role: 'admin',      active: true, createdAt: '2025-01-05' },
  { id: 3, name: 'Juan Dela Cruz',  username: 'cashier1', password: 'cashier123', role: 'cashier',    active: true, createdAt: '2025-01-10' },
  { id: 4, name: 'Ana Reyes',       username: 'cashier2', password: 'cashier456', role: 'cashier',    active: false, createdAt: '2025-02-01' },
];

export const CATEGORIES = ['Eggs', 'Mantika', 'Daily Needs'];

export const PRODUCTS = [
  { id: 1,  name: 'Itlog (per piraso)',   category: 'Eggs',        price: 8,   unit: 'pc',     stock: 360, lowStockAlert: 50  },
  { id: 2,  name: 'Itlog (per tray/30)', category: 'Eggs',        price: 210, unit: 'tray',   stock: 20,  lowStockAlert: 5   },
  { id: 3,  name: 'Mantika 250ml',        category: 'Mantika',     price: 35,  unit: 'btl',    stock: 48,  lowStockAlert: 10  },
  { id: 4,  name: 'Mantika 500ml',        category: 'Mantika',     price: 65,  unit: 'btl',    stock: 24,  lowStockAlert: 8   },
  { id: 5,  name: 'Mantika 1L',           category: 'Mantika',     price: 120, unit: 'btl',    stock: 4,   lowStockAlert: 5   },
  { id: 6,  name: 'Asin',                category: 'Daily Needs', price: 15,  unit: 'pack',   stock: 30,  lowStockAlert: 10  },
  { id: 7,  name: 'Toyo (Marca Pina)',    category: 'Daily Needs', price: 20,  unit: 'btl',    stock: 25,  lowStockAlert: 10  },
  { id: 8,  name: 'Suka',                category: 'Daily Needs', price: 18,  unit: 'btl',    stock: 6,   lowStockAlert: 8   },
  { id: 9,  name: 'Lucky Me Noodles',     category: 'Daily Needs', price: 12,  unit: 'pack',   stock: 100, lowStockAlert: 20  },
  { id: 10, name: '3-in-1 Kape',          category: 'Daily Needs', price: 8,   unit: 'sachet', stock: 200, lowStockAlert: 30  },
  { id: 11, name: 'Bigas (1kg)',          category: 'Daily Needs', price: 52,  unit: 'kg',     stock: 50,  lowStockAlert: 10  },
  { id: 12, name: 'Sukang Maasim',        category: 'Daily Needs', price: 22,  unit: 'btl',    stock: 15,  lowStockAlert: 5   },
];

export const TRANSACTIONS = [
  {
    id: 'TXN-20250415-0001', date: td(today), time: '08:30',
    cashierId: 3, cashierName: 'Juan Dela Cruz',
    items: [
      { productId: 1, name: 'Itlog (per piraso)', qty: 12, price: 8,  total: 96  },
      { productId: 6, name: 'Asin',               qty: 1,  price: 15, total: 15  },
    ],
    subtotal: 111, cash: 150, change: 39,
  },
  {
    id: 'TXN-20250415-0002', date: td(today), time: '09:15',
    cashierId: 3, cashierName: 'Juan Dela Cruz',
    items: [
      { productId: 3, name: 'Mantika 250ml',   qty: 2, price: 35, total: 70  },
      { productId: 9, name: 'Lucky Me Noodles', qty: 5, price: 12, total: 60  },
    ],
    subtotal: 130, cash: 200, change: 70,
  },
  {
    id: 'TXN-20250415-0003', date: td(today), time: '10:45',
    cashierId: 3, cashierName: 'Juan Dela Cruz',
    items: [
      { productId: 2,  name: 'Itlog (per tray/30)', qty: 1, price: 210, total: 210 },
      { productId: 4,  name: 'Mantika 500ml',        qty: 1, price: 65,  total: 65  },
      { productId: 10, name: '3-in-1 Kape',           qty: 3, price: 8,   total: 24  },
    ],
    subtotal: 299, cash: 300, change: 1,
  },
];

export const AUDIT_LOGS = [
  { id: 1, user: 'Carren Santos',  action: 'Added product: Itlog (per piraso)',          timestamp: `${td(today)} 07:00` },
  { id: 2, user: 'Maria Cruz',     action: 'Stock-in: Itlog (per piraso) +200 pcs',      timestamp: `${td(today)} 07:30` },
  { id: 3, user: 'Juan Dela Cruz', action: 'Transaction TXN-20250415-0001 completed',    timestamp: `${td(today)} 08:30` },
  { id: 4, user: 'Juan Dela Cruz', action: 'Transaction TXN-20250415-0002 completed',    timestamp: `${td(today)} 09:15` },
  { id: 5, user: 'Maria Cruz',     action: 'Updated price: Mantika 500ml → PHP 65',      timestamp: `${td(yd)} 16:00`   },
];
