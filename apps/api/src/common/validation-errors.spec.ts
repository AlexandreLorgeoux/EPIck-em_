import { describe, expect, it } from '@jest/globals';
import type { ValidationError } from 'class-validator';
import { errorsByField, validationException } from './validation-errors.js';

const error = (
  property: string,
  constraints?: Record<string, string>,
  children: ValidationError[] = [],
): ValidationError => ({ property, constraints, children });

describe('errorsByField', () => {
  it('groups messages under the field they belong to', () => {
    expect(
      errorsByField([
        error('handle', {
          isLength: 'handle must be between 2 and 32 characters',
        }),
        error('nickname', {
          whitelistValidation: 'property nickname should not exist',
        }),
      ]),
    ).toEqual({
      handle: ['handle must be between 2 and 32 characters'],
      nickname: ['property nickname should not exist'],
    });
  });

  it('names nested fields with dots', () => {
    expect(
      errorsByField([
        error('address', undefined, [
          error('city', { isString: 'city must be a string' }),
        ]),
      ]),
    ).toEqual({ 'address.city': ['city must be a string'] });
  });
});

describe('validationException', () => {
  it('keeps the flat message list and adds the errors per field', () => {
    const body = validationException([
      error('email', { isEmail: 'email must be a valid email address' }),
      error('password', {
        isString: 'password must be a string',
        isLength: 'password must be between 8 and 128 characters',
      }),
    ]).getResponse();
    expect(body).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: [
        'email must be a valid email address',
        'password must be a string',
        'password must be between 8 and 128 characters',
      ],
      errors: {
        email: ['email must be a valid email address'],
        password: [
          'password must be a string',
          'password must be between 8 and 128 characters',
        ],
      },
    });
  });
});
