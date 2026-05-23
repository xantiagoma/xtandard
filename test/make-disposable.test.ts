import { describe, expect, test } from "vitest";

import { makeDisposable } from "../src/make-disposable";
import { DisposedSymbol } from "../src/symbols";

describe("makeDisposable", () => {
  describe("basic", () => {
    test("preserves original properties", async () => {
      const resource = { value: 42, greet: () => "hello" };
      const disposable = await makeDisposable(resource);
      expect(disposable.value).toBe(42);
      expect(disposable.greet()).toBe("hello");
    });

    test("returns the same object (not a proxy)", async () => {
      const resource = { value: 1 };
      const disposable = await makeDisposable(resource);
      expect(Object.is(disposable, resource)).toBe(true);
    });

    test("adds Symbol.asyncDispose", async () => {
      const disposable = await makeDisposable({});
      expect(typeof disposable[Symbol.asyncDispose]).toBe("function");
    });

    test("adds DisposedSymbol getter", async () => {
      const disposable = await makeDisposable({});
      expect(disposable[DisposedSymbol]).toBe(false);
    });

    test("DisposedSymbol is not enumerable", async () => {
      const disposable = await makeDisposable({});
      expect(Object.keys(disposable)).not.toContain(DisposedSymbol.toString());
    });
  });

  describe("non-enumerable — does not leak into iteration", () => {
    test("added symbols don't appear in Object.keys", async () => {
      const disposable = await makeDisposable({ name: "test" });
      expect(Object.keys(disposable)).toEqual(["name"]);
    });

    test("added symbols don't appear in for...in", async () => {
      const disposable = await makeDisposable({ a: 1, b: 2 });
      const keys: string[] = [];
      for (const key in disposable) keys.push(key);
      expect(keys).toEqual(["a", "b"]);
    });

    test("spread does not include added symbols", async () => {
      const disposable = await makeDisposable({ x: 1 });
      const spread = { ...disposable };
      expect(spread.x).toBe(1);
      expect(Object.keys(spread)).toEqual(["x"]);
      expect(Symbol.asyncDispose in spread).toBe(false);
    });

    test("JSON.stringify ignores added symbols", async () => {
      const disposable = await makeDisposable({ val: 42 });
      expect(JSON.parse(JSON.stringify(disposable))).toEqual({ val: 42 });
    });

    test("Object.getOwnPropertySymbols includes them", async () => {
      const disposable = await makeDisposable({});
      const symbols = Object.getOwnPropertySymbols(disposable);
      expect(symbols).toContain(Symbol.asyncDispose);
      expect(symbols).toContain(DisposedSymbol);
    });

    test("Reflect.ownKeys includes them", async () => {
      const disposable = await makeDisposable({ a: 1 });
      const keys = Reflect.ownKeys(disposable);
      expect(keys).toContain("a");
      expect(keys).toContain(Symbol.asyncDispose);
      expect(keys).toContain(DisposedSymbol);
    });
  });

  describe("identity — same reference", () => {
    test("=== strict equality", async () => {
      const resource = { value: 1 };
      const disposable = await makeDisposable(resource);
      expect(disposable === resource).toBe(true);
    });

    test("Object.is", async () => {
      const resource = { value: 1 };
      const disposable = await makeDisposable(resource);
      expect(Object.is(disposable, resource)).toBe(true);
    });

    test("Map/Set identity", async () => {
      const resource = { value: 1 };
      const disposable = await makeDisposable(resource);
      const set = new Set([resource]);
      expect(set.has(disposable)).toBe(true);
      const map = new Map([[resource, "ok"]]);
      expect(map.get(disposable)).toBe("ok");
    });

    test("WeakRef resolves to same object", async () => {
      const resource = { value: 1 };
      const ref = new WeakRef(resource);
      const disposable = await makeDisposable(resource);
      expect(ref.deref()).toBe(disposable);
    });
  });

  describe("overwrite protection", () => {
    test("throws by default on second call", async () => {
      const resource = {};
      await makeDisposable(resource);
      expect(makeDisposable(resource)).rejects.toThrow(TypeError);
      expect(makeDisposable(resource)).rejects.toThrow("already disposable");
    });

    test("overwrite: true allows second call", async () => {
      const order: string[] = [];
      const resource = {};
      await makeDisposable(resource, {
        onDispose: () => {
          order.push("first");
        },
      });
      const disposable = await makeDisposable(resource, {
        onDispose: () => {
          order.push("second");
        },
        overwrite: true,
      });
      await disposable[Symbol.asyncDispose]();
      expect(order).toEqual(["second"]);
    });

    test("overwrite: true resets disposed state", async () => {
      const resource = {};
      const first = await makeDisposable(resource);
      await first[Symbol.asyncDispose]();
      expect(first[DisposedSymbol]).toBe(true);

      const second = await makeDisposable(resource, { overwrite: true });
      expect(second[DisposedSymbol]).toBe(false);
    });

    test("overwrite: true runs onInit again", async () => {
      let count = 0;
      const resource = {};
      await makeDisposable(resource, {
        onInit: () => {
          count++;
        },
      });
      await makeDisposable(resource, {
        onInit: () => {
          count++;
        },
        overwrite: true,
      });
      expect(count).toBe(2);
    });

    test("does not throw if object has native Symbol.asyncDispose and overwrite: true", async () => {
      const resource = { [Symbol.asyncDispose]: async () => {} };
      const disposable = await makeDisposable(resource, { overwrite: true });
      expect(disposable[DisposedSymbol]).toBe(false);
    });
  });

  describe("does not collide with existing properties", () => {
    test("object with 'disposed' property is preserved", async () => {
      const resource = { disposed: "my-value" };
      const disposable = await makeDisposable(resource);
      expect(disposable.disposed).toBe("my-value");
      expect(disposable[DisposedSymbol]).toBe(false);
    });

    test("object with methods named 'dispose'", async () => {
      let customDisposeCalled = false;
      const resource = {
        dispose: () => {
          customDisposeCalled = true;
        },
      };
      const disposable = await makeDisposable(resource, {
        onDispose: () => {},
      });
      disposable.dispose();
      expect(customDisposeCalled).toBe(true);
      expect(disposable[DisposedSymbol]).toBe(false);
    });
  });

  describe("onInit", () => {
    test("calls onInit during creation", async () => {
      let inited = false;
      await makeDisposable(
        {},
        {
          onInit: () => {
            inited = true;
          },
        },
      );
      expect(inited).toBe(true);
    });

    test("calls onInit with the resource", async () => {
      const resource = { value: 42 };
      await makeDisposable(resource, {
        onInit: (r) => {
          expect(r).toBe(resource);
        },
      });
    });

    test("async onInit awaited", async () => {
      const order: string[] = [];
      await makeDisposable(
        {},
        {
          onInit: async () => {
            await new Promise((r) => setTimeout(r, 5));
            order.push("inited");
          },
        },
      );
      order.push("after");
      expect(order).toEqual(["inited", "after"]);
    });
  });

  describe("onDispose", () => {
    test("calls onDispose via Symbol.asyncDispose", async () => {
      let disposed = false;
      const disposable = await makeDisposable(
        {},
        {
          onDispose: () => {
            disposed = true;
          },
        },
      );
      await disposable[Symbol.asyncDispose]();
      expect(disposed).toBe(true);
    });

    test("calls onDispose with the resource", async () => {
      const resource = { value: 42 };
      const disposable = await makeDisposable(resource, {
        onDispose: (r) => {
          expect(r).toBe(resource);
        },
      });
      await disposable[Symbol.asyncDispose]();
    });

    test("works without callbacks", async () => {
      const disposable = await makeDisposable({ value: 1 });
      await disposable[Symbol.asyncDispose]();
      expect(disposable[DisposedSymbol]).toBe(true);
    });
  });

  describe("double-dispose protection", () => {
    test("onDispose only runs once", async () => {
      let count = 0;
      const disposable = await makeDisposable(
        {},
        {
          onDispose: () => {
            count++;
          },
        },
      );
      await disposable[Symbol.asyncDispose]();
      await disposable[Symbol.asyncDispose]();
      expect(count).toBe(1);
    });

    test("DisposedSymbol reflects state", async () => {
      const disposable = await makeDisposable({});
      expect(disposable[DisposedSymbol]).toBe(false);
      await disposable[Symbol.asyncDispose]();
      expect(disposable[DisposedSymbol]).toBe(true);
    });
  });

  describe("await using", () => {
    test("disposes at end of scope", async () => {
      let disposed = false;
      await (async () => {
        await using _d = await makeDisposable(
          {},
          {
            onDispose: () => {
              disposed = true;
            },
          },
        );
      })();
      expect(disposed).toBe(true);
    });

    test("disposes even when scope throws", async () => {
      let disposed = false;
      try {
        await (async () => {
          await using _d = await makeDisposable(
            {},
            {
              onDispose: () => {
                disposed = true;
              },
            },
          );
          throw new Error("scope error");
        })();
      } catch {}
      expect(disposed).toBe(true);
    });

    test("multiple resources dispose in LIFO order", async () => {
      const order: string[] = [];
      await (async () => {
        await using _a = await makeDisposable(
          { name: "a" },
          {
            onDispose: (r) => {
              order.push(r.name);
            },
          },
        );
        await using _b = await makeDisposable(
          { name: "b" },
          {
            onDispose: (r) => {
              order.push(r.name);
            },
          },
        );
      })();
      expect(order).toEqual(["b", "a"]);
    });
  });

  describe("error handling", () => {
    test("onInit error prevents resource creation", async () => {
      expect(
        makeDisposable(
          {},
          {
            onInit: () => {
              throw new Error("init fail");
            },
          },
        ),
      ).rejects.toThrow("init fail");
    });

    test("onDispose error propagates", async () => {
      const disposable = await makeDisposable(
        {},
        {
          onDispose: () => {
            throw new Error("dispose fail");
          },
        },
      );
      expect(disposable[Symbol.asyncDispose]()).rejects.toThrow("dispose fail");
    });

    test("onDispose error still marks as disposed", async () => {
      const disposable = await makeDisposable(
        {},
        {
          onDispose: () => {
            throw new Error("fail");
          },
        },
      );
      try {
        await disposable[Symbol.asyncDispose]();
      } catch {}
      expect(disposable[DisposedSymbol]).toBe(true);
    });
  });
});
