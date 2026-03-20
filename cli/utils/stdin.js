"use strict";

/**
 * Read all data from stdin as a string.
 * Returns null if stdin is a TTY (no piped input).
 */
function readStdin() {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      return resolve(null);
    }
    const chunks = [];
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(chunks.join("")));
    process.stdin.on("error", reject);
  });
}

module.exports = { readStdin };
