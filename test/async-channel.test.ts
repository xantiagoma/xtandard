import { describe, expect, test } from "vitest";

import { AsyncChannel } from "../src/async-channel";
import { wait } from "../src/wait";

describe("AsyncChannel", () => {
  describe("consume mode", () => {
    test("yields pushed values in order", async () => {
      const channel = AsyncChannel.create<number>();

      channel.push(1);
      channel.push(2);
      channel.push(3);
      channel.close();

      const values: number[] = [];
      for await (const value of channel) {
        values.push(value);
      }

      expect(values).toEqual([1, 2, 3]);
    });

    test("second iteration gets nothing (values consumed)", async () => {
      const channel = AsyncChannel.create<number>();

      channel.push(1);
      channel.push(2);
      channel.close();

      const first: number[] = [];
      for await (const v of channel) {
        first.push(v);
      }

      const second: number[] = [];
      for await (const v of channel) {
        second.push(v);
      }

      expect(first).toEqual([1, 2]);
      expect(second).toEqual([]);
    });

    test("waits for values when none are queued", async () => {
      const channel = AsyncChannel.create<number>();

      const values: number[] = [];
      const consumer = (async () => {
        for await (const v of channel) {
          values.push(v);
        }
      })();

      // Push after consumer starts
      await wait(10); // Let consumer start waiting
      channel.push(1);
      await wait(10);
      channel.push(2);
      await wait(10);
      channel.close();

      await consumer;
      expect(values).toEqual([1, 2]);
    });

    test("throws on push after close", () => {
      const channel = AsyncChannel.create<number>();
      channel.close();

      expect(() => channel.push(1)).toThrow("Cannot push to a closed channel");
    });

    test("reject throws error in consumer", async () => {
      const channel = AsyncChannel.create<number>();

      channel.push(1);
      channel.reject(new Error("Test error"));

      const values: number[] = [];
      let caughtError: Error | undefined;

      try {
        for await (const v of channel) {
          values.push(v);
        }
      } catch (e) {
        caughtError = e as Error;
      }

      expect(values).toEqual([1]);
      expect(caughtError?.message).toBe("Test error");
    });

    test("close with return value", async () => {
      const channel = AsyncChannel.create<number, string>();

      channel.push(1);
      channel.close("done");

      const iterator = channel[Symbol.asyncIterator]();
      const first = await iterator.next();
      const second = await iterator.next();

      expect(first).toEqual({ value: 1, done: false });
      expect(second).toEqual({ value: "done", done: true });
    });

    test("reset allows reuse", async () => {
      const channel = AsyncChannel.create<number>();

      channel.push(1);
      channel.close();

      const first: number[] = [];
      for await (const v of channel) {
        first.push(v);
      }

      channel.reset();
      channel.push(2);
      channel.close();

      const second: number[] = [];
      for await (const v of channel) {
        second.push(v);
      }

      expect(first).toEqual([1]);
      expect(second).toEqual([2]);
    });

    test("pending returns queued count", () => {
      const channel = AsyncChannel.create<number>();

      expect(channel.pending).toBe(0);
      channel.push(1);
      expect(channel.pending).toBe(1);
      channel.push(2);
      expect(channel.pending).toBe(2);
    });

    test("closed returns correct state", () => {
      const channel = AsyncChannel.create<number>();

      expect(channel.closed).toBe(false);
      channel.close();
      expect(channel.closed).toBe(true);
    });

    test("subscribe after reject gets error immediately", async () => {
      const channel = AsyncChannel.create<number>();

      channel.push(1);
      channel.reject(new Error("Test error"));

      const values: number[] = [];
      let caughtError: Error | undefined;

      try {
        for await (const v of channel) {
          values.push(v);
        }
      } catch (e) {
        caughtError = e as Error;
      }

      expect(values).toEqual([1]);
      expect(caughtError?.message).toBe("Test error");
    });
  });

  describe("replay mode", () => {
    test("each iteration reads from start", async () => {
      const channel = AsyncChannel.replay<number>();

      channel.push(1);
      channel.push(2);
      channel.close();

      const first: number[] = [];
      for await (const v of channel) {
        first.push(v);
      }

      const second: number[] = [];
      for await (const v of channel) {
        second.push(v);
      }

      expect(first).toEqual([1, 2]);
      expect(second).toEqual([1, 2]);
    });

    test("waits for new values after catching up", async () => {
      const channel = AsyncChannel.replay<number>();

      channel.push(1);

      const values: number[] = [];
      const consumer = (async () => {
        for await (const v of channel) {
          values.push(v);
        }
      })();

      await wait(10);
      channel.push(2);
      await wait(10);
      channel.close();

      await consumer;
      expect(values).toEqual([1, 2]);
    });

    test("reject during subscription throws error", async () => {
      const channel = AsyncChannel.replay<number>();

      channel.push(1);

      const values: number[] = [];
      let caughtError: Error | undefined;

      const consumer = (async () => {
        try {
          for await (const v of channel) {
            values.push(v);
          }
        } catch (e) {
          caughtError = e as Error;
        }
      })();

      await wait(10);
      channel.push(2);
      await wait(10);
      channel.reject(new Error("Test error"));

      await consumer;

      expect(values).toEqual([1, 2]);
      expect(caughtError?.message).toBe("Test error");
    });

    test("subscribe after reject gets buffered values then error", async () => {
      const channel = AsyncChannel.replay<number>();

      channel.push(1);
      channel.push(2);
      channel.reject(new Error("Test error"));

      const values: number[] = [];
      let caughtError: Error | undefined;

      try {
        for await (const v of channel) {
          values.push(v);
        }
      } catch (e) {
        caughtError = e as Error;
      }

      expect(values).toEqual([1, 2]);
      expect(caughtError?.message).toBe("Test error");
    });
  });

  describe("broadcast mode", () => {
    test("multiple simultaneous consumers receive same values", async () => {
      const channel = AsyncChannel.broadcast<number>();

      const values1: number[] = [];
      const values2: number[] = [];

      const consumer1 = (async () => {
        for await (const v of channel) {
          values1.push(v);
        }
      })();

      const consumer2 = (async () => {
        for await (const v of channel) {
          values2.push(v);
        }
      })();

      await wait(10); // Let consumers start
      channel.push(1);
      await wait(10);
      channel.push(2);
      await wait(10);
      channel.close();

      await Promise.all([consumer1, consumer2]);

      expect(values1).toEqual([1, 2]);
      expect(values2).toEqual([1, 2]);
    });

    test("late subscriber misses past values", async () => {
      const channel = AsyncChannel.broadcast<number>();

      const values1: number[] = [];
      const consumer1 = (async () => {
        for await (const v of channel) {
          values1.push(v);
        }
      })();

      await wait(10);
      channel.push(1);
      await wait(10);

      // Late subscriber
      const values2: number[] = [];
      const consumer2 = (async () => {
        for await (const v of channel) {
          values2.push(v);
        }
      })();

      await wait(10);
      channel.push(2);
      await wait(10);
      channel.close();

      await Promise.all([consumer1, consumer2]);

      expect(values1).toEqual([1, 2]);
      expect(values2).toEqual([2]); // Missed 1
    });

    test("reject during active subscription throws to all consumers", async () => {
      const channel = AsyncChannel.broadcast<number>();

      const values1: number[] = [];
      const values2: number[] = [];
      let error1: Error | undefined;
      let error2: Error | undefined;

      const consumer1 = (async () => {
        try {
          for await (const v of channel) {
            values1.push(v);
          }
        } catch (e) {
          error1 = e as Error;
        }
      })();

      const consumer2 = (async () => {
        try {
          for await (const v of channel) {
            values2.push(v);
          }
        } catch (e) {
          error2 = e as Error;
        }
      })();

      await wait(10);
      channel.push(1);
      await wait(10);
      channel.reject(new Error("Test error"));

      await Promise.all([consumer1, consumer2]);

      expect(values1).toEqual([1]);
      expect(values2).toEqual([1]);
      expect(error1?.message).toBe("Test error");
      expect(error2?.message).toBe("Test error");
    });

    test("subscribe after reject gets error immediately", async () => {
      const channel = AsyncChannel.broadcast<number>();

      channel.push(1);
      channel.reject(new Error("Test error"));

      const values: number[] = [];
      let caughtError: Error | undefined;

      try {
        for await (const v of channel) {
          values.push(v);
        }
      } catch (e) {
        caughtError = e as Error;
      }

      // Broadcast doesn't replay, so no buffered values
      expect(values).toEqual([]);
      expect(caughtError?.message).toBe("Test error");
    });
  });

  describe("broadcastReplay mode", () => {
    test("multiple simultaneous consumers receive same values", async () => {
      const channel = AsyncChannel.broadcastReplay<number>();

      const values1: number[] = [];
      const values2: number[] = [];

      const consumer1 = (async () => {
        for await (const v of channel) {
          values1.push(v);
        }
      })();

      const consumer2 = (async () => {
        for await (const v of channel) {
          values2.push(v);
        }
      })();

      await wait(10);
      channel.push(1);
      await wait(10);
      channel.push(2);
      await wait(10);
      channel.close();

      await Promise.all([consumer1, consumer2]);

      expect(values1).toEqual([1, 2]);
      expect(values2).toEqual([1, 2]);
    });

    test("late subscriber gets past values via replay", async () => {
      const channel = AsyncChannel.broadcastReplay<number>();

      const values1: number[] = [];
      const consumer1 = (async () => {
        for await (const v of channel) {
          values1.push(v);
        }
      })();

      await wait(10);
      channel.push(1);
      await wait(10);
      channel.push(2);
      await wait(10);

      // Late subscriber - should get 1 and 2 from replay
      const values2: number[] = [];
      const consumer2 = (async () => {
        for await (const v of channel) {
          values2.push(v);
        }
      })();

      await wait(10);
      channel.push(3);
      await wait(10);
      channel.close();

      await Promise.all([consumer1, consumer2]);

      expect(values1).toEqual([1, 2, 3]);
      expect(values2).toEqual([1, 2, 3]); // Got all values including past
    });

    test("subscriber after close gets all values", async () => {
      const channel = AsyncChannel.broadcastReplay<number>();

      channel.push(1);
      channel.push(2);
      channel.close();

      const values: number[] = [];
      for await (const v of channel) {
        values.push(v);
      }

      expect(values).toEqual([1, 2]);
    });

    test("reject during active subscription throws to all consumers", async () => {
      const channel = AsyncChannel.broadcastReplay<number>();

      const values1: number[] = [];
      const values2: number[] = [];
      let error1: Error | undefined;
      let error2: Error | undefined;

      const consumer1 = (async () => {
        try {
          for await (const v of channel) {
            values1.push(v);
          }
        } catch (e) {
          error1 = e as Error;
        }
      })();

      const consumer2 = (async () => {
        try {
          for await (const v of channel) {
            values2.push(v);
          }
        } catch (e) {
          error2 = e as Error;
        }
      })();

      await wait(10);
      channel.push(1);
      await wait(10);
      channel.push(2);
      await wait(10);
      channel.reject(new Error("Test error"));

      await Promise.all([consumer1, consumer2]);

      expect(values1).toEqual([1, 2]);
      expect(values2).toEqual([1, 2]);
      expect(error1?.message).toBe("Test error");
      expect(error2?.message).toBe("Test error");
    });

    test("subscribe after reject gets buffered values then error", async () => {
      const channel = AsyncChannel.broadcastReplay<number>();

      channel.push(1);
      channel.push(2);
      channel.reject(new Error("Test error"));

      const values: number[] = [];
      let caughtError: Error | undefined;

      try {
        for await (const v of channel) {
          values.push(v);
        }
      } catch (e) {
        caughtError = e as Error;
      }

      // Should get buffered values first (replay), then error
      expect(values).toEqual([1, 2]);
      expect(caughtError?.message).toBe("Test error");
    });

    test("late subscriber gets buffered values then error if reject happened", async () => {
      const channel = AsyncChannel.broadcastReplay<number>();

      const values1: number[] = [];
      let error1: Error | undefined;

      const consumer1 = (async () => {
        try {
          for await (const v of channel) {
            values1.push(v);
          }
        } catch (e) {
          error1 = e as Error;
        }
      })();

      await wait(10);
      channel.push(1);
      await wait(10);
      channel.push(2);
      await wait(10);
      channel.reject(new Error("Test error"));

      // Late subscriber after reject
      const values2: number[] = [];
      let error2: Error | undefined;

      const consumer2 = (async () => {
        try {
          for await (const v of channel) {
            values2.push(v);
          }
        } catch (e) {
          error2 = e as Error;
        }
      })();

      await Promise.all([consumer1, consumer2]);

      expect(values1).toEqual([1, 2]);
      expect(error1?.message).toBe("Test error");
      // Late subscriber should get buffered values, then error
      expect(values2).toEqual([1, 2]);
      expect(error2?.message).toBe("Test error");
    });
  });

  describe("static factory methods", () => {
    test("create() returns consume mode", async () => {
      const channel = AsyncChannel.create<number>();
      channel.push(1);
      channel.close();

      const first: number[] = [];
      for await (const v of channel) {
        first.push(v);
      }

      const second: number[] = [];
      for await (const v of channel) {
        second.push(v);
      }

      expect(first).toEqual([1]);
      expect(second).toEqual([]); // Consumed
    });

    test("replay() returns replay mode", async () => {
      const channel = AsyncChannel.replay<number>();
      channel.push(1);
      channel.close();

      const first: number[] = [];
      for await (const v of channel) {
        first.push(v);
      }

      const second: number[] = [];
      for await (const v of channel) {
        second.push(v);
      }

      expect(first).toEqual([1]);
      expect(second).toEqual([1]); // Replayed
    });
  });
});
