import { relative, normalize, join } from 'node:path';
import type { CTX } from './ctx';

/**
 * Check if `child` is a sub directory of `parent`
 */
export function is_subdir(parent: string, child: string) {
	return !relative(normalize(parent), normalize(child)).startsWith('..');
}

/**
 * Get the GitHub blob url for file contents
 */
export async function get_blob_base(ctx: CTX) {
	const { data: pr } = await ctx.octokit.rest.pulls.get({
		pull_number: ctx.pr_number,
		owner: ctx.owner,
		repo: ctx.repo,
	});

	return new URL(`https://github.com/${ctx.owner}/${ctx.repo}/blob/${pr.head.sha}`);
}

/**
 * Get the files that changed in the current PR
 */
export async function get_pr_files(ctx: CTX) {
	if (!ctx.config.filter_changes) {
		return null;
	}

	const pr_files = await ctx.octokit.paginate(ctx.octokit.rest.pulls.listFiles, {
		per_page: 100,
		pull_number: ctx.pr_number,
		owner: ctx.owner,
		repo: ctx.repo,
	});

	return pr_files.map((file) => join(ctx.repo_root, file.filename));
}

export function fmt_path(path: string, ctx: CTX) {
	return path.replace(ctx.repo_root, '').replace(/^\/+/, '');
}
