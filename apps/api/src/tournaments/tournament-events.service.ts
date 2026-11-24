import { Injectable, OnModuleDestroy, type MessageEvent } from '@nestjs/common';
import {
  Subject,
  concat,
  filter,
  from,
  interval,
  map,
  merge,
  takeUntil,
  type Observable,
} from 'rxjs';
import { PrismaService } from '../prisma/prisma.service.js';

// What changed in a tournament. A client refetches what it shows.
export type TournamentChange = 'match-result' | 'bracket' | 'leaderboard';

interface Published {
  tournamentId: string;
  version: string;
  type: TournamentChange;
  data: Record<string, unknown>;
}

// Proxies close a silent connection: a comment every 25 s keeps it open
const KEEP_ALIVE_MS = 25_000;

/**
 * Live updates of a tournament, as server-sent events. The version of a
 * tournament is the id of its latest score audit entry: every result,
 * correction or scoring change writes one, and it is stored, so it
 * survives a restart. Each event carries it as its id; a client that
 * reconnects sends the last one it received (Last-Event-ID) and learns
 * from the first event whether it missed anything.
 */
@Injectable()
export class TournamentEventsService implements OnModuleDestroy {
  private readonly published = new Subject<Published>();
  private readonly closing = new Subject<void>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleDestroy() {
    // Ends the open streams, so the server can stop
    this.closing.next();
    this.closing.complete();
    this.published.complete();
  }

  async version(tournamentId: string): Promise<bigint> {
    const latest = await this.prisma.scoreAuditLog.aggregate({
      where: { tournamentId },
      _max: { id: true },
    });
    return latest._max.id ?? 0n;
  }

  // Called after the transaction commits, so a client that refetches on
  // the event sees the change
  publish(
    tournamentId: string,
    version: bigint,
    changes: { type: TournamentChange; data?: Record<string, unknown> }[],
  ) {
    for (const { type, data = {} } of changes) {
      this.published.next({
        tournamentId,
        version: version.toString(),
        type,
        data,
      });
    }
  }

  // The stream of one tournament: a sync event first, then its changes
  async stream(
    tournamentId: string,
    lastEventId?: string,
  ): Promise<Observable<MessageEvent>> {
    const version = await this.version(tournamentId);
    const seen = /^\d+$/.test(lastEventId ?? '') ? BigInt(lastEventId!) : null;
    const sync: MessageEvent = {
      type: 'sync',
      id: version.toString(),
      // Reconnect after 3 s when the connection drops
      retry: 3000,
      // missed: a reconnecting client is behind and must refetch
      data: {
        version: version.toString(),
        missed: seen !== null && seen < version,
      },
    };
    const changes = this.published.pipe(
      filter((event) => event.tournamentId === tournamentId),
      map((event): MessageEvent => ({
        type: event.type,
        id: event.version,
        data: { ...event.data, version: event.version },
      })),
    );
    const keepAlive = interval(KEEP_ALIVE_MS).pipe(
      map((): MessageEvent => ({ comment: 'keep-alive' })),
    );
    return concat(from([sync]), merge(changes, keepAlive)).pipe(
      takeUntil(this.closing),
    );
  }
}
