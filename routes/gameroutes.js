const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAdmin } = require('../middleware/authmiddleware'); // import isAdmin middleware for add and edit routes

// show add game Form
router.get('/add', isAdmin, (req, res) => {
    res.render('games/addgame');
});

// process add game Form
router.post('/add', isAdmin, async (req, res) => {
    const { 
        title, genre, min_players, max_players, 
        difficulty, game_condition, description, image_url 
    } = req.body;

    try {
        await db.query(
            `INSERT INTO games 
            (title, genre, min_players, max_players, difficulty, game_condition, description, image_url) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, genre, min_players, max_players, difficulty, game_condition, description, image_url]
        );
        req.flash('success', 'New game added to the catalog successfully!');
        res.redirect('/games');
    } catch (error) {
        console.error('Error adding game:', error.message);
        req.flash('error', 'Failed to add game. Please check your inputs.');
        res.redirect('/games/add');
    }
});

// show edit game form
router.get('/edit/:id', isAdmin, async (req, res) => {
    const gameId = req.params.id;

    try {
        const [games] = await db.query('SELECT * FROM games WHERE game_id = ?', [gameId]);
        
        if (games.length === 0) {
            req.flash('error', 'Game not found.');
            return res.redirect('/games');
        }

        res.render('games/editgame', { game: games[0] });
    } catch (error) {
        console.error('Error fetching game for edit:', error.message);
        req.flash('error', 'Could not load the edit form.');
        res.redirect('/games');
    }
});

// process edit game form
router.post('/edit/:id', isAdmin, async (req, res) => {
    const gameId = req.params.id;
    const { 
        title, genre, min_players, max_players, 
        difficulty, game_condition, description, image_url 
    } = req.body;

    try {
        await db.query(
            `UPDATE games 
            SET title = ?, genre = ?, min_players = ?, max_players = ?, 
                difficulty = ?, game_condition = ?, description = ?, image_url = ? 
            WHERE game_id = ?`,
            [title, genre, min_players, max_players, difficulty, game_condition, description, image_url, gameId]
        );
        req.flash('success', 'Game details updated successfully!');
        res.redirect(`/games/${gameId}`); // redirect to detail page after successful update
    } catch (error) {
        console.error('Error updating game:', error.message);
        req.flash('error', 'Failed to update game details.');
        res.redirect(`/games/edit/${gameId}`);
    }
});

// B's fixed add/edit routes should stay above C's dynamic /:id route.
const availabilitySql = `CASE WHEN EXISTS (
    SELECT 1 FROM borrow_records br
    WHERE br.game_id = g.game_id AND br.status = 'active'
) THEN 'unavailable' ELSE 'available' END`;

router.get('/', async (req, res) => {
    try {
        const [games] = await db.query(`
            SELECT g.*, ${availabilitySql} AS availability
            FROM games g ORDER BY g.title ASC
        `);
        return res.render('games/catalog', { games });
    } catch (error) {
        console.error('Error retrieving game catalogue:', error.message);
        req.flash('error', 'The game catalogue could not be loaded. Please try again.');
        return res.status(500).render('games/catalog', { games: [] });
    }
});

router.get('/:id', async (req, res) => {
    const gameId = Number(req.params.id);
    if (!Number.isSafeInteger(gameId) || gameId <= 0) {
        return res.status(400).send('Invalid game ID.');
    }

    try {
        const [games] = await db.query(`
            SELECT g.*, ${availabilitySql} AS availability,
                (SELECT br.due_date FROM borrow_records br
                 WHERE br.game_id = g.game_id AND br.status = 'active'
                 ORDER BY br.due_date ASC LIMIT 1) AS due_date
            FROM games g WHERE g.game_id = ? LIMIT 1
        `, [gameId]);

        if (games.length === 0) {
            return res.status(404).send('Game not found.');
        }
        return res.render('games/details', { game: games[0] });
    } catch (error) {
        console.error('Error retrieving game details:', error.message);
        return res.status(500).send('The game details could not be loaded. Please try again.');
    }
});

module.exports = router;
