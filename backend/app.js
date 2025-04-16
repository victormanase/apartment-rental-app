const express = require('express');
const mongoose = require('mongoose');
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

mongoose.connect('mongodb://mongo:27017/apartment_db', { useNewUrlParser: true, useUnifiedTopology: true });

const User = mongoose.model('User', new mongoose.Schema({
  username: String,
  password: String,
  name: String
}));

const Unit = mongoose.model('Unit', new mongoose.Schema({
  unitId: String,
  unitName: String,
  unitSize: String,
  rentAmount: Number,
  conditionImages: [String]
}));

const Tenant = mongoose.model('Tenant', new mongoose.Schema({
  firstName: String,
  middleName: String,
  lastName: String,
  phoneNumber: String,
  unitId: String,
  moveInDate: Date
}));

const Rent = mongoose.model('Rent', new mongoose.Schema({
  tenantId: String,
  unitId: String,
  paidAmount: Number,
  rentStartDate: Date,
  rentEndDate: Date
}));

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, 'SECRET_KEY', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

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

app.post('/auth/register', async (req, res) => {
  const { username, password, name } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hashedPassword, name });
  await user.save();
  res.send('User registered');
});

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ username: user.username }, 'SECRET_KEY');
    res.json({ token });
  } else {
    res.status(401).send('Invalid credentials');
  }
});

app.post('/users/reset', authenticateToken, async (req, res) => {
  const { username, newPassword } = req.body;
  const user = await User.findOne({ username });
  if (user) {
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.send('Password reset');
  } else {
    res.status(404).send('User not found');
  }
});

app.delete('/users/delete/:username', authenticateToken, async (req, res) => {
  await User.deleteOne({ username: req.params.username });
  res.send('User deleted');
});

app.post('/units/create', authenticateToken, upload.array('conditionImages', 5), async (req, res) => {
  const imagePaths = req.files.map(file => `/uploads/${file.filename}`);
  const { unitId, unitName, unitSize, rentAmount } = req.body;
  const unit = new Unit({ unitId, unitName, unitSize, rentAmount, conditionImages: imagePaths });
  await unit.save();
  res.send(unit);
});

app.post('/tenants/register', authenticateToken, async (req, res) => {
  const tenant = new Tenant(req.body);
  await tenant.save();
  res.send(tenant);
});

app.post('/rent/collect', authenticateToken, async (req, res) => {
  const rent = new Rent(req.body);
  await rent.save();
  res.send(rent);
});

app.get('/notifications', authenticateToken, async (req, res) => {
  const today = new Date();
  const dueRents = await Rent.find({ rentEndDate: { $lt: today } });
  res.send(dueRents);
});

app.listen(3000, () => console.log('Server running on port 3000'));