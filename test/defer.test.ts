import { describe, expect, test } from "vitest";

import { defer, deferSync } from "../src/defer";
import { CanceledSymbol, CancelReasonSymbol, DisposedSymbol, EnabledSymbol } from "../src/symbols";
import { wait } from "../src/wait";

describe("defer", () => {
  describe("basic", () => {
    test("dispose calls the function", async () => {
      let called = false;
      const d = defer(() => {
        called = true;
      });
      await d.dispose();
      expect(called).toBe(true);
    });

    test("cancel prevents dispose", async () => {
      let called = false;
      const d = defer(() => {
        called = true;
      });
      d.cancel();
      await d.dispose();
      expect(called).toBe(false);
    });

    test("resume re-enables after cancel", async () => {
      let called = false;
      const d = defer(() => {
        called = true;
      });
      d.cancel();
      d.resume();
      await d.dispose();
      expect(called).toBe(true);
    });

    test("enabled reflects state", () => {
      const d = defer(() => {});
      expect(d.enabled).toBe(true);
      d.cancel();
      expect(d.enabled).toBe(false);
      d.resume();
      expect(d.enabled).toBe(true);
    });

    test("disposed reflects state", async () => {
      const d = defer(() => {});
      expect(d.disposed).toBe(false);
      await d.dispose();
      expect(d.disposed).toBe(true);
    });

    test("symbol accessors mirror string accessors", async () => {
      const d = defer(() => {});
      expect(d[EnabledSymbol]).toBe(true);
      expect(d[DisposedSymbol]).toBe(false);
      expect(d[CanceledSymbol]).toBe(false);
      expect(d[CancelReasonSymbol]).toBeUndefined();

      d.cancel("reason");
      expect(d[EnabledSymbol]).toBe(false);
      expect(d[CanceledSymbol]).toBe(true);
      expect(d[CancelReasonSymbol]).toBe("reason");

      d.resume();
      await d.dispose();
      expect(d[DisposedSymbol]).toBe(true);
      expect(d[EnabledSymbol]).toBe(false);
    });
  });

  describe("double-dispose protection", () => {
    test("dispose only runs once", async () => {
      let count = 0;
      const d = defer(() => {
        count++;
      });
      await d.dispose();
      await d.dispose();
      expect(count).toBe(1);
    });

    test("resume after dispose is a no-op", async () => {
      let count = 0;
      const d = defer(() => {
        count++;
      });
      await d.dispose();
      d.resume();
      await d.dispose();
      expect(count).toBe(1);
      expect(d.enabled).toBe(false);
    });
  });

  describe("using keyword", () => {
    test("await using disposes at end of scope", async () => {
      let called = false;
      await (async () => {
        await using _d = defer(() => {
          called = true;
        });
      })();
      expect(called).toBe(true);
    });

    test("await using with cancel does not dispose", async () => {
      let called = false;
      await (async () => {
        await using d = defer(() => {
          called = true;
        });
        d.cancel();
      })();
      expect(called).toBe(false);
    });

    test("multiple await using dispose in LIFO order", async () => {
      const order: number[] = [];
      await (async () => {
        await using _a = defer(() => {
          order.push(1);
        });
        await using _b = defer(() => {
          order.push(2);
        });
        await using _c = defer(() => {
          order.push(3);
        });
      })();
      expect(order).toEqual([3, 2, 1]);
    });

    test("multiple await using with async dispose in LIFO order", async () => {
      const order: number[] = [];
      await (async () => {
        await using _a = defer(async () => {
          await wait(10);
          order.push(1);
        });
        await using _b = defer(async () => {
          await wait(5);
          order.push(2);
        });
        await using _c = defer(async () => {
          await wait(1);
          order.push(3);
        });
      })();
      expect(order).toEqual([3, 2, 1]);
    });
  });

  describe("error handling", () => {
    test("dispose still runs when scope throws", async () => {
      let disposed = false;
      try {
        await (async () => {
          await using _d = defer(() => {
            disposed = true;
          });
          throw new Error("scope error");
        })();
      } catch {}
      expect(disposed).toBe(true);
    });

    test("throw inside dispose propagates", async () => {
      const fn = async () => {
        await using _d = defer(() => {
          throw new Error("dispose error");
        });
      };
      expect(fn()).rejects.toThrow("dispose error");
    });

    test("async throw inside dispose propagates", async () => {
      const fn = async () => {
        await using _d = defer(async () => {
          await wait(1);
          throw new Error("async dispose error");
        });
      };
      expect(fn()).rejects.toThrow("async dispose error");
    });

    test("multiple defers — all dispose even if one throws", async () => {
      const order: number[] = [];
      try {
        await (async () => {
          await using _a = defer(() => {
            order.push(1);
          });
          await using _b = defer(() => {
            throw new Error("b throws");
          });
          await using _c = defer(() => {
            order.push(3);
          });
        })();
      } catch {}
      expect(order).toContain(3);
      expect(order).toContain(1);
    });
  });

  describe("AbortSignal", () => {
    test("signal abort cancels before dispose", async () => {
      let called = false;
      const controller = new AbortController();
      const d = defer(
        () => {
          called = true;
        },
        { signal: controller.signal },
      );
      controller.abort();
      await d.dispose();
      expect(called).toBe(false);
    });

    test("already-aborted signal starts canceled", async () => {
      let called = false;
      const d = defer(
        () => {
          called = true;
        },
        { signal: AbortSignal.abort() },
      );
      expect(d.enabled).toBe(false);
      await d.dispose();
      expect(called).toBe(false);
    });

    test("signal abort after dispose has no effect", async () => {
      let count = 0;
      const controller = new AbortController();
      const d = defer(
        () => {
          count++;
        },
        { signal: controller.signal },
      );
      await d.dispose();
      controller.abort();
      expect(count).toBe(1);
    });

    test("resume overrides signal abort", async () => {
      let called = false;
      const controller = new AbortController();
      const d = defer(
        () => {
          called = true;
        },
        { signal: controller.signal },
      );
      controller.abort();
      expect(d.enabled).toBe(false);
      d.resume();
      expect(d.enabled).toBe(true);
      await d.dispose();
      expect(called).toBe(true);
    });

    test("AbortSignal.timeout cancels after delay", async () => {
      let called = false;
      const d = defer(
        () => {
          called = true;
        },
        { signal: AbortSignal.timeout(10) },
      );
      await wait(20);
      await d.dispose();
      expect(called).toBe(false);
    });

    test("abort reason is captured from signal", async () => {
      const controller = new AbortController();
      const d = defer(() => {}, { signal: controller.signal });
      controller.abort("timeout");
      expect(d.cancelReason).toBe("timeout");
    });

    test("already-aborted signal captures reason", () => {
      const d = defer(() => {}, { signal: AbortSignal.abort("pre-aborted") });
      expect(d.cancelReason).toBe("pre-aborted");
    });

    test("onCancel fires on signal abort", async () => {
      let cancelledWith: unknown;
      const controller = new AbortController();
      defer(() => {}, {
        signal: controller.signal,
        onCancel: (reason) => {
          cancelledWith = reason;
        },
      });
      controller.abort("signal reason");
      expect(cancelledWith).toBe("signal reason");
    });
  });

  describe("cancel reason", () => {
    test("cancel stores reason", () => {
      const d = defer(() => {});
      d.cancel("no longer needed");
      expect(d.cancelReason).toBe("no longer needed");
      expect(d.canceled).toBe(true);
    });

    test("cancel without reason", () => {
      const d = defer(() => {});
      d.cancel();
      expect(d.cancelReason).toBeUndefined();
      expect(d.canceled).toBe(true);
    });

    test("resume clears reason", () => {
      const d = defer(() => {});
      d.cancel("some reason");
      d.resume();
      expect(d.cancelReason).toBeUndefined();
      expect(d.canceled).toBe(false);
    });
  });

  describe("onDispose callback", () => {
    test("fires after successful dispose", async () => {
      let notified = false;
      const d = defer(() => {}, {
        onDispose: () => {
          notified = true;
        },
      });
      await d.dispose();
      expect(notified).toBe(true);
    });

    test("does not fire when canceled", async () => {
      let notified = false;
      const d = defer(() => {}, {
        onDispose: () => {
          notified = true;
        },
      });
      d.cancel();
      await d.dispose();
      expect(notified).toBe(false);
    });

    test("does not fire on double dispose", async () => {
      let count = 0;
      const d = defer(() => {}, {
        onDispose: () => {
          count++;
        },
      });
      await d.dispose();
      await d.dispose();
      expect(count).toBe(1);
    });
  });

  describe("onCancel callback", () => {
    test("fires on cancel with reason", () => {
      let receivedReason: unknown;
      const d = defer(() => {}, {
        onCancel: (r) => {
          receivedReason = r;
        },
      });
      d.cancel("test reason");
      expect(receivedReason).toBe("test reason");
    });

    test("fires on cancel without reason", () => {
      let fired = false;
      const d = defer(() => {}, {
        onCancel: () => {
          fired = true;
        },
      });
      d.cancel();
      expect(fired).toBe(true);
    });
  });
});

describe("deferSync", () => {
  describe("basic", () => {
    test("dispose calls the function", () => {
      let called = false;
      const d = deferSync(() => {
        called = true;
      });
      d.dispose();
      expect(called).toBe(true);
    });

    test("cancel prevents dispose", () => {
      let called = false;
      const d = deferSync(() => {
        called = true;
      });
      d.cancel();
      d.dispose();
      expect(called).toBe(false);
    });

    test("resume re-enables after cancel", () => {
      let called = false;
      const d = deferSync(() => {
        called = true;
      });
      d.cancel();
      d.resume();
      d.dispose();
      expect(called).toBe(true);
    });

    test("enabled reflects state", () => {
      const d = deferSync(() => {});
      expect(d.enabled).toBe(true);
      d.cancel();
      expect(d.enabled).toBe(false);
      d.resume();
      expect(d.enabled).toBe(true);
    });

    test("disposed reflects state", () => {
      const d = deferSync(() => {});
      expect(d.disposed).toBe(false);
      d.dispose();
      expect(d.disposed).toBe(true);
    });
  });

  describe("double-dispose protection", () => {
    test("dispose only runs once", () => {
      let count = 0;
      const d = deferSync(() => {
        count++;
      });
      d.dispose();
      d.dispose();
      expect(count).toBe(1);
    });

    test("resume after dispose is a no-op", () => {
      let count = 0;
      const d = deferSync(() => {
        count++;
      });
      d.dispose();
      d.resume();
      d.dispose();
      expect(count).toBe(1);
      expect(d.enabled).toBe(false);
    });
  });

  describe("using keyword", () => {
    test("using disposes at end of scope", () => {
      let called = false;
      (() => {
        using _d = deferSync(() => {
          called = true;
        });
      })();
      expect(called).toBe(true);
    });

    test("using with cancel does not dispose", () => {
      let called = false;
      (() => {
        using d = deferSync(() => {
          called = true;
        });
        d.cancel();
      })();
      expect(called).toBe(false);
    });

    test("multiple using dispose in LIFO order", () => {
      const order: number[] = [];
      (() => {
        using _a = deferSync(() => {
          order.push(1);
        });
        using _b = deferSync(() => {
          order.push(2);
        });
        using _c = deferSync(() => {
          order.push(3);
        });
      })();
      expect(order).toEqual([3, 2, 1]);
    });
  });

  describe("error handling", () => {
    test("dispose still runs when scope throws", () => {
      let disposed = false;
      try {
        (() => {
          using _d = deferSync(() => {
            disposed = true;
          });
          throw new Error("scope error");
        })();
      } catch {}
      expect(disposed).toBe(true);
    });

    test("throw inside dispose propagates", () => {
      expect(() => {
        (() => {
          using _d = deferSync(() => {
            throw new Error("dispose error");
          });
        })();
      }).toThrow("dispose error");
    });

    test("multiple defers — all dispose even if one throws", () => {
      const order: number[] = [];
      try {
        (() => {
          using _a = deferSync(() => {
            order.push(1);
          });
          using _b = deferSync(() => {
            throw new Error("b throws");
          });
          using _c = deferSync(() => {
            order.push(3);
          });
        })();
      } catch {}
      expect(order).toContain(3);
      expect(order).toContain(1);
    });

    test("scope throws but dispose still runs in order", () => {
      const order: string[] = [];
      try {
        (() => {
          using _d = deferSync(() => {
            order.push("disposed");
          });
          order.push("before throw");
          throw new Error("scope error");
        })();
      } catch {}
      expect(order).toEqual(["before throw", "disposed"]);
    });
  });

  describe("AbortSignal", () => {
    test("signal abort cancels before dispose", () => {
      let called = false;
      const controller = new AbortController();
      const d = deferSync(
        () => {
          called = true;
        },
        { signal: controller.signal },
      );
      controller.abort();
      d.dispose();
      expect(called).toBe(false);
    });

    test("already-aborted signal starts canceled", () => {
      let called = false;
      const d = deferSync(
        () => {
          called = true;
        },
        { signal: AbortSignal.abort() },
      );
      expect(d.enabled).toBe(false);
      d.dispose();
      expect(called).toBe(false);
    });
  });

  describe("cancel reason", () => {
    test("cancel stores reason", () => {
      const d = deferSync(() => {});
      d.cancel("no longer needed");
      expect(d.cancelReason).toBe("no longer needed");
      expect(d.canceled).toBe(true);
    });

    test("resume clears reason", () => {
      const d = deferSync(() => {});
      d.cancel("reason");
      d.resume();
      expect(d.cancelReason).toBeUndefined();
      expect(d.canceled).toBe(false);
    });
  });

  describe("onDispose callback", () => {
    test("fires after successful dispose", () => {
      let notified = false;
      const d = deferSync(() => {}, {
        onDispose: () => {
          notified = true;
        },
      });
      d.dispose();
      expect(notified).toBe(true);
    });

    test("does not fire when canceled", () => {
      let notified = false;
      const d = deferSync(() => {}, {
        onDispose: () => {
          notified = true;
        },
      });
      d.cancel();
      d.dispose();
      expect(notified).toBe(false);
    });
  });

  describe("onCancel callback", () => {
    test("fires on cancel with reason", () => {
      let receivedReason: unknown;
      const d = deferSync(() => {}, {
        onCancel: (r) => {
          receivedReason = r;
        },
      });
      d.cancel("test reason");
      expect(receivedReason).toBe("test reason");
    });

    test("fires on already-aborted signal", () => {
      let fired = false;
      deferSync(() => {}, {
        signal: AbortSignal.abort("pre-aborted"),
        onCancel: () => {
          fired = true;
        },
      });
      expect(fired).toBe(true);
    });
  });
});
