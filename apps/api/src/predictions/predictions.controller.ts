import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { uuidParam } from '../common/uuid-param.pipe.js';
import { CreatePredictionDto } from './dto/create-prediction.dto.js';
import { ListPredictionsQuery } from './dto/list-predictions.query.js';
import { UpdatePredictionDto } from './dto/update-prediction.dto.js';
import { PredictionsService } from './predictions.service.js';

// Any signed-in user, whatever their role: no @Roles, and the global guard
// refuses anonymous visitors
@Controller()
export class PredictionsController {
  constructor(private readonly predictions: PredictionsService) {}

  @Post('predictions')
  create(@Body() dto: CreatePredictionDto, @CurrentUser() user: AuthUser) {
    return this.predictions.create(dto, user);
  }

  @Patch('predictions/:id')
  update(
    @Param('id', uuidParam()) id: string,
    @Body() dto: UpdatePredictionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.predictions.update(id, dto, user);
  }

  @Get('me/predictions')
  listMine(
    @Query() query: ListPredictionsQuery,
    @CurrentUser() user: AuthUser,
  ) {
    return this.predictions.listMine(user, query);
  }
}
