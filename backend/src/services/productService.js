const { getPool } = require('../config/db');
const { ApiError } = require('../utils/errors');
const { logAudit } = require('../utils/audit');
const categoryRepository = require('../repositories/categoryRepository');
const productRepository = require('../repositories/productRepository');
const stockMovementRepository = require('../repositories/stockMovementRepository');

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    cost: Number(row.cost),
    unit: row.unit,
    stock: Number(row.stock),
    lowStockAlert: Number(row.lowStockAlert),
    active: Number(row.active) === 1,
  };
}

async function listProducts() {
  const pool = getPool();
  const rows = await productRepository.listProducts(pool);
  return rows.map(mapProduct);
}

async function createProduct(payload, userId) {
  const categoryName = String(payload.category || '').trim();

  if (!payload.name || !categoryName || !payload.unit) {
    throw ApiError.badRequest('Name, category, and unit are required.');
  }

  const pool = getPool();
  let category = await categoryRepository.findByName(pool, categoryName);
  if (!category) {
    category = await categoryRepository.createCategory(pool, categoryName);
  }

  const productId = await productRepository.createProduct(pool, {
    name: payload.name,
    categoryId: category.id,
    price: Number(payload.price || 0),
    cost: Number(payload.cost || 0),
    unit: payload.unit,
    stock: Number(payload.stock || 0),
    lowStockAlert: Number(payload.lowStockAlert || 0),
    active: payload.active === false ? 0 : 1,
  });

  const created = await productRepository.findById(pool, productId);
  await logAudit(userId, `Added product: ${payload.name}`);
  return mapProduct(created);
}

async function updateProduct(id, payload, userId) {
  const categoryName = String(payload.category || '').trim();
  if (!id) {
    throw ApiError.badRequest('Invalid product id.');
  }
  if (!payload.name || !categoryName || !payload.unit) {
    throw ApiError.badRequest('Name, category, and unit are required.');
  }

  const pool = getPool();
  let category = await categoryRepository.findByName(pool, categoryName);
  if (!category) {
    category = await categoryRepository.createCategory(pool, categoryName);
  }

  const affected = await productRepository.updateProduct(pool, id, {
    name: payload.name,
    categoryId: category.id,
    price: Number(payload.price || 0),
    cost: Number(payload.cost || 0),
    unit: payload.unit,
    stock: Number(payload.stock || 0),
    lowStockAlert: Number(payload.lowStockAlert || 0),
    active: payload.active === false ? 0 : 1,
  });

  if (!affected) {
    throw ApiError.notFound('Product not found.');
  }

  const updated = await productRepository.findById(pool, id);
  await logAudit(userId, `Updated product: ${payload.name}`);
  return mapProduct(updated);
}

async function deleteProduct(id, userId) {
  if (!id) {
    throw ApiError.badRequest('Invalid product id.');
  }

  const pool = getPool();
  const existing = await productRepository.findById(pool, id);
  if (!existing) {
    throw ApiError.notFound('Product not found.');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await stockMovementRepository.deleteByProductIds(conn, [id]);
    await productRepository.deleteProduct(conn, id);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await logAudit(userId, `Deleted product: ${existing.name}`);
  return { message: 'Product deleted.' };
}

module.exports = { listProducts, createProduct, updateProduct, deleteProduct };
