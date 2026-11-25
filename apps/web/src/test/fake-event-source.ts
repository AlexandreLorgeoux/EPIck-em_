// jsdom has no EventSource: tests drive the live events by hand
export class FakeEventSource extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static all: FakeEventSource[] = [];
  static get last() {
    return FakeEventSource.all[FakeEventSource.all.length - 1];
  }
  static install() {
    FakeEventSource.all = [];
    (globalThis as { EventSource?: unknown }).EventSource = FakeEventSource;
  }

  readyState = FakeEventSource.OPEN;
  onerror: (() => void) | null = null;

  constructor(readonly url: string) {
    super();
    FakeEventSource.all.push(this);
  }
  close() {
    this.readyState = FakeEventSource.CLOSED;
  }
  private send(type: string, version: string) {
    this.dispatchEvent(
      new MessageEvent(type, { data: JSON.stringify({ version }) }),
    );
  }
  sync(version: string) {
    this.send("sync", version);
  }
  // What the API sends for one result
  change(version: string) {
    for (const type of ["match-result", "bracket", "leaderboard"])
      this.send(type, version);
  }
  // gaveUp: an HTTP error, after which a browser does not reconnect
  fail(gaveUp: boolean) {
    this.readyState = gaveUp
      ? FakeEventSource.CLOSED
      : FakeEventSource.CONNECTING;
    this.onerror?.();
  }
}
