const { transactionService } = require('../services');

async function listTransactions(req, res, next) {
  try {
    const result = await transactionService.listTransactions();
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function getTransaction(req, res, next) {
  try {
    const result = await transactionService.getTransaction(req.params.id);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function createTransaction(req, res, next) {
  try {
    const result = await transactionService.createTransaction(req.body, req.user.id);
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = { listTransactions, getTransaction, createTransaction };
