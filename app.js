const mysql = require('mysql2/promise');
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const flash = require('connect-flash');
const path = require('path');
require('dotenv').config();
const app = express();

const db = mysql.createConnection({
    host: 'c237-adib-mysql.mysql.database.azure.com',
    user: 'c237_026',
    password: 'c237026@2026!',
    database: 'c237_026_team1_gamenight',
    ssl: {
        rejectUnauthorized: false
    }
});

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use(methodOverride('_method'));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 2 } // 2 hour session
}));

app.use(flash());

// Make user + flash messages available in all views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

// Routes 
const authroutes = require('./routes/authroutes');
app.use('/', authroutes);

const gameroutes = require('./routes/gameroutes');
const borrowroutes = require('./routes/borrowroutes');
const searchroutes = require('./routes/searchroutes');

app.use('/games', gameroutes);
app.use('/borrow', borrowroutes);
app.use('/search', searchroutes);

// homepage with data analytics
app.get('/', async (req, res) => {
    try {
        // run all queries in parallel to improve performance
        const [
            [gamesResult],
            [usersResult],
            [borrowsResult],
            [popularResult]
        ] = await Promise.all([
            db.query('SELECT COUNT(*) AS count FROM games'),
            db.query("SELECT COUNT(*) AS count FROM users WHERE role = 'member'"),
            db.query('SELECT COUNT(*) AS count FROM borrow_records'),
            db.query(`
                SELECT g.title, COUNT(br.game_id) AS borrow_count 
                FROM borrow_records br 
                JOIN games g ON br.game_id = g.game_id 
                GROUP BY br.game_id 
                ORDER BY borrow_count DESC 
                LIMIT 1
            `)
        ]);

        // extract most popular game title or set to 'No borrows yet' if no records exist
        const topGame = popularResult.length > 0 ? popularResult[0].title : 'No borrows yet';

        const stats = {
            totalGames: gamesResult[0].count,
            totalMembers: usersResult[0].count,
            totalBorrows: borrowsResult[0].count,
            popularGame: topGame
        };

        res.render('index', { stats });
    } catch (error) { // handle errors
        console.error('Error loading dashboard analytics:', error);
        res.render('index', { 
            stats: { totalGames: 0, totalMembers: 0, totalBorrows: 0, popularGame: 'N/A' } 
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', { message: 'Page not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
