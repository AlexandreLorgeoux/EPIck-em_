// Today as a calendar date (UTC), for date-only columns
export const today = () => new Date(new Date().toISOString().slice(0, 10));
