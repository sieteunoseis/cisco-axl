const readline = require("readline");
const { getRandomWord } = require("./wordlist.js");

function checkWriteAllowed(clusterConfig, globalOpts = {}) {
  const readOnly = clusterConfig?.readOnly || globalOpts.readOnly;
  if (!readOnly) return Promise.resolve(true);

  if (!process.stdin.isTTY) {
    throw new Error(
      "This cluster is configured as read-only. " +
      "Interactive TTY required for write confirmation. " +
      "Change config with: cisco-axl config update <name> --no-read-only"
    );
  }

  const word = getRandomWord();
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });

  return new Promise((resolve, reject) => {
    rl.question(
      `\n⚠ This cluster is configured as read-only.\nTo proceed, type "${word}" to confirm: `,
      (answer) => {
        rl.close();
        if (answer.trim().toLowerCase() === word.toLowerCase()) {
          resolve({ confirmed: true, word });
        } else {
          reject(new Error("Confirmation failed. Write operation cancelled."));
        }
      }
    );
  });
}

module.exports = { checkWriteAllowed };
