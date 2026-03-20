/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'suggestion',
		docs: {
			description:
				'Disallow inline <svg> elements in Svelte components — use @lucide/svelte or icons/ components instead'
		},
		messages: {
			noInlineSvg:
				'Inline <svg> elements are not allowed. Use a Lucide icon or a component from icons/.'
		},
		schema: []
	},
	create(context) {
		return {
			SvelteElement(node) {
				if (node.name?.name === 'svg') {
					context.report({ node, messageId: 'noInlineSvg' });
				}
			}
		};
	}
};
