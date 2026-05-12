const { categoryService } = require('../services');

async function listCategories(req, res, next) {
  try {
    const categories = await categoryService.listCategories();
    return res.json(categories);
  } catch (err) {
    return next(err);
  }
}

async function createCategory(req, res, next) {
  try {
    const result = await categoryService.createCategory(req.body.name, req.user.id);
    const status = result.created ? 201 : 200;
    return res.status(status).json({ name: result.name });
  } catch (err) {
    return next(err);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const result = await categoryService.deleteCategory(req.params.id, {
      deleteProducts: String(req.query.deleteProducts || '').toLowerCase() === 'true',
      userId: req.user.id,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = { listCategories, createCategory, deleteCategory };
