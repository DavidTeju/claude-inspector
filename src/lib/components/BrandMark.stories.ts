import type { Meta, StoryObj } from '@storybook/sveltekit';
import BrandMark from './BrandMark.svelte';

const meta = {
	title: 'Components/BrandMark',
	component: BrandMark,
	tags: ['autodocs']
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
