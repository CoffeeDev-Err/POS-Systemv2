const { getPool } = require('../config/db');
const { ApiError } = require('../utils/errors');
const { logAudit } = require('../utils/audit');
const categoryRepository = require('../repositories/categoryRepository');
const productRepository = require('../repositories/productRepository');
const stockMovementRepository = require('../repositories/stockMovementRepository');

async function listCategories() {
  const pool = getPool();
  const rows = await categoryRepository.listCategories(pool);
  return rows.map(r => r.name);
}

async function createCategory(name, userId) {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    throw ApiError.badRequest('Category name is required.');
  }

  const pool = getPool();
  const existing = await categoryRepository.findByName(pool, trimmed);
  if (existing) {
    return { name: trimmed, created: false };
  }

  await categoryRepository.createCategory(pool, trimmed);
  await logAudit(userId, `Added category: ${trimmed}`);
  return { name: trimmed, created: true };
}

/**
 * Delete a category, optionally cascading product deletion.
 * @param {string|number} idOrName
 * @param {{ deleteProducts?: boolean, userId: number }} options
 */
async function deleteCategory(idOrName, options) {
  const pool = getPool();
  const deleteProducts = Boolean(options.deleteProducts);

  let categoryRow = null;
  if (/^\d+$/.test(String(idOrName))) {
    categoryRow = await categoryRepository.findById(pool, Number(idOrName));
  } else {
    categoryRow = await categoryRepository.findByName(pool, String(idOrName));
  }

  if (!categoryRow) {
    throw ApiError.notFound('Category not found.');
  }

  const productCount = await categoryRepository.countProductsByCategory(pool, categoryRow.id);
  if (productCount > 0 && !deleteProducts) {
    throw ApiError.conflict('Cannot delete a category with products.');
  }

  if (productCount > 0 && deleteProducts) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const productRows = await productRepository.findByCategoryId(conn, categoryRow.id);
      const productIds = productRows.map(r => r.id);

      await stockMovementRepository.deleteByProductIds(conn, productIds);
      await productRepository.deleteProductsByIds(conn, productIds);
      await categoryRepository.deleteCategoryById(conn, categoryRow.id);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    await logAudit(options.userId, `Deleted category: ${categoryRow.name} (removed ${productCount} product${productCount === 1 ? '' : 's'})`);
    return { message: 'Category and products deleted.' };
  }

  await categoryRepository.deleteCategoryById(pool, categoryRow.id);
  await logAudit(options.userId, `Deleted category: ${categoryRow.name}`);
  return { message: 'Category deleted.' };
}

module.exports = { listCategories, createCategory, deleteCategory };
