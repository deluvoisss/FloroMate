const path = require('path');
const router = require('express').Router();

// Здесь укажите путь к вашему index.js
router.get('/index.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../../src/index.js'));
});

module.exports = router;