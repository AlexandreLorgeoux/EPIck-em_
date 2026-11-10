import { describe, expect, it } from '@jest/globals';
import { byText } from './sort.js';

const sortNames = (names: string[]) =>
  [...names].sort(byText((n: string) => n));

describe('byText', () => {
  it('ignores case, unlike the database collation', () => {
    expect(sortNames(['Zywoo', 'apEX', 'Bravo'])).toEqual([
      'apEX',
      'Bravo',
      'Zywoo',
    ]);
  });

  it('sorts accented letters with their base letter', () => {
    expect(sortNames(['Zeta', 'Élan', 'eagle'])).toEqual([
      'eagle',
      'Élan',
      'Zeta',
    ]);
  });

  it('reads the value through the key function', () => {
    const teams = [{ name: 'beta' }, { name: 'Alpha' }];
    expect(teams.sort(byText((t) => t.name)).map((t) => t.name)).toEqual([
      'Alpha',
      'beta',
    ]);
  });
});
