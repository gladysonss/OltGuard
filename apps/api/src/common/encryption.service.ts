import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * Criptografa credenciais de OLT (community SNMP, senha SSH) antes de persistir.
 * Chave vem de ENCRYPTION_KEY (32 bytes em hex) - nunca comitar essa chave.
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const hexKey = config.get<string>('ENCRYPTION_KEY');
    if (!hexKey || Buffer.from(hexKey, 'hex').length !== 32) {
      throw new Error('ENCRYPTION_KEY deve ser uma string hex de 32 bytes (64 caracteres)');
    }
    this.key = Buffer.from(hexKey, 'hex');
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv, authTag, encrypted].map((buf) => buf.toString('hex')).join(':');
  }

  decrypt(cipherText: string): string {
    const [ivHex, authTagHex, encryptedHex] = cipherText.split(':');
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}
