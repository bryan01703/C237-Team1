const express = require('express');
const router = express.Router();
const db = require('../config/db');

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
