const express = require('express');
const router = express.Router();

const connection = require('../config/db');

// ==================================================
// B - ADD AND EDIT GAME ROUTES
// B's routes can be added above this section.
// ==================================================


// ==================================================
// C - VIEW AND BROWSE GAME ROUTES
// ==================================================

/**
 * Display the full game catalogue.
 *
 * Final route:
 * GET /games
 *
 * This query retrieves every game and checks whether
 * it currently has an active borrow record.
 */
router.get('/', (req, res) => {
    const sql = `
        SELECT
            g.*,
            CASE
                WHEN COUNT(br.record_id) > 0
                    THEN 'unavailable'
                ELSE 'available'
            END AS availability
        FROM games g
        LEFT JOIN borrow_records br
            ON g.game_id = br.game_id
            AND br.status = 'active'
        GROUP BY
            g.game_id,
            g.title,
            g.genre,
            g.min_players,
            g.max_players,
            g.difficulty,
            g.game_condition,
            g.description,
            g.image_url,
            g.status,
            g.created_at
        ORDER BY g.title ASC
    `;

    connection.query(sql, (error, results) => {
        if (error) {
            console.error(
                'Error retrieving game catalogue:',
                error.message
            );

            return res.status(500).send(
                'Error retrieving game catalogue'
            );
        }

        res.render('games/catalog', {
            games: results,

            // Optional chaining prevents an error before
            // express-session is added by the Auth member.
            user: req.session?.user || null
        });
    });
});

/**
 * Display the details of one game.
 *
 * Final route:
 * GET /games/:id
 *
 * Example:
 * /games/3
 */
router.get('/:id', (req, res) => {
    const gameId = req.params.id;

    // Ensure the route parameter contains a valid positive integer.
    if (!Number.isInteger(Number(gameId)) || Number(gameId) <= 0) {
        return res.status(400).send('Invalid game ID');
    }

    const sql = `
        SELECT
            g.*,
            MAX(br.due_date) AS due_date,
            CASE
                WHEN COUNT(br.record_id) > 0
                    THEN 'unavailable'
                ELSE 'available'
            END AS availability
        FROM games g
        LEFT JOIN borrow_records br
            ON g.game_id = br.game_id
            AND br.status = 'active'
        WHERE g.game_id = ?
        GROUP BY
            g.game_id,
            g.title,
            g.genre,
            g.min_players,
            g.max_players,
            g.difficulty,
            g.game_condition,
            g.description,
            g.image_url,
            g.status,
            g.created_at
    `;

    connection.query(sql, [gameId], (error, results) => {
        if (error) {
            console.error(
                'Error retrieving game details:',
                error.message
            );

            return res.status(500).send(
                'Error retrieving game details'
            );
        }

        if (results.length === 0) {
            return res.status(404).send('Game not found');
        }

        res.render('games/details', {
            game: results[0],
            user: req.session?.user || null
        });
    });
});

module.exports = router;