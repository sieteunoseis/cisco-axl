"use strict";

/**
 * Format data using TOON (Token-Oriented Object Notation).
 * Token-efficient encoding for LLM prompts.
 * Returns a Promise<string> because @toon-format/toon is ESM-only.
 * @param {object|Array} data
 * @returns {Promise<string>}
 */
async function formatToon(data) {
  const { encode } = await import("@toon-format/toon");
  return encode(data);
}

module.exports = { formatToon };
