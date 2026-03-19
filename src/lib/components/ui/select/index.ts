import { Select as SelectPrimitive } from 'bits-ui';

export { default as SelectContent } from './select-content.svelte';
export { default as SelectItem } from './select-item.svelte';
export { default as SelectTrigger } from './select-trigger.svelte';

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectGroupHeading = SelectPrimitive.GroupHeading;
export const SelectViewport = SelectPrimitive.Viewport;
export const SelectPortal = SelectPrimitive.Portal;
