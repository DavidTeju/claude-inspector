import type { Meta, StoryObj } from '@storybook/sveltekit';
import { MS_PER_DAY } from '$lib/constants.js';
import type { Project } from '$lib/types.js';
import ProjectDropdown from './ProjectDropdown.svelte';

const MOCK_PROJECTS: Project[] = [
	{
		id: '-Users-user-projects-my-app',
		displayName: 'my-app',
		path: '/Users/user/projects/my-app',
		sessionCount: 12,
		lastModified: new Date().toISOString()
	},
	{
		id: '-Users-user-projects-api-server',
		displayName: 'api-server',
		path: '/Users/user/projects/api-server',
		sessionCount: 8,
		lastModified: new Date(Date.now() - MS_PER_DAY).toISOString()
	},
	{
		id: '-Users-user-projects-design-system',
		displayName: 'design-system',
		path: '/Users/user/projects/design-system',
		sessionCount: 3,
		lastModified: new Date(Date.now() - 2 * MS_PER_DAY).toISOString()
	}
];

const meta = {
	title: 'Components/ProjectDropdown',
	component: ProjectDropdown,
	tags: ['autodocs'],
	args: {
		projects: MOCK_PROJECTS,
		selectedId: null
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllProjects: Story = {};

export const ProjectSelected: Story = {
	args: { selectedId: '-Users-user-projects-my-app' }
};
