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
    secret: 'c237-team1-session-secret',
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
const reviewroutes = require('./routes/reviewroutes');
const wishlistroutes = require('./routes/wishlistroutes');

app.use('/games', gameroutes);
app.use('/borrow', borrowroutes);
app.use('/waitlist', borrowroutes);
app.use('/search', searchroutes);
// Mount Review CRUD routes, for example POST /reviews/games/:gameId.
app.use('/reviews', reviewroutes);
app.use('/wishlist', wishlistroutes);


// 404 handler
app.use((req, res) => {
    res.status(404).render('error', { message: 'Page not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

app.get('/search', (req, res) => {
    res.render('search', { games: [], query: req.query.q || '' });
});
