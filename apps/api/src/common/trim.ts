import { Transform } from 'class-transformer';

// Trims string input so " Alpha " and "Alpha" are the same name
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
