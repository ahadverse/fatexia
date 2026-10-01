'use client';

import { createContext, useContext } from 'react';

/**
 * The element that popovers, dropdowns and other floating layers must portal into when
 * they are opened from inside a modal surface (`Modal`, `ConfirmModal`, `Drawer`).
 *
 * Radix's Dialog is modal by default, and modal means four things at once: the body
 * gets `pointer-events: none` with only the dialog's own content lifted back to `auto`,
 * everything outside that content is `aria-hidden`, focus is trapped inside it, and
 * scroll is locked. A `Popover.Portal` with no container renders into `document.body`,
 * which puts it *outside* the dialog's content on every one of those counts.
 *
 * The failure that causes is a confusing one, because the popover still renders and
 * still positions itself correctly against its trigger — it simply cannot be used.
 * Clicks land on an element with `pointer-events: none` and do nothing, and the search
 * input cannot hold focus because the dialog's focus trap pulls it straight back. That
 * is exactly what the affiliate pickers in "Create invoice" and "Generate payout batch"
 * were doing: the list dropped down, showed every affiliate, and ignored every click.
 *
 * Portalling into the dialog's own content element puts the layer back inside the one
 * subtree that is interactive, focusable and visible to assistive technology.
 *
 * Null is the normal case — outside a modal there is nothing to portal into, and
 * `Popover.Portal container={null}` falls back to `document.body` exactly as before.
 */
export const LayerContainerContext = createContext<HTMLElement | null>(null);

/**
 * The node a floating layer should portal into: the enclosing modal's content element,
 * or null for `document.body`.
 *
 * Every component in this package that renders a Radix `*.Portal` calls this and passes
 * the result as `container`. A new one that forgets to will look perfectly fine in
 * testing and only break the day someone puts it inside a modal, so the rule is simply:
 * if it portals, it uses this.
 */
export function useLayerContainer(): HTMLElement | null {
  return useContext(LayerContainerContext);
}
