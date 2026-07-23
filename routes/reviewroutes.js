const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isLoggedIn } = require('../middleware/authmiddleware');
const { MEMBER, ADMIN } = require('../config/roles');

function validPositiveId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validateReview(ratingValue, commentValue) {
    const rating = Number(ratingValue);
    const comment = typeof commentValue === 'string' ? commentValue.trim() : '';

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return { error: 'Rating must be between 1 and 5.' };
    }

    if (comment.length > 500) {
        return { error: 'Review comment cannot exceed 500 characters.' };
    }

    return { rating, comment };
}

// CREATE - a member adds one review for a game.
router.post('/games/:gameId', isLoggedIn, async (req, res) => {
    const gameId = validPositiveId(req.params.gameId);
    const review = validateReview(req.body.rating, req.body.comment);

    if (req.session.user.role !== MEMBER) {
        req.flash('error', 'Only members can write reviews.');
        return res.redirect(gameId ? `/games/${gameId}` : '/games');
    }

    if (!gameId || review.error) {
        req.flash('error', review.error || 'Invalid game ID.');
        return res.redirect(gameId ? `/games/${gameId}` : '/games');
    }

    try {
        const [games] = await db.query('SELECT game_id FROM games WHERE game_id = ?', [gameId]);
        if (games.length === 0) {
            req.flash('error', 'Game not found.');
            return res.redirect('/games');
        }

        await db.query(
            'INSERT INTO reviews (game_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
            [gameId, req.session.user.id, review.rating, review.comment || null]
        );
        req.flash('success', 'Your review was added successfully.');
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            req.flash('error', 'You have already reviewed this game. You can edit your review instead.');
        } else {
            console.error('Error adding review:', error.message);
            req.flash('error', 'Your review could not be added.');
        }
    }

    return res.redirect(`/games/${gameId}`);
});

// UPDATE - a member edits only their own review.
router.post('/:reviewId/edit', isLoggedIn, async (req, res) => {
    const reviewId = validPositiveId(req.params.reviewId);
    const review = validateReview(req.body.rating, req.body.comment);
    const gameId = validPositiveId(req.body.game_id);

    if (req.session.user.role !== MEMBER) {
        req.flash('error', 'Only members can edit reviews.');
        return res.redirect(gameId ? `/games/${gameId}` : '/games');
    }

    if (!reviewId || !gameId || review.error) {
        req.flash('error', review.error || 'Invalid review information.');
        return res.redirect(gameId ? `/games/${gameId}` : '/games');
    }

    try {
        const [result] = await db.query(
            `UPDATE reviews SET rating = ?, comment = ?
             WHERE review_id = ? AND user_id = ? AND game_id = ?`,
            [review.rating, review.comment || null, reviewId, req.session.user.id, gameId]
        );

        req.flash(
            result.affectedRows > 0 ? 'success' : 'error',
            result.affectedRows > 0
                ? 'Your review was updated successfully.'
                : 'You can only edit your own review.'
        );
    } catch (error) {
        console.error('Error updating review:', error.message);
        req.flash('error', 'Your review could not be updated.');
    }

    return res.redirect(`/games/${gameId}`);
});

// DELETE - owners may delete their review; admins may delete any review.
router.post('/:reviewId/delete', isLoggedIn, async (req, res) => {
    const reviewId = validPositiveId(req.params.reviewId);
    const gameId = validPositiveId(req.body.game_id);

    if (!reviewId || !gameId) {
        req.flash('error', 'Invalid review information.');
        return res.redirect('/games');
    }

    try {
        const sql = req.session.user.role === ADMIN
            ? 'DELETE FROM reviews WHERE review_id = ? AND game_id = ?'
            : 'DELETE FROM reviews WHERE review_id = ? AND user_id = ? AND game_id = ?';
        const values = req.session.user.role === ADMIN
            ? [reviewId, gameId]
            : [reviewId, req.session.user.id, gameId];
        const [result] = await db.query(sql, values);

        req.flash(
            result.affectedRows > 0 ? 'success' : 'error',
            result.affectedRows > 0
                ? 'Review deleted successfully.'
                : 'You can only delete your own review.'
        );
    } catch (error) {
        console.error('Error deleting review:', error.message);
        req.flash('error', 'The review could not be deleted.');
    }

    return res.redirect(`/games/${gameId}`);
});

module.exports = router;
