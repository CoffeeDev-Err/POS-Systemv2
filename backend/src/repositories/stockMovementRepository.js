async function deleteByProductIds(db, productIds) {
  if (!productIds.length) return;
  await db.query('DELETE FROM stock_movements WHERE product_id IN (?)', [productIds]);
}

module.exports = { deleteByProductIds };
