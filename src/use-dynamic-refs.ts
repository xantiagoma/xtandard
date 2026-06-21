import { createRef, useMemo, type RefObject } from "react";

/**
 * Options for {@link useDynamicRefs}.
 */
export interface UseDynamicRefsOptions {
  /** Optional namespace prefix. Changing the prefix creates a new ref map. */
  prefix?: string;
}

/** The internal Map type for a given ref element type. */
export type RefMap<T> = Map<string, RefObject<T | null>>;

/**
 * Returns a ref for the given key, creating one if it doesn't exist yet.
 * Overloads ensure that calling without a key returns `undefined`.
 */
export interface DynamicRefGetter<T> {
  (): undefined;
  (key: string): RefObject<T | null>;
}

function createRefGetter<T>(refMap: RefMap<T>): DynamicRefGetter<T> {
  function getRef(): undefined;
  function getRef(key: string): RefObject<T | null>;
  function getRef(key?: string): RefObject<T | null> | undefined {
    if (!key) {
      return undefined;
    }
    const existing = refMap.get(key);
    if (existing) return existing;

    const ref = createRef<T>();
    refMap.set(key, ref);
    return ref;
  }
  return getRef as DynamicRefGetter<T>;
}

/**
 * React hook that returns a ref "getter" function.
 * Call the getter with a string key to get (or create) a `RefObject` for that key.
 * Useful for dynamic lists, tabs, or any UI where the number of refs isn't known at compile time.
 *
 * @template T - The element type for the refs (e.g. `HTMLDivElement`)
 * @param options - Optional configuration
 * @returns A {@link DynamicRefGetter} function
 *
 * @example
 * ```tsx
 * import { useDynamicRefs } from "@xtandard/lib/react";
 *
 * function TabList({ tabs }: { tabs: string[] }) {
 *   const getRef = useDynamicRefs<HTMLButtonElement>();
 *
 *   return (
 *     <div>
 *       {tabs.map((tab) => (
 *         <button key={tab} ref={getRef(tab)}>
 *           {tab}
 *         </button>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Scroll to a specific item
 * const getRef = useDynamicRefs<HTMLDivElement>();
 *
 * function scrollTo(id: string) {
 *   getRef(id)?.current?.scrollIntoView({ behavior: "smooth" });
 * }
 * ```
 */
export function useDynamicRefs<T>(options?: UseDynamicRefsOptions): DynamicRefGetter<T> {
  const prefix = options?.prefix;

  const getRef = useMemo(() => {
    const refMap: RefMap<T> = new Map();
    return createRefGetter<T>(refMap);
  }, [prefix]);

  return getRef;
}
