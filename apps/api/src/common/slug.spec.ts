import { describe, expect, it } from '@jest/globals';
import { firstFreeSlug, slugify } from './slug.js';

describe('slugify', () => {
  it.each([
    ["Coupe d'Hiver 2026 !", 'coupe-d-hiver-2026'],
    ['  Évènement   Spécial  ', 'evenement-special'],
    ['Rocket League', 'rocket-league'],
    ['---', ''],
  ])('turns %j into %j', (input, slug) => {
    expect(slugify(input)).toBe(slug);
  });

  it('keeps slugs short without a trailing dash', () => {
    const slug = slugify(`${'a'.repeat(59)} bcd`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('firstFreeSlug', () => {
  it('keeps the base when it is free', () => {
    expect(firstFreeSlug('cup', ['other'])).toBe('cup');
  });

  it('adds the first free number otherwise', () => {
    expect(firstFreeSlug('cup', ['cup'])).toBe('cup-2');
    expect(firstFreeSlug('cup', ['cup', 'cup-2', 'cup-4'])).toBe('cup-3');
  });
});
