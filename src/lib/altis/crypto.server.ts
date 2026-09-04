import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret =
    process.env.APP_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "altis-default-secret-key-must-be-configured";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Chiffre une chaîne en AES-256-GCM (avec IV aléatoire et tag d'authentification).
 * Format de sortie : iv_hex:tag_hex:ciphertext_hex
 */
export function encryptText(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Déchiffre une chaîne chiffrée par encryptText.
 */
export function decryptText(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Format de payload chiffré invalide");
  }

  const [ivHex, tagHex, encryptedHex] = parts;
  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error("Composants de chiffrement manquants");
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export interface OAuthStatePayload {
  organizationId: string;
  nonce: string;
  createdAt: number;
}

/**
 * Crée un jeton d'état (state) signé et chiffré pour sécuriser le flux OAuth 2.0 (anti-CSRF).
 */
export function createOAuthState(organizationId: string): string {
  const payload: OAuthStatePayload = {
    organizationId,
    nonce: crypto.randomBytes(16).toString("hex"),
    createdAt: Date.now(),
  };
  return encryptText(JSON.stringify(payload));
}

/**
 * Valide et déchiffre un jeton d'état OAuth 2.0.
 * Vérifie que le jeton n'a pas expiré (valable 15 minutes max).
 */
export function verifyOAuthState(state: string): OAuthStatePayload | null {
  try {
    const raw = decryptText(state);
    const parsed = JSON.parse(raw) as OAuthStatePayload;
    const now = Date.now();
    // 15 minutes maximum de validité
    if (now - parsed.createdAt > 15 * 60 * 1000) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
