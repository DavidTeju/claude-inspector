let open = $state(false);
let projectId = $state<string | null>(null);

export const newSessionModal = {
	get open() {
		return open;
	},
	get projectId() {
		return projectId;
	},
	show(nextProjectId?: string) {
		projectId = nextProjectId ?? null;
		open = true;
	},
	hide() {
		open = false;
		projectId = null;
	}
};
