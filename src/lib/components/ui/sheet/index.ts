import { Dialog as SheetPrimitive } from 'bits-ui';

export { default as SheetContent, sheetVariants } from './sheet-content.svelte';
export { default as SheetDescription } from './sheet-description.svelte';
export { default as SheetFooter } from './sheet-footer.svelte';
export { default as SheetHeader } from './sheet-header.svelte';
export { default as SheetOverlay } from './sheet-overlay.svelte';
export { default as SheetTitle } from './sheet-title.svelte';

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetPortal = SheetPrimitive.Portal;
