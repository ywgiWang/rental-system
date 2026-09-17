require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'rental',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK(role IN ('landlord','tenant','agent')),
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY,
        landlord_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        address VARCHAR(300) NOT NULL,
        area REAL,
        rooms INTEGER,
        type VARCHAR(20) CHECK(type IN ('apartment','house','villa','studio')),
        description TEXT,
        images JSONB DEFAULT '[]',
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        geom GEOMETRY(Point, 4326),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS listings (
        id SERIAL PRIMARY KEY,
        property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        price REAL NOT NULL,
        available_from DATE,
        status VARCHAR(20) DEFAULT 'available' CHECK(status IN ('available','rented','offline')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS applications (
        id SERIAL PRIMARY KEY,
        listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        tenant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        landlord_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT,
        status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        tenant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        landlord_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        appointment_date TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled','completed')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        type VARCHAR(20) DEFAULT 'system',
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS leases (
        id SERIAL PRIMARY KEY,
        property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
        tenant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rent REAL NOT NULL,
        deposit REAL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        contract_files JSONB DEFAULT '[]',
        status VARCHAR(20) DEFAULT 'active' CHECK(status IN ('active','expired','terminated')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bills (
        id SERIAL PRIMARY KEY,
        lease_id INTEGER NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
        period VARCHAR(7) NOT NULL,
        type VARCHAR(20) NOT NULL CHECK(type IN ('water','electric','gas','property','internet','other')),
        amount REAL,
        status VARCHAR(20) DEFAULT 'unpaid' CHECK(status IN ('unpaid','paid')),
        paid_at TIMESTAMP,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_properties_geom ON properties USING GIST(geom);
      CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
      CREATE INDEX IF NOT EXISTS idx_listings_property ON listings(property_id);
    `);

    // Enable PostGIS if not already
    await client.query(`CREATE EXTENSION IF NOT EXISTS postgis;`);

    const { rows } = await client.query('SELECT COUNT(*) as count FROM users');
    if (parseInt(rows[0].count) === 0) {
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync('123456', 10);
      await client.query(`
        INSERT INTO users (username, password, role, name, phone, email) VALUES
        ('landlord1', $1, 'landlord', '王房东', '13800138001', 'landlord@test.com'),
        ('tenant1', $1, 'tenant', '李租客', '13800138002', 'tenant@test.com'),
        ('agent1', $1, 'agent', '张中介', '13800138003', 'agent@test.com')
      `, [hash]);

      await client.query(`
        INSERT INTO properties (landlord_id, address, area, rooms, type, description, images, latitude, longitude, geom) VALUES
        (1, '北京市朝阳区阳光花园3号楼1202', 108, 3, 'apartment', '南北通透，精装修，拎包入住', '[]', 39.9042, 116.4074, ST_SetSRID(ST_MakePoint(116.4074, 39.9042), 4326)),
        (1, '上海市黄浦区中心大厦B座1508', 45, 1, 'studio', '交通便利，近地铁，配套齐全', '[]', 31.2304, 121.4737, ST_SetSRID(ST_MakePoint(121.4737, 31.2304), 4326)),
        (1, '杭州市西湖区翠湖山庄18号', 280, 5, 'villa', '环境优美，带花园，适合家庭', '[]', 30.2741, 120.1551, ST_SetSRID(ST_MakePoint(120.1551, 30.2741), 4326)),
        (1, '深圳市南山区青年公寓D栋608', 65, 2, 'apartment', '年轻化社区，健身房游泳池', '[]', 22.5431, 114.0579, ST_SetSRID(ST_MakePoint(114.0579, 22.5431), 4326)),
        (1, '北京市东城区胡同里45号', 55, 2, 'house', '老北京风情，独门独院', '[]', 39.9289, 116.4074, ST_SetSRID(ST_MakePoint(116.4074, 39.9289), 4326))
      `);

      await client.query(`
        INSERT INTO listings (property_id, title, price, available_from, status) VALUES
        (1, '阳光花园三居室', 5800, '2026-10-01', 'available'),
        (2, '市中心精装一居室', 3200, '2026-09-15', 'available'),
        (3, '郊区独栋别墅', 15000, '2026-11-01', 'available'),
        (4, '青年公寓复式', 4200, '2026-09-01', 'rented'),
        (5, '老街胡同小院', 4800, '2026-10-15', 'available')
      `);

      await client.query(`
        INSERT INTO messages (sender_id, receiver_id, content, type) VALUES
        (NULL, 1, '欢迎注册成为房东，您可以发布房源了！', 'system'),
        (NULL, 2, '欢迎注册成为租客，开始寻找您的理想住所！', 'system'),
        (NULL, 3, '欢迎注册成为中介，协助房东和租客完成交易！', 'system')
      `);

      console.log('Database initialized with demo data');
    }
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
