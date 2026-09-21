import crypto from "crypto";

const PASSWORD_ALPHABET = {
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  lower: "abcdefghijkmnopqrstuvwxyz",
  digit: "23456789",
  symbol: "!@#$%*?",
};

function pick(charset: string): string {
  return charset[crypto.randomInt(charset.length)];
}

/**
 * Random temporary password for admin-created accounts. Always contains an upper-case letter,
 * a lower-case letter, a digit and a symbol so it passes the password policy, and is unique per
 * account (accounts are also forced to change it on first sign-in).
 */
export function generateTemporaryPassword(length = 12): string {
  const all = Object.values(PASSWORD_ALPHABET).join("");
  const chars = [
    pick(PASSWORD_ALPHABET.upper),
    pick(PASSWORD_ALPHABET.lower),
    pick(PASSWORD_ALPHABET.digit),
    pick(PASSWORD_ALPHABET.symbol),
  ];
  while (chars.length < length) chars.push(pick(all));

  // Fisher–Yates shuffle so the guaranteed characters are not always up front.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export function generateOpaqueToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/** Session and reset tokens are stored hashed so a database read never yields a usable token. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
