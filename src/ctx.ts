import * as github from '@actions/github';
import * as core from '@actions/core';
import { join } from 'node:path';

export interface Config {
	/**
	 * The path(s) to run svelte-check from, one per line
	 * @default cwd
	 */
	diagnostic_paths: string[];

	/**
	 * When true only the files that change (in the pull request) will be checked
	 * @default true
	 */
	filter_changes: boolean;

	/**
	 * Should we cause CI to fail if there is a Svelte Check error?
	 * @default false
	 */
	fail_on_error: boolean;

	/**
	 * Should we cause CI to fail if there is a Svelte Check error?
	 * @default false
	 */
	fail_on_warning: boolean;
}

export interface CTX {
	/**
	 * The user given config
	 */
	config: Config;

	/**
	 * The absolute path to the root of the repository on the actions fs
	 */
	repo_root: string;

	/**
	 * The GitHub access token
	 */
	token: string;

	/**
	 * The number of the current pull request
	 */
	pr_number: number;

	/**
	 * The octokit instance to use for GitHub API
	 */
	octokit: ReturnType<typeof github.getOctokit>;

	/**
	 * The repo owner
	 */
	owner: string;

	/**
	 * The repo name
	 */
	repo: string;
}

/**
 * Get the actions current context
 */
export function get_ctx(): CTX {
	const token = process.env.GITHUB_TOKEN;
	if (!token) throw new Error('Please add the GITHUB_TOKEN environment variable');

	const octokit = github.getOctokit(token);

	const repo_root = process.env.GITHUB_WORKSPACE;
	if (!repo_root) throw new Error('Missing GITHUB_WORKSPACE environment variable');

	const pr_number = github.context.payload.pull_request?.number;
	if (!pr_number) throw new Error("Can't find a pull request, are you running this on a pr?");

	const diagnostic_paths = core.getMultilineInput('paths').map((path) => join(repo_root, path));
	if (diagnostic_paths.length == 0) diagnostic_paths.push(repo_root);

	const filter_changes = core.getBooleanInput('filterChanges');
	const fail_on_warning = core.getBooleanInput('failOnWarning');
	const fail_on_error = core.getBooleanInput('failOnError');

	return {
		token,
		octokit,
		pr_number,
		repo_root,
		repo: github.context.repo.repo,
		owner: github.context.repo.owner,
		config: {
			diagnostic_paths,
			filter_changes,
			fail_on_warning,
			fail_on_error,
		},
	};
}
