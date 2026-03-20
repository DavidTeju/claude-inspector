import type { Meta, StoryObj } from '@storybook/sveltekit';
import BrandingHeader from './BrandingHeader.svelte';

const meta = {
	title: 'Components/BrandingHeader',
	component: BrandingHeader,
	tags: ['autodocs']
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
