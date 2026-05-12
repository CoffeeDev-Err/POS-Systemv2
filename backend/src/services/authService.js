const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/db');
const { ApiError } = require('../utils/errors');
const userRepository = require('../repositories/userRepository');
const { formatDate } = require('../utils/format');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '12h';

function mapUser(row) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    active: Number(row.active) === 1,
    createdAt: formatDate(row.created_at),
  };
}

/**
 * Authenticate user credentials and return a token.
 * @param {{ username: string, password: string, role?: string }} payload
 */
async function login(payload) {
  const { username, password, role } = payload;

  if (!username || !password) {
    throw ApiError.badRequest('Username and password are required.');
  }

  if (!JWT_SECRET) {
    throw ApiError.internal('Server misconfigured: JWT_SECRET missing.');
  }

  const pool = getPool();
  const userRow = await userRepository.findByUsername(pool, username);

  if (!userRow) {
    throw ApiError.unauthorized('Invalid username or password.');
  }

  const passwordOk = await bcrypt.compare(password, userRow.password);
  if (!passwordOk) {
    throw ApiError.unauthorized('Invalid username or password.');
  }

  if (role && role !== userRow.role) {
    throw ApiError.unauthorized('Selected role does not match this account.');
  }

  const user = mapUser(userRow);
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  return { user, token };
}

/**
 * Fetch current user by id.
 * @param {number} userId
 */
async function getMe(userId) {
  const pool = getPool();
  const row = await userRepository.findById(pool, userId);
  if (!row) {
    throw ApiError.notFound('User not found.');
  }
  return { user: mapUser(row) };
}

module.exports = { login, getMe };
