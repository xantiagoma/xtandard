type ChannelMode = "consume" | "replay" | "broadcast" | "broadcastReplay";

type Waiter<T, TReturn> = {
  resolve: (result: IteratorResult<T, TReturn>) => void;
  reject: (error: unknown) => void;
};

/**
 * A push-based AsyncIterable that allows external control over yielded values.
 *
 * Similar to Completer but for iterables - you can push items that get yielded,
 * resolve to complete the iteration, or reject to throw an error.
 *
 * ## Modes
 *
 * - **consume** (via `create()`) - Values are consumed by first iterator, subsequent iterations get nothing
 * - **replay** (via `replay()`) - All values are buffered, each iterator reads from the start (sequential)
 * - **broadcast** (via `broadcast()`) - Multiple simultaneous consumers, each gets values pushed after subscribing
 * - **broadcastReplay** (via `broadcastReplay()`) - Multiple simultaneous consumers, new subscribers get past values + future values
 *
 * @example Basic usage (consume mode)
 * ```ts
 * const channel = AsyncChannel.create<number>();
 *
 * channel.push(1);
 * channel.push(2);
 * channel.close();
 *
 * for await (const value of channel) {
 *   console.log(value); // 1, 2
 * }
 * // Second iteration gets nothing - values already consumed
 * ```
 *
 * @example Replay mode - multiple iterations
 * ```ts
 * const channel = AsyncChannel.replay<number>();
 *
 * channel.push(1);
 * channel.push(2);
 * channel.close();
 *
 * for await (const v of channel) console.log("A", v); // A 1, A 2
 * for await (const v of channel) console.log("B", v); // B 1, B 2
 * ```
 *
 * @example Broadcast mode - simultaneous consumers
 * ```ts
 * const channel = AsyncChannel.broadcast<number>();
 *
 * // Start two consumers
 * const consumer1 = (async () => {
 *   for await (const v of channel) console.log("1:", v);
 * })();
 * const consumer2 = (async () => {
 *   for await (const v of channel) console.log("2:", v);
 * })();
 *
 * channel.push(1); // Both consumers receive 1
 * channel.push(2); // Both consumers receive 2
 * channel.close();
 *
 * await Promise.all([consumer1, consumer2]);
 * ```
 *
 * @example ReplayBroadcast mode - late subscribers catch up
 * ```ts
 * const channel = AsyncChannel.broadcastReplay<number>();
 *
 * channel.push(1);
 * channel.push(2);
 *
 * // Consumer A starts - gets 1, 2 from replay
 * const consumerA = (async () => {
 *   for await (const v of channel) console.log("A:", v);
 * })();
 *
 * channel.push(3); // A gets 3
 *
 * // Consumer B starts late - gets 1, 2, 3 from replay, then waits
 * const consumerB = (async () => {
 *   for await (const v of channel) console.log("B:", v);
 * })();
 *
 * channel.push(4); // Both A and B get 4
 * channel.close();
 *
 * await Promise.all([consumerA, consumerB]);
 * // A: 1, A: 2, A: 3, A: 4
 * // B: 1, B: 2, B: 3, B: 4
 * ```
 *
 * @example Error handling
 * ```ts
 * const channel = AsyncChannel.create<string>();
 *
 * channel.push("before error");
 * channel.reject(new Error("Something went wrong"));
 *
 * try {
 *   for await (const value of channel) {
 *     console.log(value); // "before error"
 *   }
 * } catch (error) {
 *   console.error(error); // Error: Something went wrong
 * }
 * ```
 *
 * @example Reset and reuse
 * ```ts
 * const channel = AsyncChannel.replay<number>();
 *
 * channel.push(1);
 * channel.close();
 * for await (const v of channel) console.log(v); // 1
 *
 * channel.reset();
 * channel.push(2);
 * channel.close();
 * for await (const v of channel) console.log(v); // 2
 * ```
 */
/**
 * Extract the return type from an AsyncChannel instance or factory.
 */
export type AsyncChannelReturnType<T> =
  T extends AsyncChannel<unknown, infer R>
    ? R
    : T extends () => AsyncChannel<unknown, infer R>
      ? R
      : never;

export class AsyncChannel<T, TReturn = void> implements AsyncIterable<T> {
  private readonly _buffer: T[] = [];
  private readonly _waiters: Array<Waiter<T, TReturn>> = [];
  private readonly _mode: ChannelMode;

  // For broadcast mode: multiple subscriber queues
  private readonly _subscribers: Array<{
    queue: T[];
    waiters: Array<Waiter<T, TReturn>>;
  }> = [];

  private _closed = false;
  private _returnValue: TReturn | undefined;
  private _error: unknown;
  private _hasError = false;

  /**
   * Private constructor - use static factory methods instead.
   */
  private constructor(mode: ChannelMode) {
    this._mode = mode;
  }

  /**
   * Create a channel in consume mode.
   * Values are consumed by the first iterator, subsequent iterations get nothing.
   */
  static create<TItem, TRet = void>(): AsyncChannel<TItem, TRet> {
    return new AsyncChannel<TItem, TRet>("consume");
  }

  /**
   * Create a channel in replay mode.
   * All values are buffered and each iterator reads from the start.
   */
  static replay<TItem, TRet = void>(): AsyncChannel<TItem, TRet> {
    return new AsyncChannel<TItem, TRet>("replay");
  }

  /**
   * Create a channel in broadcast mode.
   * Multiple simultaneous consumers each receive values pushed after subscribing.
   */
  static broadcast<TItem, TRet = void>(): AsyncChannel<TItem, TRet> {
    return new AsyncChannel<TItem, TRet>("broadcast");
  }

  /**
   * Create a channel in broadcastReplay mode.
   * Multiple simultaneous consumers, new subscribers get all past values + future values.
   */
  static broadcastReplay<TItem, TRet = void>(): AsyncChannel<TItem, TRet> {
    return new AsyncChannel<TItem, TRet>("broadcastReplay");
  }

  /**
   * Push a value to be yielded by the iterator(s).
   *
   * @throws If the channel is already closed
   */
  push(value: T): void {
    if (this._closed) {
      throw new Error("Cannot push to a closed channel");
    }

    if (this._mode === "broadcast" || this._mode === "broadcastReplay") {
      // Broadcast/ReplayBroadcast: send to all subscribers
      for (const sub of this._subscribers) {
        const waiter = sub.waiters.shift();
        if (waiter) {
          waiter.resolve({ value, done: false });
        } else {
          sub.queue.push(value);
        }
      }
      // Buffer for broadcastReplay (new subscribers get past values)
      this._buffer.push(value);
    } else {
      // Consume/Replay: buffer the value
      this._buffer.push(value);

      // For consume mode, wake up a waiter if any
      if (this._mode === "consume") {
        const waiter = this._waiters.shift();
        if (waiter) {
          const v = this._buffer.shift() as T;
          waiter.resolve({ value: v, done: false });
        }
      } else {
        // Replay mode: wake up all waiters with their next value
        for (const waiter of this._waiters) {
          waiter.resolve({ value, done: false });
        }
        this._waiters.length = 0;
      }
    }
  }

  /**
   * Close the channel with an optional return value.
   */
  close(returnValue?: TReturn): void {
    if (this._closed) {
      return;
    }

    this._closed = true;
    this._returnValue = returnValue;

    // Wake up all waiters
    if (this._mode === "broadcast" || this._mode === "broadcastReplay") {
      for (const sub of this._subscribers) {
        while (sub.waiters.length > 0 && sub.queue.length === 0) {
          const waiter = sub.waiters.shift();
          waiter?.resolve({ value: returnValue as TReturn, done: true });
        }
      }
    } else {
      while (this._waiters.length > 0) {
        const waiter = this._waiters.shift();
        waiter?.resolve({ value: returnValue as TReturn, done: true });
      }
    }
  }

  /**
   * Resolve the channel with a return value.
   * Alias for `channel.close(returnValue)`.
   */
  resolve(returnValue: TReturn): void {
    this.close(returnValue);
  }

  /**
   * Reject the channel with an error.
   */
  reject(error: unknown): void {
    if (this._closed) {
      return;
    }

    this._closed = true;
    this._hasError = true;
    this._error = error;

    // Reject all waiters
    if (this._mode === "broadcast" || this._mode === "broadcastReplay") {
      for (const sub of this._subscribers) {
        while (sub.waiters.length > 0 && sub.queue.length === 0) {
          const waiter = sub.waiters.shift();
          waiter?.reject(error);
        }
      }
    } else {
      while (this._waiters.length > 0) {
        const waiter = this._waiters.shift();
        waiter?.reject(error);
      }
    }
  }

  /**
   * Returns true if the channel is closed.
   */
  get closed(): boolean {
    return this._closed;
  }

  /**
   * Returns the number of buffered values.
   */
  get pending(): number {
    return this._buffer.length;
  }

  /**
   * Reset the channel to its initial state.
   */
  reset(): void {
    // Reject any pending waiters
    for (const waiter of this._waiters) {
      waiter.reject(new Error("Channel was reset"));
    }
    for (const sub of this._subscribers) {
      for (const waiter of sub.waiters) {
        waiter.reject(new Error("Channel was reset"));
      }
      sub.waiters.length = 0;
      sub.queue.length = 0;
    }
    this._subscribers.length = 0;
    this._waiters.length = 0;
    this._buffer.length = 0;
    this._closed = false;
    this._returnValue = undefined;
    this._error = undefined;
    this._hasError = false;
  }

  [Symbol.asyncIterator](): AsyncIterator<T, TReturn> {
    if (this._mode === "consume") {
      return this._consumeIterator();
    }
    if (this._mode === "replay") {
      return this._replayIterator();
    }
    if (this._mode === "broadcast") {
      return this._broadcastIterator();
    }
    return this._broadcastReplayIterator();
  }

  private _consumeIterator(): AsyncIterator<T, TReturn> {
    return {
      next: (): Promise<IteratorResult<T, TReturn>> => {
        if (this._buffer.length > 0) {
          const value = this._buffer.shift() as T;
          return Promise.resolve({ value, done: false });
        }

        if (this._hasError) {
          return Promise.reject(this._error);
        }

        if (this._closed) {
          return Promise.resolve({
            value: this._returnValue as TReturn,
            done: true,
          });
        }

        return new Promise((resolve, reject) => {
          this._waiters.push({ resolve, reject });
        });
      },

      return: (value?: TReturn): Promise<IteratorResult<T, TReturn>> =>
        Promise.resolve({ value: value as TReturn, done: true }),

      throw: (error?: unknown): Promise<IteratorResult<T, TReturn>> => Promise.reject(error),
    };
  }

  private _replayIterator(): AsyncIterator<T, TReturn> {
    let index = 0;

    // oxlint-disable-next-line typescript/no-this-alias
    const self = this;
    return {
      next(): Promise<IteratorResult<T, TReturn>> {
        if (index < self._buffer.length) {
          const value = self._buffer[index] as T;
          index += 1;
          return Promise.resolve({ value, done: false });
        }

        if (self._hasError) {
          return Promise.reject(self._error);
        }

        if (self._closed) {
          return Promise.resolve({
            value: self._returnValue as TReturn,
            done: true,
          });
        }

        // Wait for next value
        return new Promise((resolve, reject) => {
          const waiter: Waiter<T, TReturn> = {
            resolve: (result) => {
              if (!result.done) {
                index += 1;
              }
              resolve(result);
            },
            reject,
          };
          self._waiters.push(waiter);
        });
      },

      return(value?: TReturn): Promise<IteratorResult<T, TReturn>> {
        return Promise.resolve({ value: value as TReturn, done: true });
      },

      throw(error?: unknown): Promise<IteratorResult<T, TReturn>> {
        return Promise.reject(error);
      },
    };
  }

  private _broadcastIterator(): AsyncIterator<T, TReturn> {
    // Broadcast: no replay, only get values pushed after subscribing
    const sub = { queue: [] as T[], waiters: [] as Array<Waiter<T, TReturn>> };
    this._subscribers.push(sub);

    // oxlint-disable-next-line typescript/no-this-alias
    const self = this;
    return {
      next(): Promise<IteratorResult<T, TReturn>> {
        if (sub.queue.length > 0) {
          const value = sub.queue.shift() as T;
          return Promise.resolve({ value, done: false });
        }

        if (self._hasError) {
          return Promise.reject(self._error);
        }

        if (self._closed) {
          return Promise.resolve({
            value: self._returnValue as TReturn,
            done: true,
          });
        }

        return new Promise((resolve, reject) => {
          sub.waiters.push({ resolve, reject });
        });
      },

      return(value?: TReturn): Promise<IteratorResult<T, TReturn>> {
        const idx = self._subscribers.indexOf(sub);
        if (idx !== -1) {
          self._subscribers.splice(idx, 1);
        }
        return Promise.resolve({ value: value as TReturn, done: true });
      },

      throw(error?: unknown): Promise<IteratorResult<T, TReturn>> {
        const idx = self._subscribers.indexOf(sub);
        if (idx !== -1) {
          self._subscribers.splice(idx, 1);
        }
        return Promise.reject(error);
      },
    };
  }

  private _broadcastReplayIterator(): AsyncIterator<T, TReturn> {
    // ReplayBroadcast: new subscribers get all past values, then live values
    const sub = {
      queue: [...this._buffer] as T[], // Start with copy of buffer (replay)
      waiters: [] as Array<Waiter<T, TReturn>>,
    };
    this._subscribers.push(sub);

    // oxlint-disable-next-line typescript/no-this-alias
    const self = this;
    return {
      next(): Promise<IteratorResult<T, TReturn>> {
        if (sub.queue.length > 0) {
          const value = sub.queue.shift() as T;
          return Promise.resolve({ value, done: false });
        }

        if (self._hasError) {
          return Promise.reject(self._error);
        }

        if (self._closed) {
          return Promise.resolve({
            value: self._returnValue as TReturn,
            done: true,
          });
        }

        return new Promise((resolve, reject) => {
          sub.waiters.push({ resolve, reject });
        });
      },

      return(value?: TReturn): Promise<IteratorResult<T, TReturn>> {
        const idx = self._subscribers.indexOf(sub);
        if (idx !== -1) {
          self._subscribers.splice(idx, 1);
        }
        return Promise.resolve({ value: value as TReturn, done: true });
      },

      throw(error?: unknown): Promise<IteratorResult<T, TReturn>> {
        const idx = self._subscribers.indexOf(sub);
        if (idx !== -1) {
          self._subscribers.splice(idx, 1);
        }
        return Promise.reject(error);
      },
    };
  }
}
