import { Module } from '@nestjs/common';
import { BracketRecomputeService } from './bracket-recompute.service.js';
import { BracketController } from './bracket.controller.js';
import { BracketService } from './bracket.service.js';
import { TournamentTeamsController } from './tournament-teams.controller.js';
import { TournamentTeamsService } from './tournament-teams.service.js';
import { TournamentsController } from './tournaments.controller.js';
import { TournamentsService } from './tournaments.service.js';

@Module({
  controllers: [
    TournamentsController,
    TournamentTeamsController,
    BracketController,
  ],
  providers: [
    TournamentsService,
    TournamentTeamsService,
    BracketService,
    BracketRecomputeService,
  ],
})
export class TournamentsModule {}
