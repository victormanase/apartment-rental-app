const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MySQL connection
const dbConfig = {
  host: 'mysql',
  user: 'root',
  password: 'password',
  database: 'apartment_db'
};

// Create seed user
(async () => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute('SELECT * FROM users WHERE username = ?', ['admin']);
    if (rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await conn.execute('INSERT INTO users (username, password, name) VALUES (?, ?, ?)', ['admin', hashedPassword, 'Admin User']);
      console.log('Seed admin user created');
    } else {
      console.log('Admin user already exists');
    }
  } catch (err) {
    console.error('Error seeding user:', err);
  }
})();

// Multer setup for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, 'SECRET_KEY', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

app.post('/auth/register', async (req, res) => {
  const { username, password, name } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const conn = await mysql.createConnection(dbConfig);
  await conn.execute('INSERT INTO users (username, password, name) VALUES (?, ?, ?)', [username, hashedPassword, name]);
  res.send('User registered');
});

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const conn = await mysql.createConnection(dbConfig);
  const [rows] = await conn.execute('SELECT * FROM users WHERE username = ?', [username]);
  if (rows.length && await bcrypt.compare(password, rows[0].password)) {
    const token = jwt.sign({ username: rows[0].username }, 'SECRET_KEY');
    res.json({ token });
  } else {
    res.status(401).send('Invalid credentials');
  }
});

app.post('/users/reset', authenticateToken, async (req, res) => {
  const { username, newPassword } = req.body;
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  const conn = await mysql.createConnection(dbConfig);
  const [rows] = await conn.execute('SELECT * FROM users WHERE username = ?', [username]);
  if (rows.length) {
    await conn.execute('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, username]);
    res.send('Password reset');
  } else {
    res.status(404).send('User not found');
  }
});

app.delete('/users/delete/:username', authenticateToken, async (req, res) => {
  const conn = await mysql.createConnection(dbConfig);
  await conn.execute('DELETE FROM users WHERE username = ?', [req.params.username]);
  res.send('User deleted');
});

app.post('/units/create', authenticateToken, upload.array('conditionImages', 5), async (req, res) => {
  const imagePaths = req.files.map(file => `/uploads/${file.filename}`).join(',');
  const { unitId, unitName, unitSize, rentAmount } = req.body;
  const conn = await mysql.createConnection(dbConfig);
  await conn.execute('INSERT INTO units (unitId, unitName, unitSize, rentAmount, conditionImages) VALUES (?, ?, ?, ?, ?)',
    [unitId, unitName, unitSize, rentAmount, imagePaths]);
  res.send('Unit registered');
});

app.post('/tenants/register', authenticateToken, async (req, res) => {
  const { firstName, middleName, lastName, phoneNumber, unitId, moveInDate } = req.body;
  const conn = await mysql.createConnection(dbConfig);
  await conn.execute('INSERT INTO tenants (firstName, middleName, lastName, phoneNumber, unitId, moveInDate) VALUES (?, ?, ?, ?, ?, ?)',
    [firstName, middleName, lastName, phoneNumber, unitId, moveInDate]);
  res.send('Tenant registered');
});

app.post('/rent/collect', authenticateToken, async (req, res) => {
  const { tenantId, unitId, paidAmount, rentStartDate, rentEndDate } = req.body;
  const conn = await mysql.createConnection(dbConfig);
  await conn.execute('INSERT INTO rents (tenantId, unitId, paidAmount, rentStartDate, rentEndDate) VALUES (?, ?, ?, ?, ?)',
    [tenantId, unitId, paidAmount, rentStartDate, rentEndDate]);
  res.send('Rent collected');
});

app.get('/notifications', authenticateToken, async (req, res) => {
  const conn = await mysql.createConnection(dbConfig);
  const [rows] = await conn.execute('SELECT * FROM rents WHERE rentEndDate < NOW()');
  res.send(rows);
});

app.listen(3000, () => console.log('Server running on port 3000'));