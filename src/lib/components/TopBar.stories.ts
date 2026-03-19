import type { Meta, StoryObj, SvelteKitParameters } from '@storybook/sveltekit';
import TopBar from './TopBar.svelte';

const BASE_URL = 'http://localhost:5173';
const MOCK_PROJECT_ID = '-Users-david-projects-my-app';
const MOCK_SESSION_ID = 'abc12345-6789-0def-ghij-klmnopqrstuv';

type MockPageParameters = {
	sveltekit_experimental: {
		state: {
			page: NonNullable<NonNullable<SvelteKitParameters['state']>['page']>;
		};
	};
};

function mockPage(pathname: string, params: Record<string, string> = {}): MockPageParameters {
	return {
		sveltekit_experimental: {
			state: { page: { url: new URL(`${BASE_URL}${pathname}`), params } }
		}
	};
}

const meta = {
	title: 'Components/TopBar',
	component: TopBar,
	tags: ['autodocs']
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const HomePage: Story = {
	parameters: mockPage('/')
};

export const ProjectPage: Story = {
	parameters: mockPage(`/projects/${MOCK_PROJECT_ID}`, {
		projectId: MOCK_PROJECT_ID
	})
};

export const SessionPage: Story = {
	parameters: mockPage(`/session/${MOCK_PROJECT_ID}/${MOCK_SESSION_ID}`, {
		projectId: MOCK_PROJECT_ID,
		sessionId: MOCK_SESSION_ID
	})
};
