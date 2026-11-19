// The interval playground (playground/interval): two intervals in their string form, every
// operation between them, a number line that draws them, and mergeIntervals over a list.
import { useMemo, useState } from "react";
import {
  IntegerInterval,
  Interval,
  NumberInterval,
  integerDomain,
  mergeIntervals,
  numberDomain,
} from "@xtandard/lib/interval";

type Kind = "number" | "integer";
const types = {
  number: { cls: NumberInterval, domain: numberDomain },
  integer: { cls: IntegerInterval, domain: integerDomain },
} as const;

const show = (v: Interval<number> | Interval<number>[] | null): string => {
  if (v === null) return "null";
  if (Array.isArray(v))
    return v.length === 0 ? "∅ (nothing)" : v.map((i) => i.toString()).join(" ∪ ");
  return v.toString();
};

type Row = { label: string; code: string; value: string; draw?: Interval<number>[] };

function compute(
  kind: Kind,
  aText: string,
  bText: string,
  probe: number,
): { rows: Row[]; a: Interval<number>; b: Interval<number> } {
  const { cls } = types[kind];
  const a = cls.parse(aText);
  const b = cls.parse(bText);
  const asList = (v: Interval<number> | Interval<number>[] | null) =>
    v === null ? [] : Array.isArray(v) ? v : [v];
  const op = (
    label: string,
    code: string,
    v: Interval<number> | Interval<number>[] | null,
  ): Row => ({
    label,
    code,
    value: show(v),
    draw: asList(v).filter((i) => !i.isEmpty),
  });
  const q = (label: string, code: string, v: unknown): Row => ({ label, code, value: String(v) });
  return {
    a,
    b,
    rows: [
      op("Union", "a.union(b)", a.union(b)),
      op("Intersection", "a.intersection(b)", a.intersection(b)),
      op("Difference", "a.difference(b)", a.difference(b)),
      op("Symmetric difference", "a.symmetricDifference(b)", a.symmetricDifference(b)),
      op("Span", "a.span(b)", a.span(b)),
      op("Gap", "a.gap(b)", a.gap(b)),
      q("Overlaps", "a.overlaps(b)", a.overlaps(b)),
      q("Connected", "a.isConnected(b)", a.isConnected(b)),
      q("Adjacent", "a.isAdjacent(b)", a.isAdjacent(b)),
      q("A encloses B", "a.encloses(b)", a.encloses(b)),
      q(`A contains ${probe}`, `a.contains(${probe})`, a.contains(probe)),
      q(`B contains ${probe}`, `b.contains(${probe})`, b.contains(probe)),
      q("Length of A", "a.length()", a.length()),
      q("Middle of A", "a.middle()", a.middle()),
    ],
  };
}

/** A number line with A, B and an optional result drawn as bars; open ends are hollow. */
function NumberLine({
  a,
  b,
  result,
}: {
  a: Interval<number>;
  b: Interval<number>;
  result?: Interval<number>[];
}) {
  const all = [a, b, ...(result ?? [])].filter((i) => !i.isEmpty);
  const finite = all
    .flatMap((i) => [i.lowerValue(), i.upperValue()])
    .filter((v): v is number => v !== null && Number.isFinite(v));
  let min = finite.length ? Math.min(...finite) : 0;
  let max = finite.length ? Math.max(...finite) : 10;
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.15;
  const lo = min - pad;
  const hi = max + pad;
  const W = 640;
  const x = (v: number) => 24 + ((v - lo) / (hi - lo)) * (W - 48);
  const bar = (i: Interval<number>, y: number, cls: string, key: string) => {
    if (i.isEmpty) return null;
    const l = i.lowerValue();
    const u = i.upperValue();
    const x1 = l === null || !Number.isFinite(l) ? 8 : x(l);
    const x2 = u === null || !Number.isFinite(u) ? W - 8 : x(u);
    return (
      <g key={key} className={cls}>
        <line x1={x1} x2={x2} y1={y} y2={y} strokeWidth={6} strokeLinecap="butt" />
        {l !== null && Number.isFinite(l) && (
          <circle cx={x1} cy={y} r={5} className={i.lower.closed ? "closed" : "open"} />
        )}
        {u !== null && Number.isFinite(u) && (
          <circle cx={x2} cy={y} r={5} className={i.upper.closed ? "closed" : "open"} />
        )}
        {(l === null || !Number.isFinite(l)) && (
          <polygon points={`${x1 - 4},${y} ${x1 + 6},${y - 6} ${x1 + 6},${y + 6}`} />
        )}
        {(u === null || !Number.isFinite(u)) && (
          <polygon points={`${x2 + 4},${y} ${x2 - 6},${y - 6} ${x2 - 6},${y + 6}`} />
        )}
      </g>
    );
  };
  const ticks = [...new Set(finite)].sort((p, q) => p - q);
  const rows = result ? 3 : 2;
  const H = 30 + rows * 28;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="xt-line"
      role="img"
      aria-label="Number line showing the intervals"
    >
      <line x1={8} x2={W - 8} y1={H - 18} y2={H - 18} className="axis" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={H - 22} y2={H - 14} className="axis" />
          <text x={x(t)} y={H - 2} textAnchor="middle">
            {t}
          </text>
        </g>
      ))}
      <text x={4} y={18} className="lbl">
        A
      </text>
      {bar(a, 14, "bar-a", "a")}
      <text x={4} y={46} className="lbl">
        B
      </text>
      {bar(b, 42, "bar-b", "b")}
      {result && (
        <>
          <text x={4} y={74} className="lbl">
            =
          </text>
          {result.map((r, i) => bar(r, 70, "bar-r", `r${i}`))}
        </>
      )}
    </svg>
  );
}

export default function IntervalPlayground() {
  const [kind, setKind] = useState<Kind>("number");
  const [aText, setA] = useState("[3,10]");
  const [bText, setB] = useState("(4,6)");
  const [probe, setProbe] = useState(4);
  const [selected, setSelected] = useState(2);
  const [list, setList] = useState("[1,3)\n[3,5]\n(7,9)\n[8,12]\n[20,+Infinity)");

  const result = useMemo(() => {
    try {
      return compute(kind, aText, bText, probe);
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [kind, aText, bText, probe]);

  const merged = useMemo(() => {
    try {
      const { cls, domain } = types[kind];
      const items = list
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => cls.parse(l));
      return show(mergeIntervals(domain, items));
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }, [kind, list]);

  const row = "rows" in result ? result.rows[selected] : undefined;

  return (
    <div className="xt-play not-content">
      <div className="xt-row">
        <label>
          Type
          <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            <option value="number">NumberInterval (continuous)</option>
            <option value="integer">IntegerInterval (discrete)</option>
          </select>
        </label>
        <label>
          A
          <input value={aText} onChange={(e) => setA(e.target.value)} spellCheck={false} />
        </label>
        <label>
          B
          <input value={bText} onChange={(e) => setB(e.target.value)} spellCheck={false} />
        </label>
        <label>
          Probe value
          <input type="number" value={probe} onChange={(e) => setProbe(Number(e.target.value))} />
        </label>
      </div>

      {"error" in result ? (
        <pre className="xt-error">{result.error}</pre>
      ) : (
        <>
          <NumberLine a={result.a} b={result.b} result={row?.draw} />
          <table>
            <thead>
              <tr>
                <th>Operation</th>
                <th>Call</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r, i) => (
                <tr
                  key={r.code}
                  aria-selected={i === selected}
                  className={r.draw ? "pickable" : undefined}
                  onClick={() => r.draw && setSelected(i)}
                >
                  <td>{r.label}</td>
                  <td>
                    <code>{r.code}</code>
                  </td>
                  <td>
                    <code>{r.value}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="xt-hint">
            Click an operation that returns intervals to draw it on the line.
          </p>
        </>
      )}

      <label>
        <span>
          <code>mergeIntervals</code>: one interval per line, merged into the fewest disjoint
          intervals
        </span>
        <textarea
          value={list}
          onChange={(e) => setList(e.target.value)}
          spellCheck={false}
          style={{ minHeight: "8rem" }}
        />
      </label>
      <pre>{merged}</pre>
    </div>
  );
}
