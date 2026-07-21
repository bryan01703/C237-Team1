// this function just checks if the user is logged in
const { ADMIN } = require('../config/roles');

function isLoggedIn(req, res, next) {
    if (req.session.user) return next();
    req.flash('error', 'Please log in to continue');
    res.redirect('/login');
}

function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === ADMIN) return next();
    res.status(403).render('error', { message: 'Access denied — admin only' });
}

module.exports = { isLoggedIn, isAdmin };