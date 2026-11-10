import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddMemberDto } from './add-member.dto.js';
import { CreateTeamDto } from './create-team.dto.js';
import { UpdateTeamDto } from './update-team.dto.js';

// Same steps as the global ValidationPipe: transform, then validate
const errorsOf = async <T extends object>(dto: new () => T, body: object) => {
  const errors = await validate(plainToInstance(dto, body));
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
};

describe('CreateTeamDto', () => {
  it('accepts a name with an optional tag', async () => {
    expect(await errorsOf(CreateTeamDto, { name: 'Alpha' })).toEqual([]);
    expect(
      await errorsOf(CreateTeamDto, { name: 'Alpha', tag: 'ALP' }),
    ).toEqual([]);
  });

  it('explains the length limits', async () => {
    expect(
      await errorsOf(CreateTeamDto, { name: ' ', tag: 'TOOLONGTAG' }),
    ).toEqual([
      'name must be between 2 and 64 characters',
      'tag must be between 1 and 8 characters',
    ]);
  });
});

describe('UpdateTeamDto', () => {
  it('accepts null to remove the tag or the captain', async () => {
    expect(
      await errorsOf(UpdateTeamDto, { tag: null, captainPlayerId: null }),
    ).toEqual([]);
  });

  it('rejects a malformed captain id', async () => {
    expect(await errorsOf(UpdateTeamDto, { captainPlayerId: 'abc' })).toEqual([
      'captainPlayerId must be a valid UUID or null',
    ]);
  });
});

describe('AddMemberDto', () => {
  it('requires a player and accepts an optional role and substitute flag', async () => {
    expect(
      await errorsOf(AddMemberDto, {
        playerId: '0190a7c0-1234-7abc-8def-0123456789ab',
        isSubstitute: true,
        role: 'AWPer',
      }),
    ).toEqual([]);
    expect(await errorsOf(AddMemberDto, {})).toEqual([
      'playerId must be a valid UUID',
    ]);
  });

  it('does not take "yes" for a boolean', async () => {
    expect(
      await errorsOf(AddMemberDto, {
        playerId: '0190a7c0-1234-7abc-8def-0123456789ab',
        isSubstitute: 'yes',
      }),
    ).toEqual(['isSubstitute must be true or false']);
  });
});
