const express = require("express");
const router = express.Router();
const db = require("../config/db");

// View My Borrowed Games
router.get("/my", async (req, res) => {
    const userId = req.session.user.id;

    const [borrowedGames] = await db.query(
        `SELECT br.*, g.title
         FROM borrow_records br
         JOIN games g ON br.game_id = g.game_id
         WHERE br.user_id = ?`,
        [userId]
    );

    res.render("borrow/personalBorrowed", { borrowedGames });
});

// Show Borrow Request Page
router.get("/request/:id", async (req, res) => {

    const [game] = await db.query(
        "SELECT * FROM games WHERE game_id = ?",
        [req.params.id]
    );

    res.render("borrow/requestForm", {
        game: game[0]
    });

});

// Confirm Borrow
router.post("/request/:id", async (req, res) => {

    const gameId = req.params.id;
    const userId = req.session.user.id;

    await db.query(
        `INSERT INTO borrow_records
        (game_id, user_id, borrow_date, due_date, status)
        VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), 'active')`,
        [gameId, userId]
    );

    req.flash("success", "Game borrowed successfully!");

    res.redirect("/borrow/my");

});

// Return Game
router.post("/return/:id", async (req, res) => {

    const recordId = req.params.id;

    await db.query(
        `UPDATE borrow_records
         SET
            return_date = NOW(),
            status = 'returned'
         WHERE record_id = ?`,
        [recordId]
    );

    req.flash("success", "Game returned successfully!");

    res.redirect("/borrow/my");

});

module.exports = router;