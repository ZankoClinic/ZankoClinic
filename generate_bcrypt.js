// Run this file with: node generate_bcrypt.js
const bcrypt = require('bcrypt');

const password = 'admin123';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, function (err, hash) {
    if (err) throw err;
    console.log('Bcrypt hash for "admin123":', hash);
});
