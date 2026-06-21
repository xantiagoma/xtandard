import { useCallback, useRef } from "react";

/**
 * Hook that prevents auto-focus behavior while still maintaining focus management.
 * Useful for modal dialogs (e.g. Radix Dialog) where you want to control the initial focus.
 *
 * @template E - Element type, defaults to HTMLDivElement
 * @returns Object containing:
 *  - `ref` — React ref to attach to the element
 *  - `onOpenAutoFocus` — Event handler to prevent default focus behavior
 *  - `tabIndex` — `-1` to make the element programmatically focusable
 *
 * @example
 * ```tsx
 * import { usePreventAutoFocus } from "xtandard/react";
 *
 * function MyDialog() {
 *   const preventAutoFocus = usePreventAutoFocus();
 *
 *   return (
 *     <DialogContent {...preventAutoFocus}>
 *       <p>Dialog content here</p>
 *     </DialogContent>
 *   );
 * }
 * ```
 */
export function usePreventAutoFocus<E extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<E>(null);

  const onOpenAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
    ref.current?.focus({ preventScroll: true });
  }, []);

  return { ref, onOpenAutoFocus, tabIndex: -1 as const };
}
