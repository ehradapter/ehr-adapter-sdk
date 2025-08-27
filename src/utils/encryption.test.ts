import { EncryptionUtils, CryptoHelpers, createEncryptionUtils } from './encryption';
import { StructuredLogger } from '../logging/StructuredLogger';

describe('EncryptionUtils', () => {
  let encryptionUtils: EncryptionUtils;
  let logger: StructuredLogger;

  beforeEach(() => {
    logger = new StructuredLogger('info');
    encryptionUtils = new EncryptionUtils(logger);
  });

  describe('constructor and initialization', () => {
    it('should initialize with default options', () => {
      const utils = new EncryptionUtils(logger);
      expect(utils).toBeInstanceOf(EncryptionUtils);
    });

    it('should initialize with custom options', () => {
      const customOptions = {
        algorithm: 'AES-256-GCM' as const,
        keySize: 32,
        ivSize: 16,
        iterations: 50000,
      };
      const utils = new EncryptionUtils(logger, customOptions);
      expect(utils).toBeInstanceOf(EncryptionUtils);
    });
  });

  describe('random byte generation', () => {
    it('should generate secure random bytes', () => {
      const bytes = encryptionUtils.generateRandomBytes(16);
      expect(bytes).toHaveLength(16);
      expect(bytes).toBeInstanceOf(Uint8Array);
    });

    it('should generate different random bytes each time', () => {
      const bytes1 = encryptionUtils.generateRandomBytes(16);
      const bytes2 = encryptionUtils.generateRandomBytes(16);
      expect(bytes1).not.toEqual(bytes2);
    });

    it('should generate random bytes of various lengths', () => {
      const lengths = [1, 8, 16, 32, 64, 128];
      lengths.forEach(length => {
        const bytes = encryptionUtils.generateRandomBytes(length);
        expect(bytes).toHaveLength(length);
      });
    });

    it('should generate salt with default length', () => {
      const salt = encryptionUtils.generateSalt();
      expect(salt).toHaveLength(16);
      expect(salt).toBeInstanceOf(Uint8Array);
    });

    it('should generate salt with custom length', () => {
      const salt = encryptionUtils.generateSalt(32);
      expect(salt).toHaveLength(32);
    });

    it('should generate IV with default length', () => {
      const iv = encryptionUtils.generateIV();
      expect(iv).toHaveLength(12); // Default GCM IV size
    });

    it('should generate IV with custom length', () => {
      const iv = encryptionUtils.generateIV(16);
      expect(iv).toHaveLength(16);
    });
  });

  describe('key derivation', () => {
    it('should derive key from password', async () => {
      const password = 'test-password';
      const salt = encryptionUtils.generateSalt();
      const key = await encryptionUtils.deriveKey(password, salt);

      expect(key).toBeInstanceOf(Uint8Array);
      expect(key).toHaveLength(32); // Default key length
    });

    it('should derive same key for same password and salt', async () => {
      const password = 'test-password';
      const salt = encryptionUtils.generateSalt();

      const key1 = await encryptionUtils.deriveKey(password, salt);
      const key2 = await encryptionUtils.deriveKey(password, salt);

      expect(key1).toEqual(key2);
    });

    it('should derive different keys for different passwords', async () => {
      const salt = encryptionUtils.generateSalt();

      const key1 = await encryptionUtils.deriveKey('password1', salt);
      const key2 = await encryptionUtils.deriveKey('password2', salt);

      expect(key1).not.toEqual(key2);
    });

    it('should derive different keys for different salts', async () => {
      const password = 'test-password';
      const salt1 = encryptionUtils.generateSalt();
      const salt2 = encryptionUtils.generateSalt();

      const key1 = await encryptionUtils.deriveKey(password, salt1);
      const key2 = await encryptionUtils.deriveKey(password, salt2);

      expect(key1).not.toEqual(key2);
    });

    it('should use custom key derivation options', async () => {
      const password = 'test-password';
      const salt = encryptionUtils.generateSalt();
      const options = {
        iterations: 50000,
        keyLength: 16,
      };

      const key = await encryptionUtils.deriveKey(password, salt, options);
      expect(key).toHaveLength(16);
    });
  });

  describe('encryption and decryption', () => {
    it('should encrypt and decrypt string data', async () => {
      const plaintext = 'Hello, World!';
      const key = encryptionUtils.generateRandomBytes(32);

      const encrypted = await encryptionUtils.encrypt(plaintext, key);
      const decrypted = await encryptionUtils.decrypt(encrypted, key);

      expect(new TextDecoder().decode(decrypted)).toBe(plaintext);
    });

    it('should encrypt and decrypt binary data', async () => {
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
      const key = encryptionUtils.generateRandomBytes(32);

      const encrypted = await encryptionUtils.encrypt(plaintext, key);
      const decrypted = await encryptionUtils.decrypt(encrypted, key);

      expect(decrypted).toEqual(plaintext);
    });

    it('should produce different ciphertext for same plaintext', async () => {
      const plaintext = 'Hello, World!';
      const key = encryptionUtils.generateRandomBytes(32);

      const encrypted1 = await encryptionUtils.encrypt(plaintext, key);
      const encrypted2 = await encryptionUtils.encrypt(plaintext, key);

      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should include all required fields in encrypted data', async () => {
      const plaintext = 'test data';
      const key = encryptionUtils.generateRandomBytes(32);

      const encrypted = await encryptionUtils.encrypt(plaintext, key);

      expect(encrypted.algorithm).toBe('AES-256-GCM');
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.tag).toBeDefined();
      expect(typeof encrypted.ciphertext).toBe('string');
      expect(typeof encrypted.iv).toBe('string');
      expect(typeof encrypted.tag).toBe('string');
    });

    it('should fail decryption with wrong key', async () => {
      const plaintext = 'Hello, World!';
      const key1 = encryptionUtils.generateRandomBytes(32);
      const key2 = encryptionUtils.generateRandomBytes(32);

      const encrypted = await encryptionUtils.encrypt(plaintext, key1);

      await expect(encryptionUtils.decrypt(encrypted, key2)).rejects.toThrow('Decryption failed');
    });

    it('should fail decryption with tampered ciphertext', async () => {
      const plaintext = 'Hello, World!';
      const key = encryptionUtils.generateRandomBytes(32);

      const encrypted = await encryptionUtils.encrypt(plaintext, key);
      encrypted.ciphertext = 'tampered-data';

      await expect(encryptionUtils.decrypt(encrypted, key)).rejects.toThrow('Decryption failed');
    });

    it('should fail decryption with tampered tag', async () => {
      const plaintext = 'Hello, World!';
      const key = encryptionUtils.generateRandomBytes(32);

      const encrypted = await encryptionUtils.encrypt(plaintext, key);
      encrypted.tag = 'tampered-tag';

      await expect(encryptionUtils.decrypt(encrypted, key)).rejects.toThrow('Decryption failed');
    });

    it('should handle empty plaintext', async () => {
      const plaintext = '';
      const key = encryptionUtils.generateRandomBytes(32);

      const encrypted = await encryptionUtils.encrypt(plaintext, key);
      const decrypted = await encryptionUtils.decrypt(encrypted, key);

      expect(new TextDecoder().decode(decrypted)).toBe(plaintext);
    });

    it('should handle large plaintext', async () => {
      const plaintext = 'A'.repeat(10000);
      const key = encryptionUtils.generateRandomBytes(32);

      const encrypted = await encryptionUtils.encrypt(plaintext, key);
      const decrypted = await encryptionUtils.decrypt(encrypted, key);

      expect(new TextDecoder().decode(decrypted)).toBe(plaintext);
    });
  });

  describe('password-based encryption', () => {
    it('should encrypt and decrypt with password', async () => {
      const plaintext = 'Secret message';
      const password = 'mypassword';

      const encrypted = await encryptionUtils.encryptWithPassword(plaintext, password);
      const decrypted = await encryptionUtils.decryptWithPassword(encrypted, password);

      expect(decrypted).toBe(plaintext);
    });

    it('should include salt in password-based encryption', async () => {
      const plaintext = 'Secret message';
      const password = 'mypassword';

      const encrypted = await encryptionUtils.encryptWithPassword(plaintext, password);

      expect(encrypted.salt).toBeDefined();
      expect(typeof encrypted.salt).toBe('string');
    });

    it('should fail decryption with wrong password', async () => {
      const plaintext = 'Secret message';
      const password1 = 'password1';
      const password2 = 'password2';

      const encrypted = await encryptionUtils.encryptWithPassword(plaintext, password1);

      await expect(encryptionUtils.decryptWithPassword(encrypted, password2)).rejects.toThrow(
        'Decryption failed'
      );
    });

    it('should fail decryption without salt', async () => {
      const encryptedData = {
        algorithm: 'AES-256-GCM' as const,
        ciphertext: 'test',
        iv: 'test',
        tag: 'test',
      };

      await expect(encryptionUtils.decryptWithPassword(encryptedData, 'password')).rejects.toThrow(
        'Salt is required'
      );
    });

    it('should produce different results for same password', async () => {
      const plaintext = 'Secret message';
      const password = 'mypassword';

      const encrypted1 = await encryptionUtils.encryptWithPassword(plaintext, password);
      const encrypted2 = await encryptionUtils.encryptWithPassword(plaintext, password);

      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    });
  });

  describe('hashing', () => {
    it('should hash string data with SHA-256', async () => {
      const data = 'test data';
      const hash = await encryptionUtils.hash(data);

      expect(hash).toBeInstanceOf(Uint8Array);
      expect(hash.length).toBe(32); // SHA-256 produces 32 bytes
    });

    it('should hash binary data', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const hash = await encryptionUtils.hash(data);

      expect(hash).toBeInstanceOf(Uint8Array);
      expect(hash.length).toBe(32);
    });

    it('should produce same hash for same data', async () => {
      const data = 'test data';
      const hash1 = await encryptionUtils.hash(data);
      const hash2 = await encryptionUtils.hash(data);

      expect(hash1).toEqual(hash2);
    });

    it('should produce different hashes for different data', async () => {
      const hash1 = await encryptionUtils.hash('data1');
      const hash2 = await encryptionUtils.hash('data2');

      expect(hash1).not.toEqual(hash2);
    });

    it('should support different hash algorithms', async () => {
      const data = 'test data';
      const sha256 = await encryptionUtils.hash(data, 'SHA-256');
      const sha512 = await encryptionUtils.hash(data, 'SHA-512');

      expect(sha256.length).toBe(32);
      expect(sha512.length).toBe(64);
      expect(sha256).not.toEqual(sha512);
    });

    it('should handle empty data', async () => {
      const hash = await encryptionUtils.hash('');
      expect(hash).toBeInstanceOf(Uint8Array);
      expect(hash.length).toBe(32);
    });
  });

  describe('HMAC', () => {
    it('should generate HMAC for string data', async () => {
      const data = 'test data';
      const key = encryptionUtils.generateRandomBytes(32);
      const hmac = await encryptionUtils.hmac(data, key);

      expect(hmac).toBeInstanceOf(Uint8Array);
      expect(hmac.length).toBe(32); // SHA-256 HMAC
    });

    it('should generate HMAC for binary data', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const key = encryptionUtils.generateRandomBytes(32);
      const hmac = await encryptionUtils.hmac(data, key);

      expect(hmac).toBeInstanceOf(Uint8Array);
      expect(hmac.length).toBe(32);
    });

    it('should verify valid HMAC', async () => {
      const data = 'test data';
      const key = encryptionUtils.generateRandomBytes(32);
      const hmac = await encryptionUtils.hmac(data, key);
      const isValid = await encryptionUtils.verifyHmac(data, key, hmac);

      expect(isValid).toBe(true);
    });

    it('should reject invalid HMAC', async () => {
      const data = 'test data';
      const key = encryptionUtils.generateRandomBytes(32);
      const invalidHmac = encryptionUtils.generateRandomBytes(32);
      const isValid = await encryptionUtils.verifyHmac(data, key, invalidHmac);

      expect(isValid).toBe(false);
    });

    it('should reject HMAC with wrong key', async () => {
      const data = 'test data';
      const key1 = encryptionUtils.generateRandomBytes(32);
      const key2 = encryptionUtils.generateRandomBytes(32);
      const hmac = await encryptionUtils.hmac(data, key1);
      const isValid = await encryptionUtils.verifyHmac(data, key2, hmac);

      expect(isValid).toBe(false);
    });

    it('should reject HMAC with tampered data', async () => {
      const data = 'test data';
      const tamperedData = 'tampered data';
      const key = encryptionUtils.generateRandomBytes(32);
      const hmac = await encryptionUtils.hmac(data, key);
      const isValid = await encryptionUtils.verifyHmac(tamperedData, key, hmac);

      expect(isValid).toBe(false);
    });

    it('should support different HMAC algorithms', async () => {
      const data = 'test data';
      const key = encryptionUtils.generateRandomBytes(32);

      const hmac256 = await encryptionUtils.hmac(data, key, 'SHA-256');
      const hmac512 = await encryptionUtils.hmac(data, key, 'SHA-512');

      expect(hmac256.length).toBe(32);
      expect(hmac512.length).toBe(64);
      expect(hmac256).not.toEqual(hmac512);
    });
  });

  describe('utility functions', () => {
    it('should generate secure password with default options', () => {
      const password = encryptionUtils.generatePassword();

      expect(password).toHaveLength(32);
      expect(typeof password).toBe('string');
      expect(/[a-z]/.test(password)).toBe(true);
      expect(/[A-Z]/.test(password)).toBe(true);
      expect(/[0-9]/.test(password)).toBe(true);
    });

    it('should generate password with custom length', () => {
      const password = encryptionUtils.generatePassword(16);
      expect(password).toHaveLength(16);
    });

    it('should generate password without symbols', () => {
      const password = encryptionUtils.generatePassword(32, false);
      expect(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)).toBe(false);
    });

    it('should generate different passwords each time', () => {
      const password1 = encryptionUtils.generatePassword();
      const password2 = encryptionUtils.generatePassword();
      expect(password1).not.toBe(password2);
    });

    it('should generate valid UUID v4', () => {
      const uuid = encryptionUtils.generateUUID();

      expect(typeof uuid).toBe('string');
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should generate different UUIDs each time', () => {
      const uuid1 = encryptionUtils.generateUUID();
      const uuid2 = encryptionUtils.generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('error handling', () => {
    it('should handle encryption errors gracefully', async () => {
      const plaintext = 'test';
      const invalidKey = new Uint8Array(16); // Wrong key size

      await expect(encryptionUtils.encrypt(plaintext, invalidKey)).rejects.toThrow(
        'Encryption failed'
      );
    });

    it('should handle decryption errors gracefully', async () => {
      const invalidEncryptedData = {
        algorithm: 'AES-256-GCM' as const,
        ciphertext: 'invalid-base64',
        iv: 'invalid-base64',
        tag: 'invalid-base64',
      };
      const key = encryptionUtils.generateRandomBytes(32);

      await expect(encryptionUtils.decrypt(invalidEncryptedData, key)).rejects.toThrow(
        'Decryption failed'
      );
    });
  });
});

describe('CryptoHelpers', () => {
  describe('secure string comparison', () => {
    it('should return true for identical strings', () => {
      expect(CryptoHelpers.secureCompare('hello', 'hello')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(CryptoHelpers.secureCompare('hello', 'world')).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      expect(CryptoHelpers.secureCompare('hello', 'hello world')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(CryptoHelpers.secureCompare('', '')).toBe(true);
      expect(CryptoHelpers.secureCompare('', 'hello')).toBe(false);
    });

    it('should handle special characters', () => {
      const str = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      expect(CryptoHelpers.secureCompare(str, str)).toBe(true);
    });

    it('should handle unicode characters', () => {
      const str = '🔐🔑🛡️';
      expect(CryptoHelpers.secureCompare(str, str)).toBe(true);
    });
  });

  describe('random string generation', () => {
    it('should generate string of specified length', () => {
      const str = CryptoHelpers.generateRandomString(10);
      expect(str).toHaveLength(10);
      expect(typeof str).toBe('string');
    });

    it('should generate different strings each time', () => {
      const str1 = CryptoHelpers.generateRandomString(10);
      const str2 = CryptoHelpers.generateRandomString(10);
      expect(str1).not.toBe(str2);
    });

    it('should use custom charset', () => {
      const charset = '01';
      const str = CryptoHelpers.generateRandomString(10, charset);
      expect(str).toHaveLength(10);
      expect(/^[01]+$/.test(str)).toBe(true);
    });

    it('should handle single character charset', () => {
      const str = CryptoHelpers.generateRandomString(5, 'A');
      expect(str).toBe('AAAAA');
    });

    it('should handle zero length', () => {
      const str = CryptoHelpers.generateRandomString(0);
      expect(str).toBe('');
    });
  });

  describe('password hashing and verification', () => {
    it('should hash password and return hash and salt', async () => {
      const password = 'mypassword';
      const result = await CryptoHelpers.hashPassword(password);

      expect(result.hash).toBeDefined();
      expect(result.salt).toBeDefined();
      expect(typeof result.hash).toBe('string');
      expect(typeof result.salt).toBe('string');
    });

    it('should verify correct password', async () => {
      const password = 'mypassword';
      const { hash, salt } = await CryptoHelpers.hashPassword(password);
      const isValid = await CryptoHelpers.verifyPassword(password, hash, salt);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'mypassword';
      const wrongPassword = 'wrongpassword';
      const { hash, salt } = await CryptoHelpers.hashPassword(password);
      const isValid = await CryptoHelpers.verifyPassword(wrongPassword, hash, salt);

      expect(isValid).toBe(false);
    });

    it('should use provided salt', async () => {
      const password = 'mypassword';
      const salt = new Uint8Array(16).fill(1);
      const result1 = await CryptoHelpers.hashPassword(password, salt);
      const result2 = await CryptoHelpers.hashPassword(password, salt);

      expect(result1.hash).toBe(result2.hash);
      expect(result1.salt).toBe(result2.salt);
    });

    it('should generate different hashes for different passwords', async () => {
      const result1 = await CryptoHelpers.hashPassword('password1');
      const result2 = await CryptoHelpers.hashPassword('password2');

      expect(result1.hash).not.toBe(result2.hash);
    });

    it('should generate different salts for same password', async () => {
      const result1 = await CryptoHelpers.hashPassword('password');
      const result2 = await CryptoHelpers.hashPassword('password');

      expect(result1.salt).not.toBe(result2.salt);
      expect(result1.hash).not.toBe(result2.hash);
    });

    it('should handle empty password', async () => {
      const { hash, salt } = await CryptoHelpers.hashPassword('');
      const isValid = await CryptoHelpers.verifyPassword('', hash, salt);

      expect(isValid).toBe(true);
    });

    it('should handle long passwords', async () => {
      const longPassword = 'A'.repeat(1000);
      const { hash, salt } = await CryptoHelpers.hashPassword(longPassword);
      const isValid = await CryptoHelpers.verifyPassword(longPassword, hash, salt);

      expect(isValid).toBe(true);
    });

    it('should handle special characters in password', async () => {
      const password = '!@#$%^&*()_+-=[]{}|;:,.<>?🔐🔑';
      const { hash, salt } = await CryptoHelpers.hashPassword(password);
      const isValid = await CryptoHelpers.verifyPassword(password, hash, salt);

      expect(isValid).toBe(true);
    });
  });
});

describe('createEncryptionUtils factory', () => {
  it('should create EncryptionUtils instance', () => {
    const logger = new StructuredLogger('info');
    const utils = createEncryptionUtils(logger);

    expect(utils).toBeInstanceOf(EncryptionUtils);
  });

  it('should create EncryptionUtils with custom options', () => {
    const logger = new StructuredLogger('info');
    const options = { keySize: 16, ivSize: 8 };
    const utils = createEncryptionUtils(logger, options);

    expect(utils).toBeInstanceOf(EncryptionUtils);
  });
});
