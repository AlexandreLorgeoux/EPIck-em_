import { Module } from '@nestjs/common';
import { TournamentTeamsController } from './tournament-teams.controller.js';
import { TournamentTeamsService } from './tournament-teams.service.js';
import { TournamentsController } from './tournaments.controller.js';
import { TournamentsService } from './tournaments.service.js';

@Module({
  controllers: [TournamentsController, TournamentTeamsController],
  providers: [TournamentsService, TournamentTeamsService],
})
export class TournamentsModule {}
