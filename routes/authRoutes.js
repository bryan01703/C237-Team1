const { isAdmin, isLoggedIn } = require('../middleware/authmiddleware');
const ROLES = require('../config/roles');
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// get register page 
router.get('/register', (req, res) => {
    res.render('register');
});

//  handling registration nobody is able to post role=admin directly
router.post('/register', async (req, res) => {
    const username = req.body.username ? req.body.username.trim() : '';
    const password = req.body.password;

    if (!username || username.length < 3) {
        req.flash('error', 'Username must be at least 3 characters');
        return res.redirect('/register');
    }

    if (!password || password.length < 4) {
        req.flash('error', 'Password must be at least 4 characters');
        return res.redirect('/register');
    }

    try {
        const [existing] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            req.flash('error', 'Username already taken');
            return res.redirect('/register');
        }

        // always member on signup, admin only gets set through the admin edit page
        await db.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, password, ROLES.MEMBER]
        );

        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Could not complete registration');
        res.redirect('/register');
    }
});
    

// show login page
router.get('/login', (req, res) => {
    res.render('login');
});

//  handle login
router.post('/login', async (req, res) => {
    const username = req.body.username ? req.body.username.trim() : '';
    const password = req.body.password;
    
    if (!username || !password) {
        req.flash('error', 'Username and password are required');
        return res.redirect('/login');
    }


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
        res.redirect('/dashboard');
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

router.get('/profile', isLoggedIn, async (req, res) => {
    try {
        // Get user info
        const [rows] = await db.query(
            'SELECT user_id, username, role FROM users WHERE user_id = ?',
            [req.session.user.id]
        );

        if (rows.length === 0) {
            req.flash('error', 'Account not found');
            return res.redirect('/dashboard');
        }

        // Get borrow history
        const [borrowHistory] = await db.query(`
            SELECT
                g.title,
                br.borrow_date,
                br.due_date,
                br.return_date,
                br.status
            FROM borrow_records br
            JOIN games g
                ON br.game_id = g.game_id
            WHERE br.user_id = ?
            ORDER BY br.borrow_date DESC
        `, [req.session.user.id]);

        // Statistics
        const stats = {
            total: borrowHistory.length,
            returned: borrowHistory.filter(r => r.status.toLowerCase() === 'returned').length,
            current: borrowHistory.filter(r => r.status.toLowerCase() === 'borrowed').length,
            overdue: borrowHistory.filter(r => r.status.toLowerCase() === 'overdue').length
        };
        
        res.render('profile', {
            profileUser: rows[0],
            borrowHistory,
            stats
        });

    } catch (err) {
        console.error(err);
        req.flash('error', 'Could not load your profile');
        res.redirect('/dashboard');
    }
});

 //profile 
router.post('/profile', isLoggedIn, async (req, res) => {
    const username = req.body.username ? req.body.username.trim() : '';
    const password = req.body.password;

    if (!username || username.length < 3) {
         req.flash('error', 'Username must be at least 3 characters');
         return res.redirect('/profile');
    }

    try {
        const [existing] = await db.query(
            'SELECT * FROM users WHERE username = ? AND user_id != ?',
            [username, req.session.user.id]
        );
        
        if (existing.length > 0) {
             req.flash('error', 'That username is already taken');
             return res.redirect('/profile');
        }

        if (password && password.trim() !== '') {
             await db.query(
                 'UPDATE users SET username = ?, password = ? WHERE user_id = ?',
                 [username, password, req.session.user.id]
            );

        } else {
             await db.query('UPDATE users SET username = ? WHERE user_id = ?', [username, req.session.user.id]);
        }

        req.session.user.username = username;
        req.flash('success', 'Profile updated successfully');
        res.redirect('/profile');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Could not update your profile');
        res.redirect('/profile');
    }
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
        res.render('admin/editusers', { user: rows[0] });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/users');
    }
});

// updaste user details, checks if there is admin
router.post('/admin/users/edit/:id', isAdmin, async (req, res) => {
    const { username, password, role } = req.body;
    try {
        if (password && password.trim() !== '') {
            await db.query(
                'UPDATE users SET username = ?, password = ?, role = ? WHERE user_id = ?',
                [username, password, role, req.params.id]
            );
        } else {
            await db.query('UPDATE users SET username = ?, role = ? WHERE user_id = ?', [username, role, req.params.id]);
        }
        req.flash('success', 'User updated successfully');
        res.redirect('/admin/users');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to update user');
        res.redirect('/admin/users');
    }
});

//public landing page 
router.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('home');
});

// dashboard post login
router.get('/dashboard', isLoggedIn, (req, res) => {
    res.render('dashboard');
});

module.exports = router;