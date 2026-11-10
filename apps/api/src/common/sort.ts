// Case-insensitive alphabetical order. The database collation sorts every
// uppercase letter before lowercase ones, which is not what people expect.
export const byText =
  <T>(key: (item: T) => string) =>
  (a: T, b: T) =>
    key(a).localeCompare(key(b), 'en', { sensitivity: 'base' });
