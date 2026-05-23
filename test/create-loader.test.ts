import { describe, expect, test } from "vitest";

import { createLoader } from "../src/dataloader-utils";
import { prepareLoaderResult } from "../src/prepare-loader-result";

type TestContext = { dl: Map<symbol, unknown> };

function makeContext(): TestContext {
  return { dl: new Map() };
}

describe("createLoader", () => {
  describe("basic", () => {
    test("loads a single item", async () => {
      const loader = createLoader<{ id: string; name: string }, TestContext>(async ({ keys }) =>
        keys.map((k) => ({ id: k, name: `user_${k}` })),
      );
      const context = makeContext();
      const result = await loader({ context, id: "1" });
      expect(result).toEqual({ id: "1", name: "user_1" });
    });

    test("returns correct item for each id", async () => {
      const loader = createLoader<number, TestContext, number>(async ({ keys }) =>
        keys.map((k) => k * 10),
      );
      const context = makeContext();
      const [a, b, c] = await Promise.all([
        loader({ context, id: 1 }),
        loader({ context, id: 2 }),
        loader({ context, id: 3 }),
      ]);
      expect(a).toBe(10);
      expect(b).toBe(20);
      expect(c).toBe(30);
    });
  });

  describe("batching", () => {
    test("batches concurrent calls into one fn call", async () => {
      let batchCount = 0;
      const loader = createLoader<string, TestContext>(async ({ keys }) => {
        batchCount++;
        return keys.map((k) => `value_${k}`);
      });
      const context = makeContext();
      await Promise.all([
        loader({ context, id: "a" }),
        loader({ context, id: "b" }),
        loader({ context, id: "c" }),
      ]);
      expect(batchCount).toBe(1);
    });

    test("sequential calls — first cached, second is new batch", async () => {
      let batchCount = 0;
      const loader = createLoader<string, TestContext>(async ({ keys }) => {
        batchCount++;
        return keys.map((k) => k);
      });
      const context = makeContext();
      await loader({ context, id: "a" });
      await loader({ context, id: "b" });
      expect(batchCount).toBe(2);
    });

    test("maxBatchSize limits batch size", async () => {
      const batchSizes: number[] = [];
      const loader = createLoader<number, TestContext, number>(
        async ({ keys }) => {
          batchSizes.push(keys.length);
          return keys.map((k) => k);
        },
        { maxBatchSize: 2 },
      );
      const context = makeContext();
      await Promise.all([
        loader({ context, id: 1 }),
        loader({ context, id: 2 }),
        loader({ context, id: 3 }),
      ]);
      expect(batchSizes).toEqual([2, 1]);
    });
  });

  describe("caching", () => {
    test("same id in same context returns cached result", async () => {
      let callCount = 0;
      const loader = createLoader<string, TestContext>(async ({ keys }) => {
        callCount++;
        return keys.map((k) => `val_${k}`);
      });
      const context = makeContext();
      const a = await loader({ context, id: "x" });
      const b = await loader({ context, id: "x" });
      expect(a).toBe(b);
      expect(callCount).toBe(1);
    });

    test("different contexts are independent", async () => {
      let callCount = 0;
      const loader = createLoader<string, TestContext>(async ({ keys }) => {
        callCount++;
        return keys.map((k) => `val_${k}`);
      });
      await loader({ context: makeContext(), id: "x" });
      await loader({ context: makeContext(), id: "x" });
      expect(callCount).toBe(2);
    });
  });

  describe("multiple loaders", () => {
    test("different loaders use different DataLoader instances", async () => {
      const loaderA = createLoader<string, TestContext>(async ({ keys }) =>
        keys.map((k) => `a_${k}`),
      );
      const loaderB = createLoader<string, TestContext>(async ({ keys }) =>
        keys.map((k) => `b_${k}`),
      );
      const context = makeContext();
      const [a, b] = await Promise.all([
        loaderA({ context, id: "1" }),
        loaderB({ context, id: "1" }),
      ]);
      expect(a).toBe("a_1");
      expect(b).toBe("b_1");
    });
  });

  describe("cacheKeyFn", () => {
    test("deduplicates by custom cache key", async () => {
      const receivedKeys: { id: string }[][] = [];
      const loader = createLoader<string, TestContext, { id: string }>(
        async ({ keys }) => {
          receivedKeys.push([...keys]);
          return keys.map((k) => `name_${k.id}`);
        },
        { cacheKeyFn: (key) => key.id },
      );
      const context = makeContext();
      const [a, b] = await Promise.all([
        loader({ context, id: { id: "1" } }),
        loader({ context, id: { id: "1" } }),
      ]);
      expect(a).toBe("name_1");
      expect(a).toBe(b);
      expect(receivedKeys[0]).toHaveLength(1);
    });
  });

  describe("context access in fn", () => {
    test("fn receives context", async () => {
      type Ctx = { dl: Map<symbol, unknown>; db: string };
      const loader = createLoader<string, Ctx>(async ({ context, keys }) =>
        keys.map((k) => `${context.db}_${k}`),
      );
      const context: Ctx = { dl: new Map(), db: "mydb" };
      const result = await loader({ context, id: "1" });
      expect(result).toBe("mydb_1");
    });
  });

  describe("custom getCache", () => {
    test("uses custom cache location", async () => {
      type Ctx = { loaders: Map<symbol, unknown> };
      const loader = createLoader<string, Ctx>(async ({ keys }) => keys.map((k) => `val_${k}`), {
        getCache: (ctx) => ctx.loaders,
      });
      const context: Ctx = { loaders: new Map() };
      const result = await loader({ context, id: "a" });
      expect(result).toBe("val_a");
      expect(context.loaders.size).toBe(1);
    });
  });

  describe("error handling", () => {
    test("batch fn error rejects all loads", async () => {
      const loader = createLoader<string, TestContext>(async () => {
        throw new Error("batch failed");
      });
      const context = makeContext();
      const results = await Promise.allSettled([
        loader({ context, id: "a" }),
        loader({ context, id: "b" }),
      ]);
      expect(results[0]!.status).toBe("rejected");
      expect(results[1]!.status).toBe("rejected");
    });
  });

  describe("integration with prepareLoaderResult", () => {
    test("basic loader with unordered DB results", async () => {
      type User = { id: string; name: string } | undefined;

      // Simulate a DB that returns rows in arbitrary order
      const db = [
        { id: "3", name: "Charlie" },
        { id: "1", name: "Alice" },
        { id: "2", name: "Bob" },
      ];

      const loadUser = createLoader<User, TestContext>(async ({ keys }) => {
        const rows = db.filter((r) => keys.includes(r.id));
        return prepareLoaderResult({ keys, results: rows });
      });

      const context = makeContext();
      const [a, b, c] = await Promise.all([
        loadUser({ context, id: "1" }),
        loadUser({ context, id: "2" }),
        loadUser({ context, id: "3" }),
      ]);
      expect(a).toEqual({ id: "1", name: "Alice" });
      expect(b).toEqual({ id: "2", name: "Bob" });
      expect(c).toEqual({ id: "3", name: "Charlie" });
    });

    test("missing keys return undefined", async () => {
      const loadUser = createLoader<{ id: string } | undefined, TestContext>(async ({ keys }) => {
        const rows = [{ id: "1" }]; // only one exists
        return prepareLoaderResult({ keys, results: rows });
      });

      const context = makeContext();
      const [a, b] = await Promise.all([
        loadUser({ context, id: "1" }),
        loadUser({ context, id: "999" }),
      ]);
      expect(a).toEqual({ id: "1" });
      expect(b).toBeUndefined();
    });

    test("loader with mapValue transform", async () => {
      type UserProfile = { displayName: string; isAdmin: boolean } | undefined;

      const db = [
        { id: "1", first_name: "Alice", role: "admin" },
        { id: "2", first_name: "Bob", role: "user" },
      ];

      const loadProfile = createLoader<UserProfile, TestContext>(async ({ keys }) => {
        const rows = db.filter((r) => keys.includes(r.id));
        return prepareLoaderResult({
          keys,
          results: rows,
          mapValue: (row) => ({
            displayName: row.first_name,
            isAdmin: row.role === "admin",
          }),
        });
      });

      const context = makeContext();
      const [a, b] = await Promise.all([
        loadProfile({ context, id: "1" }),
        loadProfile({ context, id: "2" }),
      ]);
      expect(a).toEqual({ displayName: "Alice", isAdmin: true });
      expect(b).toEqual({ displayName: "Bob", isAdmin: false });
    });

    test("chained loaders — one loader calls another in mapValue", async () => {
      // Simulates: loadTransaction enriches each row by calling loadRefundStatus

      const refundDb = [
        { transactionId: "tx_1", isEligible: true },
        { transactionId: "tx_2", isEligible: false },
        { transactionId: "tx_3", isEligible: true },
      ];

      const transactionDb = [
        { id: "tx_1", amount: -100, reason: "fee" },
        { id: "tx_2", amount: 50, reason: "credit" },
        { id: "tx_3", amount: -200, reason: "fee" },
      ];

      type RefundStatus = { isEligible: boolean } | undefined;
      type Transaction =
        | {
            id: string;
            amount: number;
            reason: string;
            getIsRefundable: () => Promise<boolean>;
          }
        | undefined;

      const loadRefundStatus = createLoader<RefundStatus, TestContext>(async ({ keys }) => {
        const rows = refundDb.filter((r) => keys.includes(r.transactionId));
        return prepareLoaderResult({
          keys,
          results: rows,
          getKey: (r) => r.transactionId,
        });
      });

      const loadTransaction = createLoader<Transaction, TestContext>(async ({ context, keys }) => {
        const rows = transactionDb.filter((r) => keys.includes(r.id));
        return prepareLoaderResult({
          keys,
          results: rows,
          mapValue: (row) => ({
            ...row,
            getIsRefundable: () =>
              loadRefundStatus({ context, id: row.id }).then((r) => r?.isEligible ?? false),
          }),
        });
      });

      const context = makeContext();

      // Batch load transactions
      const [tx1, tx2, tx3] = await Promise.all([
        loadTransaction({ context, id: "tx_1" }),
        loadTransaction({ context, id: "tx_2" }),
        loadTransaction({ context, id: "tx_3" }),
      ]);

      // Verify base data
      expect(tx1!.amount).toBe(-100);
      expect(tx2!.amount).toBe(50);
      expect(tx3!.reason).toBe("fee");

      // Verify chained loader calls
      expect(await tx1!.getIsRefundable()).toBe(true);
      expect(await tx2!.getIsRefundable()).toBe(false);
      expect(await tx3!.getIsRefundable()).toBe(true);

      // Missing transaction
      const missing = await loadTransaction({ context, id: "tx_999" });
      expect(missing).toBeUndefined();
    });
  });
});
