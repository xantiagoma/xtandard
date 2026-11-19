/**
 * Compile-time checks that the RQB v1 callback fits drizzle's real `where` option.
 * Checked by `tsc --noEmit` (via `bun run check`); not run by the test runner.
 */
import type { Operators, SQL } from "drizzle-orm";
import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pg-proxy";
import type { Expect, Extends } from "type-testing";

import {
  arrayField,
  buildRqbV1Where,
  type RqbV1Operators,
  textField,
} from "../src/filters/drizzle-rqb.ts";

// drizzle's own `getOperators()` set satisfies the operators the callback needs.
export type _DrizzleOperatorsFit = Expect<Extends<Operators, RqbV1Operators<SQL>>>;

const tasks = pgTable("tasks", {
  id: integer("id").primaryKey(),
  name: text("name"),
  tags: text("tags").array(),
});
const db = drizzle(async () => ({ rows: [] }), { schema: { tasks } });

const { where } = buildRqbV1Where({
  spec: { name: textField({ column: "name" }), tags: arrayField({ column: "tags" }) },
  filters: [],
});

// The callback is accepted by the legacy relational API's `where` as is.
export const _findMany = () => db.query.tasks.findMany({ where });
