const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream/promises');
const { pool, initDB } = require('./db');

const JWT_SECRET = 'rental-system-secret-key-2026';

async function start() {
  await fastify.register(cors, { origin: true, credentials: true });
  await fastify.register(require('@fastify/multipart'), { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
  const uploadDir = path.join(__dirname, 'uploads');
  fs.mkdirSync(uploadDir, { recursive: true });
  await fastify.register(require('@fastify/static'), { root: uploadDir, prefix: '/uploads/' });

  fastify.decorate('authenticate', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) throw new Error('No token');
      request.user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Auth routes
  fastify.post('/api/auth/register', async (request, reply) => {
    const { username, password, role, name, phone, email } = request.body;
    const hashed = bcrypt.hashSync(password, 10);
    try {
      const result = await pool.query(
        'INSERT INTO users (username, password, role, name, phone, email) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [username, hashed, role, name, phone, email]
      );
      const user = (await pool.query('SELECT id, username, role, name, phone, email FROM users WHERE id = $1', [result.rows[0].id])).rows[0];
      const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
      return { token, user };
    } catch (err) {
      return reply.code(400).send({ error: 'Username already exists' });
    }
  });

  fastify.post('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body;
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...userWithoutPassword } = user;
    return { token, user: userWithoutPassword };
  });

  fastify.get('/api/auth/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const result = await pool.query('SELECT id, username, role, name, phone, email, created_at FROM users WHERE id = $1', [request.user.id]);
    return result.rows[0];
  });

  // File upload (images only)
  fastify.post('/api/upload', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const data = await request.file();
    const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
    if (!extMap[data.mimetype]) {
      return reply.code(400).send({ error: '仅支持 jpg/png/webp/gif 图片' });
    }
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extMap[data.mimetype]}`;
    await pipeline(data.file, fs.createWriteStream(path.join(uploadDir, filename)));
    return { url: `/uploads/${filename}` };
  });

  // Property routes (房屋信息维护)
  fastify.get('/api/properties', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user;
    let sql = `SELECT p.*, u.name as landlord_name FROM properties p JOIN users u ON p.landlord_id = u.id WHERE 1=1`;
    const params = [];
    if (user.role === 'landlord') { sql += ' AND p.landlord_id = $1'; params.push(user.id); }
    sql += ' ORDER BY p.created_at DESC';
    return (await pool.query(sql, params)).rows;
  });

  fastify.post('/api/properties', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { address, area, rooms, type, description, images, latitude, longitude } = request.body;
    const landlord_id = request.user.role === 'agent' ? request.body.landlord_id : request.user.id;
    const imgs = Array.isArray(images) ? JSON.stringify(images) : '[]';
    const lat = latitude ? parseFloat(latitude) : null;
    const lng = longitude ? parseFloat(longitude) : null;
    const result = await pool.query(
      `INSERT INTO properties (landlord_id, address, area, rooms, type, description, images, latitude, longitude, geom) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ${lat && lng ? 'ST_SetSRID(ST_MakePoint($9, $8), 4326)' : 'NULL'}) RETURNING id`,
      [landlord_id, address, area, rooms, type, description, imgs, lat, lng]
    );
    return { id: result.rows[0].id };
  });

  fastify.put('/api/properties/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { address, area, rooms, type, description, images, latitude, longitude } = request.body;
    const existing = (await pool.query('SELECT * FROM properties WHERE id = $1', [request.params.id])).rows[0];
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    if (request.user.role !== 'agent' && existing.landlord_id !== request.user.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const imgs = Array.isArray(images) ? JSON.stringify(images) : JSON.stringify(existing.images);
    const lat = latitude !== undefined ? parseFloat(latitude) : existing.latitude;
    const lng = longitude !== undefined ? parseFloat(longitude) : existing.longitude;
    await pool.query(
      `UPDATE properties SET address=$1, area=$2, rooms=$3, type=$4, description=$5, images=$6, latitude=$7, longitude=$8, geom=${lat && lng ? 'ST_SetSRID(ST_MakePoint($8, $7), 4326)' : 'NULL'}, updated_at=CURRENT_TIMESTAMP WHERE id=$9`,
      [address, area, rooms, type, description, imgs, lat, lng, request.params.id]
    );
    return { success: true };
  });

  fastify.delete('/api/properties/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const existing = (await pool.query('SELECT * FROM properties WHERE id = $1', [request.params.id])).rows[0];
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    if (request.user.role !== 'agent' && existing.landlord_id !== request.user.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    await pool.query('DELETE FROM properties WHERE id = $1', [request.params.id]);
    return { success: true };
  });

  // Listing routes (发布信息)
  fastify.get('/api/listings', async (request) => {
    const { status, type, minPrice, maxPrice, keyword, landlord_id, lat, lng, radius } = request.query;
    let sql = `SELECT l.*, p.address, p.area, p.rooms, p.type, p.description, p.images, p.landlord_id,
      ST_X(p.geom::geometry) as longitude, ST_Y(p.geom::geometry) as latitude, u.name as landlord_name
      FROM listings l JOIN properties p ON l.property_id = p.id JOIN users u ON p.landlord_id = u.id WHERE 1=1`;
    const params = [];
    let pidx = 0;
    if (status) { sql += ` AND l.status = $${++pidx}`; params.push(status); }
    if (type) { sql += ` AND p.type = $${++pidx}`; params.push(type); }
    if (minPrice) { sql += ` AND l.price >= $${++pidx}`; params.push(minPrice); }
    if (maxPrice) { sql += ` AND l.price <= $${++pidx}`; params.push(maxPrice); }
    if (keyword) { sql += ` AND (l.title ILIKE $${++pidx} OR p.address ILIKE $${++pidx})`; params.push(`%${keyword}%`, `%${keyword}%`); }
    if (landlord_id) { sql += ` AND p.landlord_id = $${++pidx}`; params.push(landlord_id); }
    if (lat && lng && radius) {
      sql += ` AND ST_DWithin(p.geom::geography, ST_SetSRID(ST_MakePoint($${++pidx}, $${++pidx}), 4326)::geography, $${++pidx})`;
      params.push(lng, lat, parseInt(radius));
    }
    sql += ' ORDER BY l.created_at DESC';
    const result = await pool.query(sql, params);
    return result.rows;
  });

  fastify.get('/api/listings/:id', async (request) => {
    const result = await pool.query(
      `SELECT l.*, p.address, p.area, p.rooms, p.type, p.description, p.images, p.landlord_id,
        ST_X(p.geom::geometry) as longitude, ST_Y(p.geom::geometry) as latitude, u.name as landlord_name
        FROM listings l JOIN properties p ON l.property_id = p.id JOIN users u ON p.landlord_id = u.id WHERE l.id = $1`,
      [request.params.id]
    );
    if (result.rows.length === 0) throw new Error('Listing not found');
    const listing = result.rows[0];
    listing.images = listing.images || [];
    return listing;
  });

  fastify.post('/api/listings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { property_id, title, price, available_from } = request.body;
    const property = (await pool.query('SELECT * FROM properties WHERE id = $1', [property_id])).rows[0];
    if (!property) return reply.code(404).send({ error: 'Property not found' });
    if (request.user.role !== 'agent' && property.landlord_id !== request.user.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const result = await pool.query(
      'INSERT INTO listings (property_id, title, price, available_from) VALUES ($1, $2, $3, $4) RETURNING id',
      [property_id, title, price, available_from || null]
    );
    return { id: result.rows[0].id };
  });

  fastify.put('/api/listings/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { title, price, status, available_from } = request.body;
    const existing = (await pool.query(
      'SELECT l.*, p.landlord_id FROM listings l JOIN properties p ON l.property_id = p.id WHERE l.id = $1',
      [request.params.id]
    )).rows[0];
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    if (request.user.role !== 'agent' && existing.landlord_id !== request.user.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    await pool.query(
      'UPDATE listings SET title=$1, price=$2, status=$3, available_from=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$5',
      [title, price, status, available_from || null, request.params.id]
    );
    return { success: true };
  });

  fastify.delete('/api/listings/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const existing = (await pool.query(
      'SELECT l.*, p.landlord_id FROM listings l JOIN properties p ON l.property_id = p.id WHERE l.id = $1',
      [request.params.id]
    )).rows[0];
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    if (request.user.role !== 'agent' && existing.landlord_id !== request.user.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    await pool.query('DELETE FROM listings WHERE id = $1', [request.params.id]);
    return { success: true };
  });

  // Application routes
  fastify.get('/api/applications', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user;
    let sql = `SELECT a.*, l.title as listing_title, p.id as property_id, p.address as listing_address, t.name as tenant_name FROM applications a JOIN listings l ON a.listing_id = l.id JOIN properties p ON l.property_id = p.id JOIN users t ON a.tenant_id = t.id WHERE 1=1`;
    const params = [];
    if (user.role === 'tenant') { sql += ' AND a.tenant_id = $1'; params.push(user.id); }
    else if (user.role === 'landlord') { sql += ' AND a.landlord_id = $1'; params.push(user.id); }
    sql += ' ORDER BY a.created_at DESC';
    return (await pool.query(sql, params)).rows;
  });

  fastify.post('/api/applications', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { listing_id, message } = request.body;
    const listing = (await pool.query('SELECT l.id, l.title, p.landlord_id FROM listings l JOIN properties p ON l.property_id = p.id WHERE l.id = $1', [listing_id])).rows[0];
    if (!listing) return reply.code(404).send({ error: 'Listing not found' });
    if (request.user.role !== 'tenant') return reply.code(403).send({ error: 'Only tenants can apply' });
    const result = await pool.query(
      'INSERT INTO applications (listing_id, tenant_id, landlord_id, message) VALUES ($1, $2, $3, $4) RETURNING id',
      [listing_id, request.user.id, listing.landlord_id, message]
    );
    await pool.query('INSERT INTO messages (sender_id, receiver_id, content, type) VALUES ($1, $2, $3, $4)',
      [request.user.id, listing.landlord_id, `新租房申请：${listing.title}`, 'application']);
    return { id: result.rows[0].id };
  });

  fastify.put('/api/applications/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { status } = request.body;
    const app = (await pool.query('SELECT * FROM applications WHERE id = $1', [request.params.id])).rows[0];
    if (!app) return reply.code(404).send({ error: 'Not found' });
    if (request.user.role === 'tenant' && app.tenant_id !== request.user.id) return reply.code(403).send({ error: 'Forbidden' });
    if (request.user.role === 'landlord' && app.landlord_id !== request.user.id) return reply.code(403).send({ error: 'Forbidden' });
    await pool.query('UPDATE applications SET status = $1 WHERE id = $2', [status, request.params.id]);
    const listing = (await pool.query('SELECT title FROM listings WHERE id = $1', [app.listing_id])).rows[0];
    await pool.query('INSERT INTO messages (sender_id, receiver_id, content, type) VALUES ($1, $2, $3, $4)',
      [app.landlord_id, app.tenant_id, `您的租房申请「${listing.title}」已被${status === 'approved' ? '通过' : '拒绝'}`, 'system']);
    return { success: true };
  });

  // Appointment routes
  fastify.get('/api/appointments', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user;
    let sql = `SELECT a.*, l.title as listing_title, p.address as listing_address, t.name as tenant_name FROM appointments a JOIN listings l ON a.listing_id = l.id JOIN properties p ON l.property_id = p.id JOIN users t ON a.tenant_id = t.id WHERE 1=1`;
    const params = [];
    if (user.role === 'tenant') { sql += ' AND a.tenant_id = $1'; params.push(user.id); }
    else if (user.role === 'landlord') { sql += ' AND a.landlord_id = $1'; params.push(user.id); }
    sql += ' ORDER BY a.appointment_date DESC';
    return (await pool.query(sql, params)).rows;
  });

  fastify.post('/api/appointments', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { listing_id, appointment_date } = request.body;
    const listing = (await pool.query('SELECT l.id, l.title, p.landlord_id FROM listings l JOIN properties p ON l.property_id = p.id WHERE l.id = $1', [listing_id])).rows[0];
    if (!listing) return reply.code(404).send({ error: 'Listing not found' });
    if (request.user.role !== 'tenant') return reply.code(403).send({ error: 'Only tenants can book' });
    const result = await pool.query(
      'INSERT INTO appointments (listing_id, tenant_id, landlord_id, appointment_date) VALUES ($1, $2, $3, $4) RETURNING id',
      [listing_id, request.user.id, listing.landlord_id, appointment_date]
    );
    await pool.query('INSERT INTO messages (sender_id, receiver_id, content, type) VALUES ($1, $2, $3, $4)',
      [request.user.id, listing.landlord_id, `新看房预约：${listing.title}，时间：${appointment_date}`, 'appointment']);
    return { id: result.rows[0].id };
  });

  fastify.put('/api/appointments/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { status } = request.body;
    const app = (await pool.query('SELECT * FROM appointments WHERE id = $1', [request.params.id])).rows[0];
    if (!app) return reply.code(404).send({ error: 'Not found' });
    if (request.user.role === 'landlord' && app.landlord_id !== request.user.id) return reply.code(403).send({ error: 'Forbidden' });
    await pool.query('UPDATE appointments SET status = $1 WHERE id = $2', [status, request.params.id]);
    const listing = (await pool.query('SELECT title FROM listings WHERE id = $1', [app.listing_id])).rows[0];
    await pool.query('INSERT INTO messages (sender_id, receiver_id, content, type) VALUES ($1, $2, $3, $4)',
      [app.landlord_id, app.tenant_id, `您的看房预约「${listing.title}」已被${status === 'confirmed' ? '确认' : status === 'cancelled' ? '取消' : '完成'}`, 'system']);
    return { success: true };
  });

  // Message routes
  fastify.get('/api/messages', { preHandler: [fastify.authenticate] }, async (request) => {
    const rows = (await pool.query(
      'SELECT m.*, u.name as sender_name FROM messages m LEFT JOIN users u ON m.sender_id = u.id WHERE m.receiver_id = $1 ORDER BY m.created_at DESC',
      [request.user.id]
    )).rows;
    return rows;
  });

  fastify.get('/api/messages/unread-count', { preHandler: [fastify.authenticate] }, async (request) => {
    const result = await pool.query('SELECT COUNT(*) as count FROM messages WHERE receiver_id = $1 AND is_read = FALSE', [request.user.id]);
    return result.rows[0];
  });

  fastify.put('/api/messages/:id/read', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    await pool.query('UPDATE messages SET is_read = TRUE WHERE id = $1 AND receiver_id = $2', [request.params.id, request.user.id]);
    return { success: true };
  });

  fastify.put('/api/messages/read-all', { preHandler: [fastify.authenticate] }, async (request) => {
    await pool.query('UPDATE messages SET is_read = TRUE WHERE receiver_id = $1', [request.user.id]);
    return { success: true };
  });

  // Lease routes
  fastify.get('/api/leases', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user;
    let sql = `SELECT le.*, p.address, p.images, p.landlord_id, COALESCE(l.title, p.address) as listing_title, t.name as tenant_name,
      COALESCE(b.unpaid_total, 0) as unpaid_total, COALESCE(b.paid_total, 0) as paid_total
      FROM leases le
      JOIN properties p ON le.property_id = p.id
      LEFT JOIN listings l ON le.listing_id = l.id
      JOIN users t ON le.tenant_id = t.id
      LEFT JOIN (SELECT lease_id,
        SUM(amount) FILTER (WHERE status = 'unpaid') as unpaid_total,
        SUM(amount) FILTER (WHERE status = 'paid') as paid_total
        FROM bills GROUP BY lease_id) b ON b.lease_id = le.id
      WHERE 1=1`;
    const params = [];
    if (user.role === 'tenant') { sql += ' AND le.tenant_id = $1'; params.push(user.id); }
    else if (user.role === 'landlord') { sql += ' AND p.landlord_id = $1'; params.push(user.id); }
    sql += ' ORDER BY le.created_at DESC';
    return (await pool.query(sql, params)).rows;
  });

  fastify.post('/api/leases', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { property_id, listing_id, tenant_id, rent, deposit, start_date, end_date, contract_files, mark_listing_rented } = request.body;
    const property = (await pool.query('SELECT * FROM properties WHERE id = $1', [property_id])).rows[0];
    if (!property) return reply.code(404).send({ error: 'Property not found' });
    if (request.user.role !== 'landlord' && request.user.role !== 'agent') return reply.code(403).send({ error: 'Forbidden' });
    if (request.user.role === 'landlord' && property.landlord_id !== request.user.id) return reply.code(403).send({ error: 'Forbidden' });
    const cfiles = Array.isArray(contract_files) ? JSON.stringify(contract_files) : '[]';
    const result = await pool.query(
      'INSERT INTO leases (property_id, listing_id, tenant_id, rent, deposit, start_date, end_date, contract_files) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [property_id, listing_id || null, tenant_id, rent, deposit || null, start_date, end_date, cfiles]
    );
    if (listing_id && mark_listing_rented !== false) {
      await pool.query("UPDATE listings SET status = 'rented' WHERE id = $1", [listing_id]);
    }
    await pool.query('INSERT INTO messages (sender_id, receiver_id, content, type) VALUES ($1, $2, $3, $4)',
      [property.landlord_id, tenant_id, `您的租约已创建：${property.address}，租期 ${start_date} 至 ${end_date}`, 'system']);
    return { id: result.rows[0].id };
  });

  fastify.put('/api/leases/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { status } = request.body;
    const lease = (await pool.query('SELECT le.*, p.landlord_id FROM leases le JOIN properties p ON le.property_id = p.id WHERE le.id = $1', [request.params.id])).rows[0];
    if (!lease) return reply.code(404).send({ error: 'Not found' });
    if (request.user.role === 'landlord' && lease.landlord_id !== request.user.id) return reply.code(403).send({ error: 'Forbidden' });
    await pool.query('UPDATE leases SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, request.params.id]);
    if ((status === 'terminated' || status === 'expired') && lease.listing_id) {
      await pool.query("UPDATE listings SET status = 'available' WHERE id = $1", [lease.listing_id]);
    }
    return { success: true };
  });

  // Bill routes
  fastify.get('/api/leases/:id/bills', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const lease = (await pool.query('SELECT le.*, p.landlord_id FROM leases le JOIN properties p ON le.property_id = p.id WHERE le.id = $1', [request.params.id])).rows[0];
    if (!lease) return reply.code(404).send({ error: 'Lease not found' });
    const isManager = request.user.role === 'agent' || (request.user.role === 'landlord' && lease.landlord_id === request.user.id);
    const isTenant = lease.tenant_id === request.user.id;
    if (!isManager && !isTenant) return reply.code(403).send({ error: 'Forbidden' });
    const { period } = request.query;
    let sql = 'SELECT * FROM bills WHERE lease_id = $1';
    const params = [request.params.id];
    if (period) { sql += ' AND period = $2'; params.push(period); }
    sql += ' ORDER BY period DESC, id ASC';
    return (await pool.query(sql, params)).rows;
  });

  fastify.post('/api/leases/:id/bills', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const lease = (await pool.query('SELECT le.*, p.landlord_id FROM leases le JOIN properties p ON le.property_id = p.id WHERE le.id = $1', [request.params.id])).rows[0];
    if (!lease) return reply.code(404).send({ error: 'Lease not found' });
    const isManager = request.user.role === 'agent' || (request.user.role === 'landlord' && lease.landlord_id === request.user.id);
    if (!isManager) return reply.code(403).send({ error: 'Forbidden' });
    const { period, type, amount, note } = request.body;
    const result = await pool.query(
      'INSERT INTO bills (lease_id, period, type, amount, note) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [request.params.id, period, type, amount ?? null, note || null]
    );
    return result.rows[0];
  });

  fastify.put('/api/bills/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const bill = (await pool.query('SELECT b.*, p.landlord_id FROM bills b JOIN leases le ON b.lease_id = le.id JOIN properties p ON le.property_id = p.id WHERE b.id = $1', [request.params.id])).rows[0];
    if (!bill) return reply.code(404).send({ error: 'Not found' });
    const isManager = request.user.role === 'agent' || (request.user.role === 'landlord' && bill.landlord_id === request.user.id);
    if (!isManager) return reply.code(403).send({ error: 'Forbidden' });
    const { amount, note, status } = request.body;
    if (bill.status === 'paid' && status !== 'unpaid') {
      return reply.code(400).send({ error: '已缴账单请先标记为未缴再修改' });
    }
    const updates = [];
    const params = [];
    let i = 0;
    if (amount !== undefined) { updates.push(`amount = $${++i}`); params.push(amount); }
    if (note !== undefined) { updates.push(`note = $${++i}`); params.push(note || null); }
    if (status !== undefined) {
      updates.push(`status = $${++i}`); params.push(status);
      updates.push(status === 'paid' ? 'paid_at = CURRENT_TIMESTAMP' : 'paid_at = NULL');
    }
    if (updates.length === 0) return { success: true };
    await pool.query(`UPDATE bills SET ${updates.join(', ')} WHERE id = $${++i}`, [...params, request.params.id]);
    return { success: true };
  });

  fastify.delete('/api/bills/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const bill = (await pool.query('SELECT b.*, p.landlord_id FROM bills b JOIN leases le ON b.lease_id = le.id JOIN properties p ON le.property_id = p.id WHERE b.id = $1', [request.params.id])).rows[0];
    if (!bill) return reply.code(404).send({ error: 'Not found' });
    const isManager = request.user.role === 'agent' || (request.user.role === 'landlord' && bill.landlord_id === request.user.id);
    if (!isManager) return reply.code(403).send({ error: 'Forbidden' });
    if (bill.status === 'paid') return reply.code(400).send({ error: '已缴账单不能删除' });
    await pool.query('DELETE FROM bills WHERE id = $1', [request.params.id]);
    return { success: true };
  });

  fastify.post('/api/bills/generate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (request.user.role !== 'landlord' && request.user.role !== 'agent') return reply.code(403).send({ error: 'Forbidden' });
    const { period } = request.body;
    if (!period || !/^\d{4}-\d{2}$/.test(period)) return reply.code(400).send({ error: 'Invalid period' });
    const [y, m] = period.split('-').map(Number);
    const monthStart = `${period}-01`;
    const monthEnd = `${period}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    const params = [monthStart, monthEnd];
    let landlordFilter = '';
    if (request.user.role === 'landlord') { landlordFilter = ' AND p.landlord_id = $3'; params.push(request.user.id); }
    const leases = (await pool.query(`
      SELECT le.id FROM leases le
      JOIN properties p ON le.property_id = p.id
      WHERE le.status = 'active'
        AND le.start_date <= $2::date
        AND le.end_date >= $1::date
        ${landlordFilter}
    `, params)).rows;
    let inserted = 0;
    for (const le of leases) {
      for (const type of ['water', 'electric']) {
        const exists = await pool.query('SELECT 1 FROM bills WHERE lease_id = $1 AND period = $2 AND type = $3', [le.id, period, type]);
        if (exists.rowCount === 0) {
          await pool.query('INSERT INTO bills (lease_id, period, type) VALUES ($1, $2, $3)', [le.id, period, type]);
          inserted++;
        }
      }
    }
    return { leases: leases.length, inserted };
  });

  // Dashboard stats
  fastify.get('/api/dashboard', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user;
    const stats = {};
    if (user.role === 'landlord' || user.role === 'agent') {
      stats.myListings = parseInt((await pool.query('SELECT COUNT(*) as count FROM listings l JOIN properties p ON l.property_id = p.id WHERE p.landlord_id = $1', [user.id])).rows[0].count);
      stats.pendingApplications = parseInt((await pool.query("SELECT COUNT(*) as count FROM applications WHERE landlord_id = $1 AND status = 'pending'", [user.id])).rows[0].count);
      stats.pendingAppointments = parseInt((await pool.query("SELECT COUNT(*) as count FROM appointments WHERE landlord_id = $1 AND status = 'pending'", [user.id])).rows[0].count);
      stats.activeLeases = parseInt((await pool.query("SELECT COUNT(*) as count FROM leases le JOIN properties p ON le.property_id = p.id WHERE p.landlord_id = $1 AND le.status = 'active'", [user.id])).rows[0].count);
    }
    if (user.role === 'tenant') {
      stats.myApplications = parseInt((await pool.query('SELECT COUNT(*) as count FROM applications WHERE tenant_id = $1', [user.id])).rows[0].count);
      stats.myAppointments = parseInt((await pool.query('SELECT COUNT(*) as count FROM appointments WHERE tenant_id = $1', [user.id])).rows[0].count);
      stats.myLeases = parseInt((await pool.query("SELECT COUNT(*) as count FROM leases WHERE tenant_id = $1 AND status = 'active'", [user.id])).rows[0].count);
    }
    stats.unreadMessages = parseInt((await pool.query('SELECT COUNT(*) as count FROM messages WHERE receiver_id = $1 AND is_read = FALSE', [user.id])).rows[0].count);
    return stats;
  });

  // Users list
  fastify.get('/api/users', { preHandler: [fastify.authenticate] }, async (request) => {
    const { role } = request.query;
    let sql = 'SELECT id, username, name, role, phone, email FROM users WHERE 1=1';
    const params = [];
    if (role) { sql += ' AND role = $1'; params.push(role); }
    return (await pool.query(sql, params)).rows;
  });

  // Nearby listings (geo search)
  fastify.get('/api/listings/nearby', async (request) => {
    const { lat, lng, radius = 5000, limit = 20 } = request.query;
    if (!lat || !lng) return reply.code(400).send({ error: 'lat and lng required' });
    const result = await pool.query(
      `SELECT l.*, p.address, p.area, p.rooms, p.type, p.description, p.images, p.landlord_id,
        ST_X(p.geom::geometry) as longitude, ST_Y(p.geom::geometry) as latitude, u.name as landlord_name,
        ST_Distance(p.geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as distance
       FROM listings l JOIN properties p ON l.property_id = p.id JOIN users u ON p.landlord_id = u.id
       WHERE l.status = 'available' AND ST_DWithin(p.geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
       ORDER BY distance
       LIMIT $4`,
      [lat, lng, parseInt(radius), parseInt(limit)]
    );
    return result.rows;
  });

  await initDB();

  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    fastify.log.info(`Server running at http://localhost:3001`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
