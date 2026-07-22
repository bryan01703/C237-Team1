const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.send('Borrow routes placeholder');
});

module.exports = router;