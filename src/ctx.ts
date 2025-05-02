import * as core from '@actions/core';
import picomatch from 'picomatch';
import { join } from 'node:path';

export interface Config {
	/**
	 * The path(s) to run svelte-check from, one per line
	 * @default cwd
	 */
	diagnostic_paths: string[];

	/**
	 * Should we cause CI to fail if there is a Svelte Check error?
	 * @default true
	 */
	fail_on_error: boolean;

	/**
	 * Should we cause CI to fail if there is a Svelte Check warning?
	 * @default false
	 */
	fail_on_warning: boolean;

	/**
	 * The filter to check when finding errors
	 */
	fail_filter: picomatch.Matcher;
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
}

/**
 * Get the actions current context
 */
export function get_ctx(): CTX {
	const repo_root = process.env.GITHUB_WORKSPACE;
	if (!repo_root) throw new Error('Missing GITHUB_WORKSPACE environment variable');

	const diagnostic_paths = core.getMultilineInput('paths').map((path) => join(repo_root, path));
	if (diagnostic_paths.length == 0) diagnostic_paths.push(repo_root);

	const fail_filter = picomatch(core.getMultilineInput('failFilter'));
	const fail_on_warning = core.getBooleanInput('failOnWarning');
	const fail_on_error = core.getBooleanInput('failOnError');

	return {
		repo_root,
		config: {
			diagnostic_paths,
			fail_on_warning,
			fail_on_error,
			fail_filter,
		},
	};
}
