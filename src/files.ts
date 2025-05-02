import type { CTX } from './ctx';

export function fmt_path(path: string, ctx: CTX) {
	return path.replace(ctx.repo_root, '').replace(/^\/+/, '');
}
