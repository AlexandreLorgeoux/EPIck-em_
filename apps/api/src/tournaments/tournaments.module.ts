import { Module } from '@nestjs/common';
import { BracketRecomputeService } from './bracket-recompute.service.js';
import { BracketController } from './bracket.controller.js';
import { BracketService } from './bracket.service.js';
import { LeaderboardController } from './leaderboard.controller.js';
import { LeaderboardService } from './leaderboard.service.js';
import { MatchResultsController } from './match-results.controller.js';
import { MatchResultsService } from './match-results.service.js';
import { ScoringController } from './scoring.controller.js';
import { ScoringService } from './scoring.service.js';
import { TournamentEventsService } from './tournament-events.service.js';
import { TournamentTeamsController } from './tournament-teams.controller.js';
import { TournamentTeamsService } from './tournament-teams.service.js';
import { TournamentsController } from './tournaments.controller.js';
import { TournamentsService } from './tournaments.service.js';

@Module({
  controllers: [
    TournamentsController,
    TournamentTeamsController,
    BracketController,
    MatchResultsController,
    ScoringController,
    LeaderboardController,
  ],
  providers: [
    TournamentsService,
    TournamentTeamsService,
    BracketService,
    BracketRecomputeService,
    MatchResultsService,
    ScoringService,
    LeaderboardService,
    TournamentEventsService,
  ],
})
export class TournamentsModule {}
