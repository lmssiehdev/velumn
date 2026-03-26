export type ForumSearchParams = {
	page?: string | string[] | undefined;
};

export async function parseForumPage(
	searchParams: ForumSearchParams | Promise<ForumSearchParams>,
) {
	const { page } = await Promise.resolve(searchParams);
	const normalizedPage = Array.isArray(page) ? page[0] : page;
	const parsedPage = Number(normalizedPage ?? 1);

	if (!Number.isInteger(parsedPage) || parsedPage < 1) {
		return 1;
	}

	return parsedPage;
}

export function buildPaginatedRedirectPath(basePath: string, page: number) {
	return page > 1 ? `${basePath}?page=${page}` : basePath;
}
