import { Dialog as DialogPrimitive } from 'bits-ui';

export { default as DialogContent } from './dialog-content.svelte';
export { default as DialogDescription } from './dialog-description.svelte';
export { default as DialogFooter } from './dialog-footer.svelte';
export { default as DialogHeader } from './dialog-header.svelte';
export { default as DialogOverlay } from './dialog-overlay.svelte';
export { default as DialogTitle } from './dialog-title.svelte';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;
