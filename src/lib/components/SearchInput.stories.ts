import type { Meta, StoryObj } from '@storybook/sveltekit';
import SearchInput from './SearchInput.svelte';

const meta = {
	title: 'Components/SearchInput',
	component: SearchInput,
	tags: ['autodocs'],
	args: {
		query: '',
		onSearch: () => {},
		autofocus: false
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Compact: Story = {
	args: { compact: true }
};

export const Expanded: Story = {
	args: { compact: false }
};
