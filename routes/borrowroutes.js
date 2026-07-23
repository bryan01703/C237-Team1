const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isLoggedIn } = require('../middleware/authmiddleware');

// Existing details page posts to /borrow/:id.
// Redirect it to the confirmation page.
router.post('/:id', isLoggedIn, (req, res) => {
    res.redirect(`/borrow/request/${req.params.id}`);
});

// Display the member's borrowing history.
router.get('/my', isLoggedIn, async (req, res) => {
    try {
        const [borrowedGames] = await db.query(
            `SELECT br.*, g.title
             FROM borrow_records br
             JOIN games g ON br.game_id = g.game_id
             WHERE br.user_id = ?
             ORDER BY br.borrow_date DESC`,
            [req.session.user.id]
        );

        res.render('borrow/personalborrowed', { borrowedGames });
    } catch (error) {
        console.error('Error loading borrowed games:', error);
        req.flash('error', 'Could not load your borrowed games.');
        res.redirect('/games');
    }
});

// Display the borrow confirmation page.
router.get('/request/:id', isLoggedIn, async (req, res) => {
    try {
        const [games] = await db.query(
            'SELECT * FROM games WHERE game_id = ? AND archived = FALSE',
            [req.params.id]
        );

        if (games.length === 0) {
            req.flash('error', 'Game not found.');
            return res.redirect('/games');
        }

        res.render('borrow/requestform', { game: games[0] });
    } catch (error) {
        console.error('Error loading borrow request:', error);
        req.flash('error', 'Could not load the borrow request.');
        res.redirect('/games');
    }
});

// Confirm borrowing.
router.post('/request/:id', isLoggedIn, async (req, res) => {
    const gameId = req.params.id;
    const userId = req.session.user.id;

    try {
        const [availableGames] = await db.query(
            `SELECT g.game_id
             FROM games g
             WHERE g.game_id = ?
               AND g.archived = FALSE
               AND NOT EXISTS (
                   SELECT 1
                   FROM borrow_records br
                   WHERE br.game_id = g.game_id
                     AND br.status = 'active'
               )`,
            [gameId]
        );

        if (availableGames.length === 0) {
            req.flash('error', 'This game is currently unavailable.');
            return res.redirect(`/games/${gameId}`);
        }

        await db.query(
            `INSERT INTO borrow_records
             (game_id, user_id, borrow_date, due_date, status)
             VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'active')`,
            [gameId, userId]
        );

        req.flash('success', 'Game borrowed successfully!');
        res.redirect('/borrow/my');
    } catch (error) {
        console.error('Error borrowing game:', error);
        req.flash('error', 'Could not borrow this game.');
        res.redirect(`/games/${gameId}`);
    }
});

// Return a borrowed game.
router.post('/return/:id', isLoggedIn, async (req, res) => {
    try {
        await db.query(
            `UPDATE borrow_records
             SET return_date = CURDATE(), status = 'returned'
             WHERE record_id = ?
               AND user_id = ?
               AND status = 'active'`,
            [req.params.id, req.session.user.id]
        );

        req.flash('success', 'Game returned successfully!');
        res.redirect('/borrow/my');
    } catch (error) {
        console.error('Error returning game:', error);
        req.flash('error', 'Could not return this game.');
        res.redirect('/borrow/my');
    }
});

module.exports = router;