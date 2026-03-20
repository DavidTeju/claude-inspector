import type { Meta, StoryObj } from '@storybook/sveltekit';
import { MS_PER_DAY, MS_PER_HOUR } from '$lib/constants.js';
import type { RecentSession } from '$lib/types.js';
import RecentSessionCard from './RecentSessionCard.svelte';

const MOCK_SESSION: RecentSession = {
	sessionId: 'abc12345-6789-0def-ghij-klmnopqrstuv',
	fullPath: '/home/user/.claude/projects/-Users-user-projects-my-app/abc12345.jsonl',
	fileMtime: Date.now(),
	firstPrompt: 'Help me fix the login bug',
	summary: 'Fixed authentication token refresh logic',
	messageCount: 24,
	created: new Date(Date.now() - MS_PER_DAY).toISOString(),
	modified: new Date(Date.now() - MS_PER_HOUR).toISOString(),
	gitBranch: 'fix/auth-refresh',
	projectPath: '/Users/user/projects/my-app',
	isSidechain: false,
	projectId: '-Users-user-projects-my-app',
	projectDisplayName: 'my-app'
};

const meta = {
	title: 'Components/RecentSessionCard',
	component: RecentSessionCard,
	tags: ['autodocs']
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { session: MOCK_SESSION }
};

export const LongTitle: Story = {
	args: {
		session: {
			...MOCK_SESSION,
			summary:
				'Refactored the entire authentication middleware stack to support OAuth2 PKCE flow with token refresh and session persistence across multiple browser tabs'
		}
	}
};

export const Untitled: Story = {
	args: {
		session: {
			...MOCK_SESSION,
			customTitle: undefined,
			nativeSummary: undefined,
			summary: ''
		}
	}
};

export const WithCustomTitle: Story = {
	args: {
		session: {
			...MOCK_SESSION,
			customTitle: 'Auth middleware refactor'
		}
	}
};

export const WithFirstPrompt: Story = {
	args: {
		session: {
			...MOCK_SESSION,
			firstPrompt:
				'Can you help me debug the OAuth token refresh logic? The access token expires but the refresh flow silently fails and logs the user out.'
		}
	}
};

export const NoFirstPrompt: Story = {
	args: {
		session: {
			...MOCK_SESSION,
			firstPrompt: ''
		}
	}
};
