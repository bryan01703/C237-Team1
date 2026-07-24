const express = require('express');
const router = express.Router();
const db = require('../config/db');

// checking availability in SQL
const express = require('express');
const router = express.Router(); 
const db = require('../config/db');

const availabilitySql = `CASE WHEN EXISTS (
    SELECT 1 FROM borrow_records br
    WHERE br.game_id = g.game_id AND br.status = 'active'
) THEN 'unavailable' ELSE 'available' END`;

const SORT_OPTIONS = {
    title_asc: 'g.title ASC',
    title_desc: 'g.title DESC',
    rating_desc: 'average_rating IS NULL, average_rating DESC',
    newest: 'g.created_at DESC'
};

router.get('/', async (req, res) => {
    const q = (req.query.q || '').trim();
    const genre = (req.query.genre || '').trim();
    const difficulty = (req.query.difficulty || '').trim();
    const players = (req.query.players || '').trim();
    const availability = (req.query.availability || '').trim();
    const sort = SORT_OPTIONS[req.query.sort] ? req.query.sort : 'title_asc';

    const conditions = [];
    const params = [];

    if (q) {
        conditions.push('g.title LIKE ?');
        params.push(`%${q}%`);
    }

    if (genre) {
        conditions.push('g.genre = ?');
        params.push(genre);
    }

    if (difficulty) {
        conditions.push('g.difficulty = ?');
        params.push(difficulty);
    }

    const playerCount = Number(players);
    const hasPlayerFilter = Number.isInteger(playerCount) && playerCount > 0;
    if (hasPlayerFilter) {
        conditions.push('g.min_players <= ? AND g.max_players >= ?');
        params.push(playerCount, playerCount);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
        let [games] = await db.query(`
            SELECT g.*, ${availabilitySql} AS availability,
                (SELECT ROUND(AVG(r.rating), 1)
                 FROM reviews r WHERE r.game_id = g.game_id) AS average_rating,
                (SELECT COUNT(*)
                 FROM reviews r WHERE r.game_id = g.game_id) AS review_count
            FROM games g
            ${whereClause}
            ORDER BY ${SORT_OPTIONS[sort]}
        `, params);

        if (availability === 'available' || availability === 'unavailable') {
            games = games.filter(game => game.availability === availability);
        }

        const [genreRows] = await db.query(
            "SELECT DISTINCT genre FROM games WHERE genre IS NOT NULL AND genre <> '' ORDER BY genre ASC"
        );

        const hasSearched = Boolean(q || genre || difficulty || hasPlayerFilter || availability);

        res.render('search/results', {
            games,
            genres: genreRows.map(row => row.genre),
            filters: { q, genre, difficulty, players, availability, sort },
            hasSearched
        });
    }
    catch (error) {
        console.error('Error fetching search results:', error);
        res.flash('error', 'An error occurred in searching results. Please try again later.');
        res.render('search/results', {
            games: [],
            genres: [],
            filters: { q, genre, difficulty, players, availability, sort },
            hasSearched: false
        });
    }
});

module.exports = router;
