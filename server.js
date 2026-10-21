require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'kigezi_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8*60*60*1000 }
}));

// Root redirect
app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    res.redirect('/dashboard.html');
  } else {
    res.redirect('/login.html');
  }
});

app.use(express.static(path.join(__dirname, 'public')));

let pool;

async function initDB() {
  const isCloudHost = process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1';
  const dbConfig = process.env.DATABASE_URL
    ? { uri: process.env.DATABASE_URL, waitForConnections: true, connectionLimit: 10, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'inventory_management',
        waitForConnections: true,
        connectionLimit: 10,
        ssl: (process.env.DB_SSL === 'true' || isCloudHost) ? { rejectUnauthorized: false } : undefined
      };

  pool = mysql.createPool(dbConfig);
  const conn = await pool.getConnection();
  console.log('MySQL connected - Kigezi Traders DB');

  // Ensure core tables exist (safe for clean cloud databases and existing databases)
  await conn.query(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('manager','storekeeper','salesperson','accountant','admin') NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await conn.query(`CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_code VARCHAR(20) UNIQUE NOT NULL,
    supplier_name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await conn.query(`CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_code VARCHAR(20) UNIQUE NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    unit_cost DECIMAL(10,2) NOT NULL,
    selling_price DECIMAL(10,2) NOT NULL,
    current_stock INT NOT NULL DEFAULT 0,
    opening_quantity INT NOT NULL DEFAULT 0,
    reorder_level INT NOT NULL DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await conn.query(`CREATE TABLE IF NOT EXISTS purchases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_no VARCHAR(30) UNIQUE NOT NULL,
    supplier_id INT NOT NULL,
    purchase_date DATE NOT NULL,
    total_amount DECIMAL(12,2) DEFAULT 0,
    recorded_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await conn.query(`CREATE TABLE IF NOT EXISTS purchase_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_cost DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL
  )`);
  await conn.query(`CREATE TABLE IF NOT EXISTS stock_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    movement_type VARCHAR(20) NOT NULL,
    quantity_change INT NOT NULL,
    quantity_before INT NOT NULL,
    quantity_after INT NOT NULL,
    reference_no VARCHAR(50),
    moved_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await conn.query(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id VARCHAR(50),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await conn.query(`CREATE TABLE IF NOT EXISTS sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_no VARCHAR(30) UNIQUE NOT NULL,
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(12,2) DEFAULT 0,
    sold_by INT,
    customer_name VARCHAR(100)
  )`);
  await conn.query(`CREATE TABLE IF NOT EXISTS sale_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL
  )`);

  const [users] = await conn.query('SELECT COUNT(*) as c FROM users');
  if (users[0].c === 0) {
    const hash = await bcrypt.hash('Kigezi123', 10);
    await conn.query(`INSERT INTO users (username, password_hash, full_name, role) VALUES
      ('manager',?, 'Shop Manager','manager'),
      ('storekeeper',?, 'Store Keeper','storekeeper'),
      ('salesperson',?, 'Sales Person','salesperson'),
      ('accountant',?, 'Accountant','accountant'),
      ('admin',?, 'System Admin','admin')`, [hash,hash,hash,hash,hash]);
    console.log('Default users created - password: Kigezi123');
  }
  conn.release();
}

function requireLogin(req,res,next){
  if(!req.session.user) return res.status(401).json({error:'Not logged in'});
  next();
}
function requireRole(roles){
  return (req,res,next)=>{
    if(!req.session.user) return res.status(401).json({error:'Not logged in'});
    if(!roles.includes(req.session.user.role)) return res.status(403).json({error:'Access denied for '+req.session.user.role});
    next();
  }
}

// ===== REGISTER - ALL SYSTEM USERS =====
app.post('/api/register', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { username, email, password, role } = req.body;
    if(!username || !password || !role) return res.status(400).json({error: 'All fields required'});
    
    // Only admin/manager can create staff roles, but anyone can self-register as customer/supplier
    const allowedSelf = ['customer','supplier'];
    if(!allowedSelf.includes(role)){
      // For demo, allow all for your project defense. In production, check admin session
      // if(!req.session.user || !['admin','manager'].includes(req.session.user.role)) return...
    }
    
    const hashed = await bcrypt.hash(password, 10);
    const full_name = req.body.full_name || username;
    await conn.query('INSERT INTO users (username, password_hash, full_name, role) VALUES (?,?,?,?)', [username, hashed, full_name, role]);
    res.json({message: `Account created as ${role}! Now login.`});
  } catch(e){
    if(e.code === 'ER_DUP_ENTRY') res.status(400).json({error: 'Username or Email already exists'});
    else res.status(400).json({error: e.message});
  } finally { conn.release(); }
});
app.post('/api/login', async (req,res)=>{
  try{
    const {username,password} = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE username=? AND is_active=1', [username]);
    if(rows.length===0) return res.status(400).json({error:'Invalid username'});
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if(!ok) return res.status(400).json({error:'Invalid password'});
    req.session.user = {id:user.id, username:user.username, role:user.role, full_name:user.full_name};
    await pool.query('INSERT INTO audit_logs (user_id, action) VALUES (?,?)', [user.id, 'Login']);
    res.json({message:'Login success', user:req.session.user});
  }catch(e){ console.error(e); res.status(500).json({error:e.message}); }
});


app.post('/api/logout', (req,res)=>{ req.session.destroy(()=>res.json({message:'Logged out'})); });
app.get('/api/me', (req,res)=>{ res.json({user:req.session.user || null}); });

app.get('/api/users', requireRole(['manager','admin']), async (req,res)=>{
  const [rows] = await pool.query('SELECT id, username, full_name, role, is_active, created_at FROM users');
  res.json(rows);
});

app.get('/api/suppliers', requireLogin, async (req,res)=>{
  const [rows] = await pool.query('SELECT * FROM suppliers ORDER BY id DESC');
  res.json(rows);
});
app.post('/api/suppliers', requireRole(['manager','storekeeper','admin']), async (req,res)=>{
  try{
    let {supplier_code, code, supplier_name, name, contact_person, contact, phone, email, address} = req.body;
    supplier_name = supplier_name || name;
    contact_person = contact_person || contact;
    phone = phone || contact;
    supplier_code = supplier_code || code || ('SUP' + Date.now());
    if(!supplier_name) return res.status(400).json({error: 'Supplier name is required'});
    const [result] = await pool.query(
      'INSERT INTO suppliers (supplier_code, supplier_name, contact_person, phone, email, address) VALUES (?,?,?,?,?,?)',
      [supplier_code, supplier_name, contact_person || '', phone || '', email || '', address || '']
    );
    res.json({message:'Supplier added successfully', id: result.insertId});
  }catch(e){ res.status(400).json({error:e.message}); }
});

app.put('/api/suppliers/:id', requireRole(['manager','storekeeper','admin']), async (req,res)=>{
  try{
    let {supplier_code, code, supplier_name, name, contact_person, contact, phone, email, address} = req.body;
    supplier_name = supplier_name || name;
    contact_person = contact_person || contact;
    phone = phone || contact;
    supplier_code = supplier_code || code;
    if(!supplier_name) return res.status(400).json({error: 'Supplier name is required'});
    await pool.query(
      'UPDATE suppliers SET supplier_code=?, supplier_name=?, contact_person=?, phone=?, email=?, address=? WHERE id=?',
      [supplier_code, supplier_name, contact_person || '', phone || '', email || '', address || '', req.params.id]
    );
    res.json({message:'Supplier updated successfully'});
  }catch(e){ res.status(400).json({error:e.message}); }
});

app.delete('/api/suppliers/:id', requireRole(['manager','admin']), async (req,res)=>{
  try{
    const [purchases] = await pool.query('SELECT COUNT(*) as c FROM purchases WHERE supplier_id=?', [req.params.id]);
    if(purchases[0].c > 0) {
      return res.status(400).json({error: `Cannot delete: supplier has ${purchases[0].c} recorded purchase(s).`});
    }
    await pool.query('DELETE FROM suppliers WHERE id=?', [req.params.id]);
    res.json({message:'Supplier deleted successfully'});
  }catch(e){ res.status(400).json({error:e.message}); }
});

app.get('/api/products', requireLogin, async (req,res)=>{
  const [rows] = await pool.query('SELECT * FROM products ORDER BY id DESC');
  res.json(rows);
});
app.post('/api/products', requireRole(['manager','storekeeper','admin']), async (req,res)=>{
  const conn = await pool.getConnection();
  try{
    await conn.beginTransaction();
    let {product_code, product_name, category, unit_cost, cost_price, selling_price, opening_quantity, quantity, stock, reorder_level} = req.body;
    unit_cost = unit_cost || cost_price;
    const openingQty = opening_quantity || quantity || stock || 0;
    const opening = parseInt(openingQty)||0;
    const reorder = parseInt(reorder_level)||0;
    if(!product_code ||!product_name ||!unit_cost){ throw new Error('Missing fields: code, name, cost'); }
    const [result] = await conn.query(
      'INSERT INTO products (product_code, product_name, category, unit_cost, selling_price, opening_quantity, current_stock, reorder_level) VALUES (?,?,?,?,?,?,?,?)',
      [product_code, product_name, category, unit_cost, selling_price, opening, opening, reorder]
    );
    await conn.query(
      'INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after) VALUES (?,?,?,?,?)',
      [result.insertId, 'IN', opening, 0, opening]
    );
    await conn.commit();
    res.json({message:'Product registered'});
  }catch(e){
    await conn.rollback();
    console.log(e.message);
    res.status(400).json({error:e.message});
  }finally{ conn.release(); }
});
    

  // ===== OVERRIDE - EDIT PRODUCT =====
app.put('/api/products/:id', requireLogin, requireRole(['manager','storekeeper','admin']), async (req,res)=>{
  const conn = await pool.getConnection();
  try{
    const {product_code, product_name, category, unit_cost, selling_price, opening_quantity, reorder_level, current_stock} = req.body;
    const stock = current_stock || opening_quantity || 0;
    await conn.query('UPDATE products SET product_code=?, product_name=?, category=?, unit_cost=?, selling_price=?, current_stock=?, reorder_level=? WHERE id=?',
    [product_code, product_name, category, unit_cost, selling_price, stock, reorder_level, req.params.id]);
    res.json({message:'Product overridden/updated'});
  }catch(e){
    res.status(400).json({error:e.message});
  }finally{
    conn.release();
  }
});

// ===== OVERRIDE - DELETE PRODUCT =====
app.delete('/api/products/:id', requireLogin, requireRole(['manager','admin']), async (req,res)=>{
  const conn = await pool.getConnection();
  try{
    await conn.query('DELETE FROM products WHERE id=?', [req.params.id]);
    res.json({message:'Product deleted'});
  }catch(e){
    res.status(400).json({error:'Cannot delete - has purchases or sales'});
  }finally{
    conn.release();
  }
});


app.get('/api/purchases', requireLogin, async (req,res)=>{
  const [rows] = await pool.query(`SELECT p.*, s.supplier_name FROM purchases p LEFT JOIN suppliers s ON p.supplier_id=s.id ORDER BY p.id DESC`);
  res.json(rows);
});
app.post('/api/purchases', requireRole(['manager','storekeeper','admin']), async (req,res)=>{
  const conn = await pool.getConnection();
  try{
    await conn.beginTransaction();
    const items = req.body.items || req.body.products || [];
    let supplier_id = req.body.supplier_id || req.body.supplier;
    if(!items || !Array.isArray(items) || items.length === 0) throw new Error('Please add at least one product to the purchase cart');
    if(!supplier_id) {
      const [sups] = await conn.query('SELECT id FROM suppliers LIMIT 1');
      if(sups.length > 0) supplier_id = sups[0].id;
      else throw new Error('No suppliers found. Please add a supplier first.');
    }
    const recordedBy = req.session.user ? req.session.user.id : null;
    const purchase_no = 'PUR'+Date.now();
    let total=0;
    items.forEach(i=>{
      const qty = parseInt(i.qty || i.quantity || 1);
      const cost = parseFloat(i.cost || i.unit_cost || 0);
      total += qty * cost;
    });
    const [pRes] = await conn.query(
      'INSERT INTO purchases (purchase_no, supplier_id, purchase_date, total_amount, recorded_by) VALUES (?,?,CURDATE(),?,?)',
      [purchase_no, supplier_id, total, recordedBy]
    );
    const purchase_id = pRes.insertId;
    for(let it of items){
      const qty = parseInt(it.qty || it.quantity || 1);
      const cost = parseFloat(it.cost || it.unit_cost || 0);
      const product_id = it.product_id || it.id;
      await conn.query(
        'INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, subtotal) VALUES (?,?,?,?,?)',
        [purchase_id, product_id, qty, cost, qty*cost]
      );
      const [prodRows] = await conn.query('SELECT current_stock, product_name FROM products WHERE id=? FOR UPDATE', [product_id]);
      if(prodRows.length === 0) throw new Error('Product not found: '+product_id);
      const before = prodRows[0].current_stock;
      const after = before + qty;
      await conn.query('UPDATE products SET current_stock=? WHERE id=?', [after, product_id]);
      await conn.query(
        'INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, reference_no, moved_by) VALUES (?,?,?,?,?,?,?)',
        [product_id, 'purchase', qty, before, after, purchase_no, recordedBy]
      );
    }
    await conn.commit();
    res.json({message:'Purchase recorded successfully', purchase_no, total});
  }catch(e){
    await conn.rollback();
    console.error('Purchase error:', e.message);
    res.status(400).json({error: e.message || 'Failed to record purchase'});
  }finally{ conn.release(); }
});

app.get('/api/sales', requireLogin, async (req,res)=>{
  const [rows] = await pool.query(`SELECT s.*, u.username as sold_by_name FROM sales s LEFT JOIN users u ON s.sold_by=u.id ORDER BY s.id DESC`);
  res.json(rows);
});
app.post('/api/sales', requireRole(['manager','salesperson','admin']), async (req,res)=>{
  const conn = await pool.getConnection();
  try{
    await conn.beginTransaction();
    const items = req.body.items || req.body.products || [];
    const customer_name = req.body.customer_name || req.body.customer || 'Walk-in';
    if(!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Please add at least one product to the sale cart');
    }
    const soldBy = req.session.user ? req.session.user.id : null;
    let total=0;
    for(let it of items){
      const qty = parseInt(it.quantity || it.qty || 1);
      const price = parseFloat(it.unit_price || it.price || it.selling_price || 0);
      const product_id = it.product_id || it.id;
      const [prod] = await conn.query('SELECT current_stock, product_name FROM products WHERE id=? FOR UPDATE', [product_id]);
      if(prod.length === 0) throw new Error('Product not found: ' + product_id);
      if(prod[0].current_stock < qty) {
        throw new Error(`Insufficient stock for ${prod[0].product_name || 'item'}. Available: ${prod[0].current_stock}, requested: ${qty}`);
      }
      total += qty * price;
    }
    const sale_no = 'SAL'+Date.now();
    const [sRes] = await conn.query('INSERT INTO sales (sale_no, total_amount, sold_by, customer_name) VALUES (?,?,?,?)', [sale_no, total, soldBy, customer_name]);
    const sale_id = sRes.insertId;
    for(let it of items){
      const qty = parseInt(it.quantity || it.qty || 1);
      const price = parseFloat(it.unit_price || it.price || it.selling_price || 0);
      const product_id = it.product_id || it.id;
      const [prodRows] = await conn.query('SELECT current_stock FROM products WHERE id=?', [product_id]);
      const before = prodRows[0].current_stock;
      const after = before - qty;
      await conn.query('INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal) VALUES (?,?,?,?,?)', [sale_id, product_id, qty, price, qty*price]);
      await conn.query('UPDATE products SET current_stock=? WHERE id=?', [after, product_id]);
      await conn.query('INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, reference_no, moved_by) VALUES (?,?,?,?,?,?,?)', [product_id,'sale',-qty,before,after,sale_no,soldBy]);
    }
    await conn.commit();
    res.json({message:'Sale completed successfully', sale_no, total});
  }catch(e){
    await conn.rollback();
    console.error('Sale error:', e.message);
    res.status(400).json({error: e.message || 'Failed to record sale'});
  }finally{ conn.release(); }
});

app.get('/api/reports/dashboard', requireLogin, async (req,res)=>{
  const [[prodCount]] = await pool.query('SELECT COUNT(*) as total FROM products');
  const [[lowCount]] = await pool.query('SELECT COUNT(*) as total FROM products WHERE current_stock <= reorder_level');
  const [[salesToday]] = await pool.query("SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as total FROM sales WHERE DATE(sale_date)=CURDATE()");
  const [[purchasesToday]] = await pool.query('SELECT COUNT(*) as count FROM purchases WHERE purchase_date=CURDATE()');
  const [lowStock] = await pool.query('SELECT product_code, product_name, current_stock, reorder_level FROM products WHERE current_stock <= reorder_level LIMIT 10');
  const [recentSales] = await pool.query('SELECT sale_no, total_amount, sale_date FROM sales ORDER BY id DESC LIMIT 5');
  res.json({totalProducts:prodCount.total, lowStockCount:lowCount.total, salesToday, purchasesToday, lowStock, recentSales});
});
app.get('/api/reports/stock', requireLogin, async (req,res)=>{
  const [rows] = await pool.query('SELECT product_code, product_name, current_stock, reorder_level, selling_price, current_stock*selling_price as stock_value FROM products');
  res.json(rows);
});
app.get('/api/audit', requireRole(['manager','admin']), async (req,res)=>{
  const [rows] = await pool.query('SELECT a.*, u.username FROM audit_logs a LEFT JOIN users u ON a.user_id=u.id ORDER BY a.id DESC LIMIT 100');
  res.json(rows);
});

app.listen(PORT, async ()=>{
  await initDB();
  console.log(`Kigezi Traders FULL System running at http://localhost:${PORT}/login.html`);
});