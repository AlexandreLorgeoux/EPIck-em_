import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import type { Algorithm } from '@node-rs/argon2';

// argon2id with the library defaults (19 MiB, 2 passes), the OWASP baseline.
// Algorithm is a const enum, which isolatedModules cannot import as a value.
const ARGON2ID = 2 as Algorithm;

@Injectable()
export class PasswordService {
  private dummyHash?: Promise<string>;

  hash(password: string) {
    return hash(password, { algorithm: ARGON2ID });
  }

  verify(passwordHash: string, password: string) {
    return verify(passwordHash, password);
  }

  // Runs a real verification when the account does not exist, so a failed
  // login takes the same time either way and does not reveal which emails
  // have an account
  async verifyAgainstNothing(password: string) {
    this.dummyHash ??= this.hash('not-a-real-password');
    await verify(await this.dummyHash, password);
    return false;
  }
}
