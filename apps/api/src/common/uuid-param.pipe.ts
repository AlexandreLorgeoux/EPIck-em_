import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';

// Route ids are UUIDs: reject anything else before it reaches the database
export const uuidParam = (name = 'id') =>
  new ParseUUIDPipe({
    exceptionFactory: () =>
      new BadRequestException(`${name} must be a valid UUID`),
  });
