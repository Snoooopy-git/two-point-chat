const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken, authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 注册
router.post('/register', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    if (username.length < 2 || username.length > 20) {
      return res.status(400).json({ error: '用户名长度需要在 2-20 个字符之间' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: '密码长度不能少于 4 位' });
    }

    // 检查用户名是否已存在
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 加密密码并创建用户
    const hashedPassword = bcrypt.hashSync(password, 10);
    const role = 'user';
    const result = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, hashedPassword, role);

    const token = generateToken(result.lastInsertRowid);
    res.status(201).json({
      message: '注册成功',
      token,
      user: { id: result.lastInsertRowid, username, role }
    });
  } catch (err) {
    console.error('注册错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 登录
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const user = db.prepare('SELECT id, username, password, status, role FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(400).json({ error: '用户名或密码错误' });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({ error: '账号已被禁用，请联系管理员' });
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: '用户名或密码错误' });
    }

    const token = generateToken(user.id);
    res.json({
      message: '登录成功',
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (err) {
    console.error('登录错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取当前用户信息
router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, avatar, role, created_at FROM users WHERE id = ?').get(req.userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ user });
  } catch (err) {
    console.error('获取用户信息错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
