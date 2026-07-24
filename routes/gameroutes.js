const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAdmin } = require('../middleware/authmiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

/*
 * GAME CATALOGUE MODULE
 * This file combines Function B's game management routes with Function C's
 * catalogue and details routes. Function C handles the Read part of CRUD,
 * live availability, average ratings and the review list for each game.
 */

// automatically create the images directory if it doesn't exist
const uploadDir = path.join(__dirname, '../public/images');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/images'); // save files locally
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// show add game Form
router.get('/add', isAdmin, (req, res) => {
    res.render('games/addgame');
});

// process add game Form
router.post('/add', isAdmin, upload.single('image'), async (req, res) => {
    const { title, genre, min_players, max_players, difficulty, game_condition, description } = req.body;
    // get filename from multer, or use placeholder if no file uploaded
    const image_url = req.file ? req.file.filename : 'placeholder.jpg';
router.post('/add', isAdmin, upload.single('image'), async (req, res) => {
    const { title, genre, min_players, max_players, difficulty, game_condition, description } = req.body;
    // get filename from multer, or use placeholder if no file uploaded
    const image_url = req.file ? req.file.filename : 'placeholder.jpg';

    try {
        await db.query(
            `INSERT INTO games (title, genre, min_players, max_players, difficulty, game_condition, description, image_url) 
            `INSERT INTO games (title, genre, min_players, max_players, difficulty, game_condition, description, image_url) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, genre, min_players, max_players, difficulty, game_condition, description, image_url]
        );
        req.flash('success', 'New game added to the catalog successfully!');
        res.redirect('/games');
    } catch (error) {
        console.error('Error adding game:', error.message);
        req.flash('error', 'Failed to add game.');
        req.flash('error', 'Failed to add game.');
        res.redirect('/games/add');
    }
});

// show edit game form
router.get('/edit/:id', isAdmin, async (req, res) => {
    try {
        const [games] = await db.query('SELECT * FROM games WHERE game_id = ?', [req.params.id]);
        if (games.length === 0) return res.redirect('/games');
        const [games] = await db.query('SELECT * FROM games WHERE game_id = ?', [req.params.id]);
        if (games.length === 0) return res.redirect('/games');
        res.render('games/editgame', { game: games[0] });
    } catch (error) {
        res.redirect('/games');
    }
});

// process edit game form
router.post('/edit/:id', isAdmin, upload.single('image'), async (req, res) => {
    const { title, genre, min_players, max_players, difficulty, game_condition, description, existing_image } = req.body;
    // if a new file is uploaded, use it. otherwise, keep the existing image string.
    const image_url = req.file ? req.file.filename : existing_image;

    try {
        await db.query(
            `UPDATE games SET title = ?, genre = ?, min_players = ?, max_players = ?, 
             difficulty = ?, game_condition = ?, description = ?, image_url = ? WHERE game_id = ?`,
            [title, genre, min_players, max_players, difficulty, game_condition, description, image_url, req.params.id]
        );
        req.flash('success', 'Game updated successfully!');
        res.redirect(`/games/${req.params.id}`);
    } catch (error) {
        res.redirect(`/games/edit/${req.params.id}`);
    }
});

// retire and delete routes
// soft delete (retire) - hides from catalog, preserves borrow history
router.post('/retire/:id', isAdmin, async (req, res) => {
    try {
        await db.query('UPDATE games SET archived = TRUE WHERE game_id = ?', [req.params.id]);
        req.flash('success', 'Game retired and hidden from public view.');
        res.redirect(`/games/${req.params.id}`);
    } catch (error) {
        req.flash('error', 'Failed to retire game.');
        res.redirect(`/games/${req.params.id}`);
    }
});

// unretire - restores a game to the public catalog
router.post('/unretire/:id', isAdmin, async (req, res) => {
    try {
        await db.query('UPDATE games SET archived = FALSE WHERE game_id = ?', [req.params.id]);
        req.flash('success', 'Game unretired and restored to the catalog.');
        res.redirect(`/games/${req.params.id}`);
    } catch (error) {
        req.flash('error', 'Failed to unretire game.');
        res.redirect('/games');
    }
});

// hard delete - protected against wiping borrow history
router.post('/delete/:id', isAdmin, async (req, res) => {
    try {
        // check if any borrow records exist for this game
        const [records] = await db.query('SELECT 1 FROM borrow_records WHERE game_id = ? LIMIT 1', [req.params.id]);
        
        // if records exist, block the deletion to save the history
        if (records.length > 0) {
            req.flash('error', 'Cannot hard-delete a game that has existing borrow history. Please Retire it instead.');
            return res.redirect(`/games/${req.params.id}`);
        }

        // if no records exist, it is safe to delete
        await db.query('DELETE FROM games WHERE game_id = ?', [req.params.id]);
        req.flash('success', 'Game permanently deleted.');
        res.redirect('/games');
    } catch (error) {
        req.flash('error', 'Error attempting to delete game.');
        res.redirect(`/games/${req.params.id}`);
    }
});

// public routes
const availabilitySql = `CASE WHEN EXISTS (
    SELECT 1 FROM borrow_records br WHERE br.game_id = g.game_id AND br.status = 'active'
) THEN 'unavailable' ELSE 'available' END`;

// READ (list): display non-archived games to members and all games to admins.
router.get('/', async (req, res) => {
    try {
        let query = `
            SELECT g.*, ${availabilitySql} AS availability,
                (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.game_id = g.game_id) AS average_rating,
                (SELECT COUNT(*) FROM reviews r WHERE r.game_id = g.game_id) AS review_count
            FROM games g WHERE g.archived = FALSE ORDER BY g.title ASC
        `;

        // If the user is logged in and is an admin, fetch ALL games (including archived)
        if (req.session.user && req.session.user.role === 'admin') {
            query = `
                SELECT g.*, ${availabilitySql} AS availability,
                    (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.game_id = g.game_id) AS average_rating,
                    (SELECT COUNT(*) FROM reviews r WHERE r.game_id = g.game_id) AS review_count
                FROM games g ORDER BY g.archived ASC, g.title ASC
            `;
        }

        const [games] = await db.query(query);
        return res.render('games/catalog', { games });
    } catch (error) {
        return res.status(500).render('games/catalog', { games: [] });
    }
});

// READ (single): display one game's details, due date and member reviews.
router.get('/:id', async (req, res) => {
    try {
        const [games] = await db.query(`
            SELECT g.*, ${availabilitySql} AS availability,
                (SELECT br.due_date FROM borrow_records br
                 WHERE br.game_id = g.game_id AND br.status = 'active'
                 ORDER BY br.due_date ASC LIMIT 1) AS due_date
                ,(SELECT ROUND(AVG(r.rating), 1)
                  FROM reviews r WHERE r.game_id = g.game_id) AS average_rating
                ,(SELECT COUNT(*)
                  FROM reviews r WHERE r.game_id = g.game_id) AS review_count
            FROM games g WHERE g.game_id = ? LIMIT 1
        `, [req.params.id]);

        if (games.length === 0) {
            return res.status(404).send('Game not found.');
        }

        // Fetch all reviews for this specific game
        const [reviews] = await db.query(`
            SELECT r.review_id, r.user_id, r.rating, r.comment,
                   r.created_at, r.updated_at, u.username
            FROM reviews r
            JOIN users u ON u.user_id = r.user_id
            WHERE r.game_id = ?
            ORDER BY r.updated_at DESC
        `, [req.params.id]);
        let isWishlisted = false;
        if (req.session.user) {
            const [wishlistRows] = await db.query(
                'SELECT wishlist_id FROM wishlist WHERE game_id = ? AND user_id = ?',
                [req.params.id, req.session.user.id]
            );
            isWishlisted = wishlistRows.length > 0;
        }

        return res.render('games/details', { game: games[0], reviews, isWishlisted });
    } catch (error) {
        return res.status(500).send('Error');
    }
});

module.exports = router;