// Test helpers for the `sql-tag` adapters (not a test file itself).
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";

type FakeFragment = { kind: "fragment"; strings: readonly string[]; values: unknown[] };
type FakeIdentifier = { kind: "identifier"; name: string };

/**
 * A recording stand-in for a tagged-template client (Bun.sql / postgres.js): the tag records
 * its strings + values, `sql(name)` records an identifier. `render` flattens a fragment to
 * `?` placeholders + bindings, quoting identifiers per part like the clients do (backticks on
 * MySQL), so its output is directly comparable with the knex adapter's.
 */
export function fakeSqlTag(dialect: "postgres" | "mysql" | "sqlite" = "postgres") {
  function sql(strings: TemplateStringsArray, ...values: unknown[]): FakeFragment;
  function sql(identifier: string): FakeIdentifier;
  function sql(
    strings: TemplateStringsArray | string,
    ...values: unknown[]
  ): FakeFragment | FakeIdentifier {
    if (typeof strings === "string") return { kind: "identifier", name: strings };

    return { kind: "fragment", strings: [...strings], values };
  }
  const quote = dialect === "mysql" ? "`" : '"';
  const isNode = (v: unknown): v is FakeFragment | FakeIdentifier =>
    typeof v === "object" && v !== null && "kind" in v;

  const render = (fragment: unknown): { sql: string; bindings: unknown[] } => {
    const bindings: unknown[] = [];
    const walk = (node: unknown): string => {
      if (!isNode(node)) {
        bindings.push(node);
        return "?";
      }
      if (node.kind === "identifier") {
        return node.name
          .split(".")
          .map((p) => `${quote}${p}${quote}`)
          .join(".");
      }
      let out = node.strings[0] ?? "";
      node.values.forEach((value, i) => {
        out += walk(value) + (node.strings[i + 1] ?? "");
      });
      return out;
    };

    return { sql: walk(fragment), bindings };
  };

  return { sql, render };
}

/** Hook timeout for booting PGlite (WASM Postgres): slow when the whole suite runs in parallel. */
export const PGLITE_TIMEOUT = 60_000;

/** An in-process Postgres (PGlite over a local socket) with a postgres.js v4 client. */
export async function startPglite() {
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 0 });
  await server.start();
  const [host, port] = server.getServerConn().split(":");
  const sql = postgres({
    host,
    port: Number(port),
    user: "postgres",
    database: "postgres",
    max: 1,
    onnotice: () => {},
  });

  return {
    sql,
    stop: async () => {
      await sql.end();
      await server.stop();
      await db.close();
    },
  };
}
