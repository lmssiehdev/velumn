import { slugifyThreadUrl } from "@repo/utils/helpers/slugify";
import type { MatchPosition, SearchResult } from "./contracts";

const maxResultsPerThread = 2;
const maxSearchExcerptLength = 240;
const searchExcerptContext = 72;

export interface HighlightSegment {
	readonly value: string;
	readonly highlighted: boolean;
}

export const toHighlightSegments = (
	value: string,
	positions: readonly MatchPosition[] | undefined,
): HighlightSegment[] => {
	const ranges = (positions ?? [])
		.filter(
			({ start, length }) =>
				Number.isInteger(start) &&
				Number.isInteger(length) &&
				start >= 0 &&
				length > 0 &&
				start < value.length,
		)
		.map(({ start, length }) => ({
			start,
			end: Math.min(value.length, start + length),
		}))
		.sort((left, right) => left.start - right.start);

	const merged: Array<{ start: number; end: number }> = [];
	for (const range of ranges) {
		const previous = merged.at(-1);
		if (previous && range.start <= previous.end) {
			previous.end = Math.max(previous.end, range.end);
		} else {
			merged.push({ ...range });
		}
	}

	const segments: HighlightSegment[] = [];
	let cursor = 0;
	for (const range of merged) {
		if (range.start > cursor) {
			segments.push({
				value: value.slice(cursor, range.start),
				highlighted: false,
			});
		}
		segments.push({
			value: value.slice(range.start, range.end),
			highlighted: true,
		});
		cursor = range.end;
	}
	if (cursor < value.length) {
		segments.push({ value: value.slice(cursor), highlighted: false });
	}

	return segments;
};

export const toSearchExcerpt = (
	value: string,
	positions: readonly MatchPosition[] | undefined,
) => {
	if (value.length <= maxSearchExcerptLength) return { value, positions };

	const firstMatch = positions?.find(
		(position) => position.start >= 0 && position.start < value.length,
	);
	let start = Math.max(0, (firstMatch?.start ?? 0) - searchExcerptContext);
	const end = Math.min(value.length, start + maxSearchExcerptLength);
	if (end - start < maxSearchExcerptLength) {
		start = Math.max(0, end - maxSearchExcerptLength);
	}

	const prefix = start > 0 ? "…" : "";
	const suffix = end < value.length ? "…" : "";
	const adjustedPositions = (positions ?? []).flatMap((position) => {
		const matchStart = Math.max(position.start, start);
		const matchEnd = Math.min(position.start + position.length, end);
		return matchEnd > matchStart
			? [
					{
						start: prefix.length + matchStart - start,
						length: matchEnd - matchStart,
					},
				]
			: [];
	});

	return {
		value: `${prefix}${value.slice(start, end)}${suffix}`,
		positions: adjustedPositions,
	};
};

export const formatPublicSearchResults = (results: SearchResult) => {
	const threadCounts = new Map<string, number>();
	const hits = results.hits
		.filter((hit) => {
			const count = threadCounts.get(hit.threadId) ?? 0;
			if (count >= maxResultsPerThread) return false;
			threadCounts.set(hit.threadId, count + 1);
			return true;
		})
		.map((hit) => {
			const content = toSearchExcerpt(
				hit.content,
				hit._matchesPosition?.content,
			);
			return {
				id: hit.id,
				threadId: hit.threadId,
				title: hit.title,
				channelName: hit.channelName,
				content: content.value,
				isThreadStarter: hit.isThreadStarter,
				timestamp: hit.timestamp,
				threadUrl:
					slugifyThreadUrl({ id: hit.threadId, name: hit.title }) +
					(hit.isThreadStarter ? "" : `#${hit.id}`),
				highlights: {
					title: toHighlightSegments(hit.title, hit._matchesPosition?.title),
					content: toHighlightSegments(content.value, content.positions),
				},
			};
		});

	return {
		hits,
		estimatedTotalHits: results.estimatedTotalHits ?? results.hits.length,
		processingTimeMs: results.processingTimeMs,
		query: results.query,
	};
};
