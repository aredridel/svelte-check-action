import { get_diagnostics, type Diagnostic } from './diagnostic';
import { fmt_path, get_pr_files, is_subdir } from './files';
import { get_ctx, type CTX } from './ctx';
import * as core from '@actions/core';
import { render } from './render';

/**
 * Stores the diagnostics in an easy to use way, whilst keeping track of counts.
 */
export class DiagnosticStore {
	public readonly store = new Map<string, Diagnostic[]>();

	public warning_count = 0;
	public error_count = 0;

	get count() {
		return this.warning_count + this.error_count;
	}

	public filtered_error_count = 0;
	public filtered_warning_count = 0;

	get filtered_count() {
		return this.filtered_warning_count + this.filtered_error_count;
	}

	constructor(
		private readonly ctx: CTX,
		private readonly changed_files: string[] | null,
	) {}

	add(diagnostic: Diagnostic) {
		if (this.changed_files && !this.changed_files.includes(diagnostic.path)) {
			return;
		}

		const current = this.store.get(diagnostic.path) ?? [];
		current.push(diagnostic);
		this.store.set(diagnostic.path, current);

		this[`${diagnostic.type}_count`]++;

		if (this.ctx.config.fail_filter(fmt_path(diagnostic.path, this.ctx))) {
			this[`filtered_${diagnostic.type}_count`]++;
		}
	}

	entries() {
		return this.store.entries();
	}
}

/**
 * Send a message to the current PR, taking into account
 * whether the last message can be edited instead.
 */
async function send(ctx: CTX, body: string) {
	const { data: comments } = await ctx.octokit.rest.issues.listComments({
		issue_number: ctx.pr_number,
		owner: ctx.owner,
		repo: ctx.repo,
	});

	const last_comment = comments
		.filter((comment) => comment.body?.startsWith('# Svelte Check Results'))
		.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
		.at(0);

	if (last_comment) {
		await ctx.octokit.rest.issues.updateComment({
			comment_id: last_comment.id,
			issue_number: ctx.pr_number,
			owner: ctx.owner,
			repo: ctx.repo,
			body,
		});
	} else {
		await ctx.octokit.rest.issues.createComment({
			issue_number: ctx.pr_number,
			owner: ctx.owner,
			repo: ctx.repo,
			body,
		});
	}
}

async function main() {
	const ctx = get_ctx();

	const changed_files = await get_pr_files(ctx);
	const diagnostics = new DiagnosticStore(ctx, changed_files);

	for (const root_path of ctx.config.diagnostic_paths) {
		const has_changed_files = changed_files
			? changed_files.some((pr_file) => is_subdir(root_path, pr_file))
			: true;

		console.log(`${has_changed_files ? 'checking' : 'skipped'} "${root_path}"`);

		if (has_changed_files) {
			for (const diagnostic of await get_diagnostics(root_path)) {
				diagnostics.add(diagnostic);
			}
		}
	}

	console.log('debug', {
		diagnostics,
		changed_files,
		ctx: {
			...ctx,
			octokit: '(hidden)',
			token: '(hidden)',
		},
	});

	const markdown = await render(ctx, diagnostics);

	await send(ctx, markdown);

	const failed =
		(ctx.config.fail_on_error && diagnostics.filtered_error_count) ||
		(ctx.config.fail_on_warning && diagnostics.filtered_warning_count);

	if (failed) {
		function stringify(key: string, enabled: boolean, count: number) {
			return `\`${key}\` is ${enabled ? 'enabled' : 'disabled'} (${count} issue${count === 1 ? '' : 's'})`;
		}

		core.setFailed(
			`Failed with ${diagnostics.filtered_count} filtered issue${diagnostics.filtered_count === 1 ? '' : 's'} ` +
				`(${diagnostics.count} total). ` +
				`${stringify('failOnError', ctx.config.fail_on_error, diagnostics.filtered_error_count)} & ` +
				`${stringify('failOnWarning', ctx.config.fail_on_warning, diagnostics.filtered_warning_count)}. `,
			// `${ctx.config.fail_filter ? 'Failures filtered by path.' : ''}`,
		);
	}
}

main()
	.then(() => console.log('Finished'))
	.catch((error) => core.setFailed(error instanceof Error ? error.message : `${error}`));
