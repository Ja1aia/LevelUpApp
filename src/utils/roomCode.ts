/**
 * Room Code Generator
 * Generate random 6-character room codes for multiplayer games
 */

/**
 * Generate a random 6-character room code
 * Format: ABC123 (3 uppercase letters + 3 digits)
 * Example: XYZ789, QWE456, etc.
 */
export function generateRoomCode(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';

  let code = '';

  // Generate 3 random letters
  for (let i = 0; i < 3; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  // Generate 3 random numbers
  for (let i = 0; i < 3; i++) {
    code += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }

  return code;
}

/**
 * Validate room code format
 * Must be exactly 6 characters: 3 letters + 3 digits
 */
export function isValidRoomCode(code: string): boolean {
  if (code.length !== 6) return false;

  const pattern = /^[A-Z]{3}[0-9]{3}$/;
  return pattern.test(code.toUpperCase());
}

/**
 * Format room code for display
 * Example: "abc123" -> "ABC123"
 */
export function formatRoomCode(code: string): string {
  return code.toUpperCase().trim();
}
