let open = $state(false);

export const newSessionModal = {
	get open() {
		return open;
	},
	show() {
		open = true;
	},
	hide() {
		open = false;
	}
};
