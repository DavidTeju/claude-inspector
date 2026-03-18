// Minimal non-reactive stub for test bootstrapping. Replace with a reactive wrapper
// if future component tests need to observe page changes.
export const page = {
	data: {},
	error: null,
	form: undefined,
	params: {},
	route: { id: null },
	state: {},
	status: 200,
	url: new URL('http://localhost/')
};
