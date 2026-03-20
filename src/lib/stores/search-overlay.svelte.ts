let open = $state(false);

export const searchOverlay = {
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
