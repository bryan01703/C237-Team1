const { isAdmin } = require('../middleware/authMiddleware');
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// get register page 
router.get('/register', (req, res) => {
    res.render('register');
});

// Ppost, handling registration
router.post('/register', async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password) {
        req.flash('error', 'Username and password is required');
        return res.redirect('/register');
    }

    try {
        const [existing] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            req.flash('error', 'Username already taken');
            return res.redirect('/register');
        }

        await db.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, password, role || 'member']
        );

        req.flash('success', 'Registration successful, please log in');
        res.redirect('/login');
    } catch (err) {
        console.error(err);
        req.flash('error', 'oops! Something went wrong, please try again');
        res.redirect('/register');
    }
});

// show login page
router.get('/login', (req, res) => {
    res.render('login');
});

//  handle login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const [rows] = await db.query(
            'SELECT * FROM users WHERE username = ? AND password = ?',
            [username, password]
        );

        if (rows.length === 0) {
            req.flash('error', 'Invalid username or password');
            return res.redirect('/login');
        }

        req.session.user = {
            id: rows[0].user_id,
            username: rows[0].username,
            role: rows[0].role
        };

        req.flash('success', `Welcome back, ${rows[0].username}!`);
        res.redirect('/games');
    } catch (err) {
        console.error(err);
        req.flash('error', 'oops! Something went wrong, please try again');
        res.redirect('/login');
    }
});

//  logout
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// to fetch all users (admin only)
router.get('/admin/users', isAdmin, async (req, res) => {
    try {
        const [users] = await db.query('SELECT user_id, username, role FROM users');
        res.render('admin/users', { users });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Could not load users');
        res.redirect('/games');
    }
});

// show edit form for specific user
router.get('/admin/users/edit/:id', isAdmin, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE user_id = ?', [req.params.id]);
        if (rows.length === 0) {
            req.flash('error', 'User not found');
            return res.redirect('/admin/users');
        }
        res.render('admin/editUser', { user: rows[0] });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/users');
    }
});

// updaste user details
router.post('/admin/users/edit/:id', isAdmin, async (req, res) => {
    const { username, password, role } = req.body;
    try {
        await db.query(
            'UPDATE users SET username = ?, password = ?, role = ? WHERE user_id = ?',
            [username, password, role, req.params.id]
        );
        req.flash('success', 'User updated successfully');
        res.redirect('/admin/users');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to update user');
        res.redirect('/admin/users');
    }
});

module.exports = router;