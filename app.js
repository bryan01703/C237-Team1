const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const flash = require('connect-flash');
require('dotenv').config();

const app = express();

// View engine
app.set('view engine', 'ejs');

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
const authRoutes = require('./routes/authRoutes');
app.use('/', authRoutes);

const gameroutes = require('./routes/gameroutes');
const borrowroutes = require('./routes/borrowroutes');
const searchroutes = require('./routes/searchroutes');


app.use('/games', gameroutes);
app.use('/borrow', borrowroutes);
app.use('/search', searchroutes);

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', { message: 'Page not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});