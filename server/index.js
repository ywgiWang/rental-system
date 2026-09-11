const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { pool, initDB } = require('./db');

const JWT_SECRET = 'rental-system-secret-key-2026';

async function start() {
  await fastify.register(cors, { origin: true, credentials: true });

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

  // Listing routes
  fastify.get('/api/listings', async (request) => {
    const { status, type, minPrice, maxPrice, keyword, lat, lng, radius } = request.query;
    let sql = `SELECT l.*, u.name as landlord_name, ST_X(l.geom::geometry) as longitude, ST_Y(l.geom::geometry) as latitude FROM listings l JOIN users u ON l.landlord_id = u.id WHERE 1=1`;
    const params = [];
    let pidx = 0;
    if (status) { sql += ` AND l.status = $${++pidx}`; params.push(status); }
    if (type) { sql += ` AND l.type = $${++pidx}`; params.push(type); }
    if (minPrice) { sql += ` AND l.price >= $${++pidx}`; params.push(minPrice); }
    if (maxPrice) { sql += ` AND l.price <= $${++pidx}`; params.push(maxPrice); }
    if (keyword) { sql += ` AND (l.title ILIKE $${++pidx} OR l.address ILIKE $${++pidx})`; params.push(`%${keyword}%`, `%${keyword}%`); }
    if (lat && lng && radius) {
      sql += ` AND ST_DWithin(l.geom::geography, ST_SetSRID(ST_MakePoint($${++pidx}, $${++pidx}), 4326)::geography, $${++pidx})`;
      params.push(lng, lat, parseInt(radius));
    }
    sql += ' ORDER BY l.created_at DESC';
    const result = await pool.query(sql, params);
    return result.rows;
  });

  fastify.get('/api/listings/:id', async (request) => {
    const result = await pool.query(
      `SELECT l.*, u.name as landlord_name, ST_X(l.geom::geometry) as longitude, ST_Y(l.geom::geometry) as latitude FROM listings l JOIN users u ON l.landlord_id = u.id WHERE l.id = $1`,
      [request.params.id]
    );
    if (result.rows.length === 0) throw new Error('Listing not found');
    const listing = result.rows[0];
    listing.images = listing.images || [];
    return listing;
  });

  fastify.post('/api/listings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { title, description, address, area, price, rooms, type, images, available_from, latitude, longitude } = request.body;
    const landlord_id = request.user.role === 'agent' ? request.body.landlord_id : request.user.id;
    const imgs = Array.isArray(images) ? JSON.stringify(images) : '[]';
    const lat = latitude ? parseFloat(latitude) : null;
    const lng = longitude ? parseFloat(longitude) : null;
    const result = await pool.query(
      `INSERT INTO listings (title, description, address, area, price, rooms, type, landlord_id, images, available_from, latitude, longitude, geom) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, ${lat && lng ? 'ST_SetSRID(ST_MakePoint($12, $11), 4326)' : 'NULL'}) RETURNING id`,
      [title, description, address, area, price, rooms, type, landlord_id, imgs, available_from || null, lat, lng]
    );
    return { id: result.rows[0].id };
  });

  fastify.put('/api/listings/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { title, description, address, area, price, rooms, type, status, images, available_from, latitude, longitude } = request.body;
    const existing = (await pool.query('SELECT * FROM listings WHERE id = $1', [request.params.id])).rows[0];
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    if (request.user.role !== 'agent' && existing.landlord_id !== request.user.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const imgs = Array.isArray(images) ? JSON.stringify(images) : JSON.stringify(existing.images);
    const lat = latitude !== undefined ? parseFloat(latitude) : existing.latitude;
    const lng = longitude !== undefined ? parseFloat(longitude) : existing.longitude;
    await pool.query(
      `UPDATE listings SET title=$1, description=$2, address=$3, area=$4, price=$5, rooms=$6, type=$7, status=$8, images=$9, available_from=$10, latitude=$11, longitude=$12, geom=${lat && lng ? 'ST_SetSRID(ST_MakePoint($12, $11), 4326)' : 'NULL'}, updated_at=CURRENT_TIMESTAMP WHERE id=$13`,
      [title, description, address, area, price, rooms, type, status, imgs, available_from || null, lat, lng, request.params.id]
    );
    return { success: true };
  });

  fastify.delete('/api/listings/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const existing = (await pool.query('SELECT * FROM listings WHERE id = $1', [request.params.id])).rows[0];
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
    let sql = `SELECT a.*, l.title as listing_title, l.address as listing_address, t.name as tenant_name FROM applications a JOIN listings l ON a.listing_id = l.id JOIN users t ON a.tenant_id = t.id WHERE 1=1`;
    const params = [];
    if (user.role === 'tenant') { sql += ' AND a.tenant_id = $1'; params.push(user.id); }
    else if (user.role === 'landlord') { sql += ' AND a.landlord_id = $1'; params.push(user.id); }
    sql += ' ORDER BY a.created_at DESC';
    return (await pool.query(sql, params)).rows;
  });

  fastify.post('/api/applications', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { listing_id, message } = request.body;
    const listing = (await pool.query('SELECT * FROM listings WHERE id = $1', [listing_id])).rows[0];
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
    let sql = `SELECT a.*, l.title as listing_title, l.address as listing_address, t.name as tenant_name FROM appointments a JOIN listings l ON a.listing_id = l.id JOIN users t ON a.tenant_id = t.id WHERE 1=1`;
    const params = [];
    if (user.role === 'tenant') { sql += ' AND a.tenant_id = $1'; params.push(user.id); }
    else if (user.role === 'landlord') { sql += ' AND a.landlord_id = $1'; params.push(user.id); }
    sql += ' ORDER BY a.appointment_date DESC';
    return (await pool.query(sql, params)).rows;
  });

  fastify.post('/api/appointments', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { listing_id, appointment_date } = request.body;
    const listing = (await pool.query('SELECT * FROM listings WHERE id = $1', [listing_id])).rows[0];
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
    let sql = `SELECT le.*, l.title as listing_title, l.address as listing_address, t.name as tenant_name FROM leases le JOIN listings l ON le.listing_id = l.id JOIN users t ON le.tenant_id = t.id WHERE 1=1`;
    const params = [];
    if (user.role === 'tenant') { sql += ' AND le.tenant_id = $1'; params.push(user.id); }
    else if (user.role === 'landlord') { sql += ' AND le.landlord_id = $1'; params.push(user.id); }
    sql += ' ORDER BY le.created_at DESC';
    return (await pool.query(sql, params)).rows;
  });

  fastify.post('/api/leases', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { listing_id, tenant_id, start_date, end_date } = request.body;
    const listing = (await pool.query('SELECT * FROM listings WHERE id = $1', [listing_id])).rows[0];
    if (!listing) return reply.code(404).send({ error: 'Listing not found' });
    if (request.user.role !== 'landlord' && request.user.role !== 'agent') return reply.code(403).send({ error: 'Forbidden' });
    const result = await pool.query(
      'INSERT INTO leases (listing_id, tenant_id, landlord_id, start_date, end_date) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [listing_id, tenant_id, listing.landlord_id, start_date, end_date]
    );
    await pool.query("UPDATE listings SET status = 'rented' WHERE id = $1", [listing_id]);
    await pool.query('INSERT INTO messages (sender_id, receiver_id, content, type) VALUES ($1, $2, $3, $4)',
      [listing.landlord_id, tenant_id, `您的租约已创建：${listing.title}，租期 ${start_date} 至 ${end_date}`, 'system']);
    return { id: result.rows[0].id };
  });

  fastify.put('/api/leases/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { status } = request.body;
    const lease = (await pool.query('SELECT * FROM leases WHERE id = $1', [request.params.id])).rows[0];
    if (!lease) return reply.code(404).send({ error: 'Not found' });
    if (request.user.role === 'landlord' && lease.landlord_id !== request.user.id) return reply.code(403).send({ error: 'Forbidden' });
    await pool.query('UPDATE leases SET status = $1 WHERE id = $2', [status, request.params.id]);
    if (status === 'terminated' || status === 'expired') {
      await pool.query("UPDATE listings SET status = 'available' WHERE id = $1", [lease.listing_id]);
    }
    return { success: true };
  });

  // Dashboard stats
  fastify.get('/api/dashboard', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user;
    const stats = {};
    if (user.role === 'landlord' || user.role === 'agent') {
      stats.myListings = parseInt((await pool.query('SELECT COUNT(*) as count FROM listings WHERE landlord_id = $1', [user.id])).rows[0].count);
      stats.pendingApplications = parseInt((await pool.query("SELECT COUNT(*) as count FROM applications WHERE landlord_id = $1 AND status = 'pending'", [user.id])).rows[0].count);
      stats.pendingAppointments = parseInt((await pool.query("SELECT COUNT(*) as count FROM appointments WHERE landlord_id = $1 AND status = 'pending'", [user.id])).rows[0].count);
      stats.activeLeases = parseInt((await pool.query("SELECT COUNT(*) as count FROM leases WHERE landlord_id = $1 AND status = 'active'", [user.id])).rows[0].count);
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
      `SELECT l.*, u.name as landlord_name, ST_X(l.geom::geometry) as longitude, ST_Y(l.geom::geometry) as latitude,
        ST_Distance(l.geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as distance
       FROM listings l JOIN users u ON l.landlord_id = u.id
       WHERE l.status = 'available' AND ST_DWithin(l.geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
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
