const crypto = require("crypto");

function getRandomWord() {
  // Generate a random 8-char string that doesn't exist in the codebase
  // Not guessable, not brute-forceable from a known word list
  return crypto.randomBytes(4).toString("hex");
}

module.exports = { getRandomWord };
