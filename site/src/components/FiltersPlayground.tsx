// The filters playground (playground/filters): edit a filter request as JSON and see what the
// portable compiler and each driver-free adapter make of it. The logic lives in filters-demo.ts.
import { useMemo, useState } from "react";
import type { SqlDialect } from "@xtandard/lib/filters";
import { examples, kinds, renderAll, type Output, type Rendered } from "./filters-demo.ts";

const tabs = [
  { key: "sql", label: "SQL (Knex)" },
  { key: "mongo", label: "Mongo" },
  { key: "prisma", label: "Prisma" },
  { key: "postgrest", label: "PostgREST" },
  { key: "elasticsearch", label: "Elasticsearch" },
  { key: "ast", label: "Compiled AST" },
  { key: "url", label: "Compact URL" },
  { key: "labels", label: "Chip labels" },
] as const satisfies { key: keyof Rendered; label: string }[];

const pretty = (v: unknown) => JSON.stringify(v, null, 2);

function Result({ output }: { output: Output }) {
  if (!output.ok) return <pre className="xt-error">{output.error}</pre>;
  return <pre>{output.value}</pre>;
}

export default function FiltersPlayground() {
  const [text, setText] = useState(() => pretty(examples[0]!.value));
  const [dialect, setDialect] = useState<SqlDialect>("postgres");
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("sql");

  const rendered = useMemo((): Rendered | { error: string } => {
    try {
      return renderAll(text, dialect);
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [text, dialect]);

  return (
    <div className="xt-play not-content">
      <div className="xt-row">
        <label>
          Example
          <select
            onChange={(e) => {
              const ex = examples[Number(e.target.value)];
              if (ex) setText(pretty(ex.value));
            }}
            defaultValue="0"
          >
            {examples.map((ex, i) => (
              <option key={ex.label} value={i}>
                {ex.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          SQL dialect
          <select value={dialect} onChange={(e) => setDialect(e.target.value as SqlDialect)}>
            <option value="postgres">postgres</option>
            <option value="mysql">mysql</option>
            <option value="sqlite">sqlite</option>
          </select>
        </label>
      </div>

      <label>
        <span>
          Filter request: a list of <code>{"{ field, filter }"}</code> (ANDed) or a{" "}
          <code>FilterNode</code> tree. Fields:{" "}
          {Object.entries(kinds).map(([f, k], i) => (
            <span key={f}>
              {i > 0 && ", "}
              <code>{f}</code> ({k})
            </span>
          ))}
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          aria-label="Filter request JSON"
        />
      </label>

      <div className="xt-tabs" role="group" aria-label="Output">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {"error" in rendered ? (
        <pre className="xt-error">{rendered.error}</pre>
      ) : (
        <Result output={rendered[tab]} />
      )}
    </div>
  );
}
