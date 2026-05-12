const { productService } = require('../services');

async function listProducts(req, res, next) {
  try {
    const products = await productService.listProducts();
    return res.json(products);
  } catch (err) {
    return next(err);
  }
}

async function createProduct(req, res, next) {
  try {
    const product = await productService.createProduct(req.body, req.user.id);
    return res.status(201).json(product);
  } catch (err) {
    return next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const product = await productService.updateProduct(Number(req.params.id), req.body, req.user.id);
    return res.json(product);
  } catch (err) {
    return next(err);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const result = await productService.deleteProduct(Number(req.params.id), req.user.id);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = { listProducts, createProduct, updateProduct, deleteProduct };
