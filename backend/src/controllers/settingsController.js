const { getPool } = require('../config/db');

const DEFAULT_SETTINGS = {
  storeName: "CARREN'S STORE",
  address: 'Urdaneta, Ilocos',
  phone: '09XX-XXX-XXXX',
  receiptFooter: 'Salamat sa inyong pagbili! Please come again :)',
};

function mapSettings(row) {
  return {
    storeName: row.store_name,
    address: row.address,
    phone: row.phone,
    receiptFooter: row.receipt_footer,
  };
}

async function getSettings(req, res, next) {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM store_settings WHERE id = 1');

    if (!rows.length) {
      await pool.query(
        `INSERT INTO store_settings (id, store_name, address, phone, receipt_footer)
         VALUES (1, ?, ?, ?, ?)`,
        [
          DEFAULT_SETTINGS.storeName,
          DEFAULT_SETTINGS.address,
          DEFAULT_SETTINGS.phone,
          DEFAULT_SETTINGS.receiptFooter,
        ]
      );
      return res.json(DEFAULT_SETTINGS);
    }

    return res.json(mapSettings(rows[0]));
  } catch (err) {
    return next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const { storeName, address, phone, receiptFooter } = req.body;
    if (!storeName || !address || !phone || !receiptFooter) {
      return res.status(400).json({ message: 'All settings fields are required.' });
    }

    const pool = getPool();
    await pool.query(
      `INSERT INTO store_settings (id, store_name, address, phone, receipt_footer)
       VALUES (1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         store_name = VALUES(store_name),
         address = VALUES(address),
         phone = VALUES(phone),
         receipt_footer = VALUES(receipt_footer)`,
      [storeName, address, phone, receiptFooter]
    );

    return res.json({ storeName, address, phone, receiptFooter });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getSettings, updateSettings };
