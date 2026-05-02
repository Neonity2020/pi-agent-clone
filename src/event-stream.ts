// ============================================================================
// EventStream — push-based async iterable for streaming LLM events
// Inspired by pi-mono's EventStream<T, R>
// ============================================================================

export class EventStream<T, R> implements AsyncIterable<T> {
  private queue: T[] = [];
  private waiters: Array<{ resolve: (value: IteratorResult<T>) => void }> = [];
  private terminalValue?: R;
  private done = false;
  private resultPromise: Promise<R>;
  private resultResolve!: (value: R) => void;
  private resultReject!: (error: Error) => void;

  constructor(private extractResult: (terminal: T) => R | undefined) {
    this.resultPromise = new Promise<R>((resolve, reject) => {
      this.resultResolve = resolve;
      this.resultReject = reject;
    });
  }

  /** Push an event. Delivers to a waiting consumer or enqueues. */
  push(event: T): void {
    if (this.done) return;
    const result = this.extractResult(event);
    if (result !== undefined) {
      this.done = true;
      this.terminalValue = result;
      this.resultResolve(result);
    }
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter.resolve({ value: event, done: false });
    } else {
      this.queue.push(event);
    }
  }

  /** Signal an error — rejects the result promise. */
  error(err: Error): void {
    this.done = true;
    this.resultReject(err);
    // Wake up any waiting consumers with done=true
    for (const waiter of this.waiters) {
      waiter.resolve({ value: undefined as unknown as T, done: true });
    }
    this.waiters = [];
  }

  /** Get the final result (resolves when a terminal event is pushed). */
  result(): Promise<R> {
    return this.resultPromise;
  }

  /** Async iterator implementation */
  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    while (true) {
      if (this.queue.length > 0) {
        yield this.queue.shift()!;
        continue;
      }
      if (this.done) return;
      const next = await new Promise<IteratorResult<T>>((resolve) => {
        this.waiters.push({ resolve });
      });
      if (next.done) return;
      yield next.value;
    }
  }
}

/** Helper: check if an event is terminal (done or error) */
export function isTerminalEvent(event: { type: string }): boolean {
  return event.type === "done" || event.type === "error";
}
