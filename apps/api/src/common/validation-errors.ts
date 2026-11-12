import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

// Flattens class-validator errors into "field" -> messages, with nested
// fields joined by dots ("address.city"), so a form can show each message
// next to its input
export function errorsByField(
  errors: ValidationError[],
  parent = '',
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const error of errors) {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const messages = Object.values(error.constraints ?? {});
    if (messages.length) result[field] = messages;
    Object.assign(result, errorsByField(error.children ?? [], field));
  }
  return result;
}

// 400 body: `message` keeps the flat list for display, `errors` adds the
// same messages grouped by field
export const validationException = (errors: ValidationError[]) => {
  const byField = errorsByField(errors);
  return new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message: Object.values(byField).flat(),
    errors: byField,
  });
};
