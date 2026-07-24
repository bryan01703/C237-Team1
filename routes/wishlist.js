const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isLoggedIn } = require('../middleware/authmiddleware');
const { MEMBER } = require('../config/roles');

const availabilitySql = `CASE WHEN EXISTS (
    SELECT 1 FROM borrow_records br
    WHERE br.game_id = g.game_id AND br.status = 'active'
) THEN 'unavailable' ELSE 'available' END`;

function validPositiveId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// game availability and sorting options
router.get('/mine', isLoggedIn, async (req, res) => {
    try {
        const [entries] = await db.query(`
            SELECT w.wishlist_id, w.added_at,
                g.game_id, g.title, g.image_url, g.genre, g.difficulty,
                ${availabilitySql} AS availability
            FROM wishlist w
            JOIN games g ON g.game_id = w.game_id
            WHERE w.user_id = ?
            ORDER BY w.added_at DESC
        `, [req.session.user.id]);

        res.render('search/wishlist', { entries });
    } catch (error) {
        console.error('Error loading wishlist:', error.message);
        req.flash('error', 'Could not load your wishlist.');
        res.redirect('/games');
    }
});

// save game to wishlist by gameId
router.post('/:gameId', isLoggedIn, async (req, res) => {
    const gameId = validPositiveId(req.params.gameId);

    if (req.session.user.role !== MEMBER) {
        req.flash('error', 'Only members can use the wishlist.');
        return res.redirect(gameId ? `/games/${gameId}` : '/games');
    }

    if (!gameId) {
        req.flash('error', 'Invalid game.');
        return res.redirect('/games');
    }

    try {
        const [games] = await db.query(
            'SELECT game_id FROM games WHERE game_id = ? AND archived = FALSE',
            [gameId]
        );

        if (games.length === 0) {
            req.flash('error', 'Game not found.');
            return res.redirect('/games');
        }

        const [existing] = await db.query(
            'SELECT wishlist_id FROM wishlist WHERE game_id = ? AND user_id = ?',
            [gameId, req.session.user.id]
        );

        if (existing.length > 0) {
            req.flash('error', 'This game is already on your wishlist.');
            return res.redirect(`/games/${gameId}`);
        }

        await db.query(
            'INSERT INTO wishlist (game_id, user_id) VALUES (?, ?)',
            [gameId, req.session.user.id]
        );

        req.flash('success', 'Added to your wishlist!');
        res.redirect(`/games/${gameId}`);
    } catch (error) {
        console.error('Error adding to wishlist:', error.message);
        req.flash('error', 'Could not add this game to your wishlist.');
        res.redirect(`/games/${gameId}`);
    }
});

// remove wishlist entry by wishlistId
router.post('/remove/:wishlistId', isLoggedIn, async (req, res) => {
    const wishlistId = validPositiveId(req.params.wishlistId);

    if (!wishlistId) {
        req.flash('error', 'Invalid wishlist entry.');
        return res.redirect('/wishlist/mine');
    }

    try {
        const [result] = await db.query(
            'DELETE FROM wishlist WHERE wishlist_id = ? AND user_id = ?',
            [wishlistId, req.session.user.id]
        );

        req.flash(
            result.affectedRows > 0 ? 'success' : 'error',
            result.affectedRows > 0
                ? 'Removed from your wishlist.'
                : 'You can only remove your own wishlist entries.'
        );
    } catch (error) {
        console.error('Error removing from wishlist:', error.message);
        req.flash('error', 'Could not update your wishlist.');
    }

    res.redirect('/wishlist/mine');
});

// Remove game from wishlist
router.post('/game/:gameId/remove', isLoggedIn, async (req, res) => {
    const gameId = validPositiveId(req.params.gameId);

    if (!gameId) {
        req.flash('error', 'Invalid game.');
        return res.redirect('/games');
    }

    try {
        await db.query(
            'DELETE FROM wishlist WHERE game_id = ? AND user_id = ?',
            [gameId, req.session.user.id]
        );
        req.flash('success', 'Removed from your wishlist.');
    } catch (error) {
        console.error('Error removing from wishlist:', error.message);
        req.flash('error', 'Could not update your wishlist.');
    }

    res.redirect(`/games/${gameId}`);
});

module.exports = router;