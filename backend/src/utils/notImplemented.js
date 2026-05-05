function notImplemented(req, res) {
  res.status(501).json({ message: 'Not implemented yet.' });
}

module.exports = { notImplemented };
