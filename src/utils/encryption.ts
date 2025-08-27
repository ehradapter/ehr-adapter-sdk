import { LoggerInterface } from '../logging/LoggerInterface';
import * as crypto from 'crypto';

/**
 * Encryption algorithm types
 */
export type EncryptionAlgorithm = 'AES-256-GCM' | 'AES-256-CBC' | 'ChaCha20-Poly1305';

/**
 * Hash algorithm types
 */
export type HashAlgorithm = 'SHA-256' | 'SHA-512' | 'BLAKE2b';

/**
 * Key derivation function types
 */
export type KDFAlgorithm = 'PBKDF2' | 'scrypt' | 'Argon2';

/**
 * Encryption options
 */
export interface EncryptionOptions {
  algorithm?: EncryptionAlgorithm;
  keySize?: number;
  ivSize?: number;
  tagSize?: number;
  iterations?: number;
  salt?: Uint8Array;
}

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  algorithm: EncryptionAlgorithm;
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded
  tag?: string; // Base64 encoded (for AEAD modes)
  salt?: string; // Base64 encoded
  metadata?: Record<string, any>;
}

/**
 * Key derivation options
 */
export interface KeyDerivationOptions {
  algorithm?: KDFAlgorithm;
  iterations?: number;
  keyLength?: number;
  salt?: Uint8Array;
  memory?: number; // For Argon2
  parallelism?: number; // For Argon2
}

/**
 * Encryption utility class
 */
export class EncryptionUtils {
  private logger: LoggerInterface;
  private defaultOptions: Required<EncryptionOptions>;

  constructor(logger: LoggerInterface, defaultOptions: EncryptionOptions = {}) {
    this.logger = logger;
    this.defaultOptions = {
      algorithm: 'AES-256-GCM',
      keySize: 32, // 256 bits
      ivSize: 12, // 96 bits for GCM
      tagSize: 16, // 128 bits
      iterations: 100000,
      salt: new Uint8Array(16),
      ...defaultOptions,
    };
  }

  /**
   * Generate cryptographically secure random bytes
   */
  generateRandomBytes(length: number): Uint8Array {
    return new Uint8Array(crypto.randomBytes(length));
  }

  /**
   * Generate a random salt
   */
  generateSalt(length = 16): Uint8Array {
    return this.generateRandomBytes(length);
  }

  /**
   * Generate a random IV
   */
  generateIV(length?: number): Uint8Array {
    const ivLength = length || this.defaultOptions.ivSize;
    return this.generateRandomBytes(ivLength);
  }

  /**
   * Derive key from password using PBKDF2
   */
  async deriveKey(
    password: string,
    salt: Uint8Array,
    options: KeyDerivationOptions = {}
  ): Promise<Uint8Array> {
    const opts = {
      algorithm: 'PBKDF2' as KDFAlgorithm,
      iterations: 100000,
      keyLength: 32,
      ...options,
    };

    this.logger.debug('Deriving key', {
      algorithm: opts.algorithm,
      iterations: opts.iterations,
      keyLength: opts.keyLength,
      saltLength: salt.length,
    });

    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        password,
        salt,
        opts.iterations,
        opts.keyLength,
        'sha256',
        (err: Error | null, derivedKey: Buffer) => {
          if (err) {
            reject(err);
          } else {
            resolve(new Uint8Array(derivedKey));
          }
        }
      );
    });
  }

  /**
   * Encrypt data using AES-GCM
   */
  async encrypt(
    plaintext: string | Uint8Array,
    key: Uint8Array,
    options: EncryptionOptions = {}
  ): Promise<EncryptedData> {
    const opts = { ...this.defaultOptions, ...options };
    const iv = this.generateIV(opts.ivSize);
    const data = typeof plaintext === 'string' ? new TextEncoder().encode(plaintext) : plaintext;

    this.logger.debug('Encrypting data', {
      algorithm: opts.algorithm,
      dataLength: data.length,
      keyLength: key.length,
      ivLength: iv.length,
    });

    try {
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

      let encrypted = cipher.update(data);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      const tag = cipher.getAuthTag();

      return {
        algorithm: opts.algorithm,
        ciphertext: encrypted.toString('base64'),
        iv: Buffer.from(iv).toString('base64'),
        tag: tag.toString('base64'),
      };
    } catch (error) {
      this.logger.error('Encryption failed', { error });
      throw new Error(`Encryption failed: ${error}`);
    }
  }

  /**
   * Decrypt data using AES-GCM
   */
  async decrypt(encryptedData: EncryptedData, key: Uint8Array): Promise<Uint8Array> {
    this.logger.debug('Decrypting data', {
      algorithm: encryptedData.algorithm,
      keyLength: key.length,
    });

    try {
      const ciphertext = this.base64ToArrayBuffer(encryptedData.ciphertext);
      const iv = this.base64ToArrayBuffer(encryptedData.iv);
      const tag = encryptedData.tag
        ? this.base64ToArrayBuffer(encryptedData.tag)
        : new Uint8Array(0);

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv));
      decipher.setAuthTag(Buffer.from(tag));

      let decrypted = decipher.update(Buffer.from(ciphertext));
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return new Uint8Array(decrypted);
    } catch (error) {
      this.logger.error('Decryption failed', { error });
      throw new Error(`Decryption failed: ${error}`);
    }
  }

  /**
   * Encrypt string with password
   */
  async encryptWithPassword(
    plaintext: string,
    password: string,
    options: EncryptionOptions = {}
  ): Promise<EncryptedData> {
    const salt = this.generateSalt();
    const key = await this.deriveKey(password, salt);
    const encrypted = await this.encrypt(plaintext, key, options);

    return {
      ...encrypted,
      salt: this.arrayBufferToBase64(salt),
    };
  }

  /**
   * Decrypt string with password
   */
  async decryptWithPassword(encryptedData: EncryptedData, password: string): Promise<string> {
    if (!encryptedData.salt) {
      throw new Error('Salt is required for password-based decryption');
    }

    const salt = new Uint8Array(this.base64ToArrayBuffer(encryptedData.salt));
    const key = await this.deriveKey(password, salt);
    const decrypted = await this.decrypt(encryptedData, key);

    return new TextDecoder().decode(decrypted);
  }

  /**
   * Hash data using SHA-256
   */
  async hash(data: string | Uint8Array, algorithm: HashAlgorithm = 'SHA-256'): Promise<Uint8Array> {
    const input = typeof data === 'string' ? new TextEncoder().encode(data) : data;

    this.logger.debug('Hashing data', {
      algorithm,
      dataLength: input.length,
    });

    const hash = crypto.createHash(algorithm.toLowerCase().replace('-', ''));
    hash.update(input);
    return new Uint8Array(hash.digest());
  }

  /**
   * Generate HMAC
   */
  async hmac(
    data: string | Uint8Array,
    key: Uint8Array,
    algorithm: HashAlgorithm = 'SHA-256'
  ): Promise<Uint8Array> {
    const input = typeof data === 'string' ? new TextEncoder().encode(data) : data;

    this.logger.debug('Generating HMAC', {
      algorithm,
      dataLength: input.length,
      keyLength: key.length,
    });

    const hmac = crypto.createHmac(algorithm.toLowerCase().replace('-', ''), key);
    hmac.update(input);
    return new Uint8Array(hmac.digest());
  }

  /**
   * Verify HMAC
   */
  async verifyHmac(
    data: string | Uint8Array,
    key: Uint8Array,
    signature: Uint8Array,
    algorithm: HashAlgorithm = 'SHA-256'
  ): Promise<boolean> {
    const expectedSignature = await this.hmac(data, key, algorithm);
    return this.constantTimeEquals(signature, expectedSignature);
  }

  /**
   * Constant-time comparison to prevent timing attacks
   */
  private constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= (a[i] || 0) ^ (b[i] || 0);
    }

    return result === 0;
  }

  /**
   * Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    return Buffer.from(bytes).toString('base64');
  }

  /**
   * Convert Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = Buffer.from(base64, 'base64');
    return binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength);
  }

  /**
   * Generate secure random password
   */
  generatePassword(length = 32, includeSymbols = true): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let charset = lowercase + uppercase + numbers;
    if (includeSymbols) {
      charset += symbols;
    }

    const randomBytes = this.generateRandomBytes(length);
    let password = '';

    for (let i = 0; i < length; i++) {
      password += charset[(randomBytes[i] || 0) % charset.length];
    }

    return password;
  }

  /**
   * Generate UUID v4
   */
  generateUUID(): string {
    const randomBytes = this.generateRandomBytes(16);

    // Set version (4) and variant bits
    randomBytes[6] = ((randomBytes[6] || 0) & 0x0f) | 0x40;
    randomBytes[8] = ((randomBytes[8] || 0) & 0x3f) | 0x80;

    const hex = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join('-');
  }
}

/**
 * Create encryption utils instance
 */
export function createEncryptionUtils(
  logger: LoggerInterface,
  options?: EncryptionOptions
): EncryptionUtils {
  return new EncryptionUtils(logger, options);
}

/**
 * Utility functions for common encryption tasks
 */
export class CryptoHelpers {
  /**
   * Securely compare two strings
   */
  static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  /**
   * Generate a random string
   */
  static generateRandomString(length: number, charset?: string): string {
    const chars = charset || 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomBytes = new EncryptionUtils(console as any).generateRandomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[(randomBytes[i] || 0) % chars.length];
    }
    return result;
  }

  /**
   * Hash a password using PBKDF2
   */
  static async hashPassword(
    password: string,
    salt?: Uint8Array
  ): Promise<{ hash: string; salt: string }> {
    const saltBuffer = salt || new EncryptionUtils(console as any).generateSalt();
    const key = await new EncryptionUtils(console as any).deriveKey(password, saltBuffer);
    return {
      hash: Buffer.from(key).toString('hex'),
      salt: Buffer.from(saltBuffer).toString('hex'),
    };
  }

  /**
   * Verify a password against a hash
   */
  static async verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
    const saltBuffer = new Uint8Array(Buffer.from(salt, 'hex'));
    const key = await new EncryptionUtils(console as any).deriveKey(password, saltBuffer);
    const hashBuffer = Buffer.from(hash, 'hex');
    return this.secureCompare(Buffer.from(key).toString('hex'), hashBuffer.toString('hex'));
  }
}
