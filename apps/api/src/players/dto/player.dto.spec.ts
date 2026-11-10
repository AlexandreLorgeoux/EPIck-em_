import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePlayerDto } from './create-player.dto.js';
import { UpdatePlayerDto } from './update-player.dto.js';

// Same steps as the global ValidationPipe: transform, then validate
const errorsOf = async <T extends object>(dto: new () => T, body: object) => {
  const errors = await validate(plainToInstance(dto, body));
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
};

describe('CreatePlayerDto', () => {
  it('accepts a handle with an optional account link', async () => {
    expect(await errorsOf(CreatePlayerDto, { handle: 'Zywoo' })).toEqual([]);
    expect(
      await errorsOf(CreatePlayerDto, {
        handle: 'Zywoo',
        userId: '0190a7c0-1234-7abc-8def-0123456789ab',
      }),
    ).toEqual([]);
  });

  it('measures the handle after trimming', async () => {
    expect(await errorsOf(CreatePlayerDto, { handle: '  a  ' })).toEqual([
      'handle must be between 2 and 32 characters',
    ]);
  });

  it('requires a handle', async () => {
    expect(await errorsOf(CreatePlayerDto, {})).toContain(
      'handle must be a string',
    );
  });

  it('rejects a malformed userId', async () => {
    expect(
      await errorsOf(CreatePlayerDto, { handle: 'Zywoo', userId: '12' }),
    ).toEqual(['userId must be a valid UUID']);
  });
});

describe('UpdatePlayerDto', () => {
  it('accepts an empty update and null to unlink the account', async () => {
    expect(await errorsOf(UpdatePlayerDto, {})).toEqual([]);
    expect(await errorsOf(UpdatePlayerDto, { userId: null })).toEqual([]);
  });
});
