const { authService } = require('../services');

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function me(req, res, next) {
  try {
    const result = await authService.getMe(req.user.id);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

function logout(req, res) {
  res.json({ message: 'Logged out.' });
}

module.exports = { login, me, logout };
