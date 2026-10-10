import type { ModelConfig, PCMChunk, TranscriptSegment, WordTimestamp } from '../types.js';

const SENTENCE_END = /[.!?…]["')\]]*$/;
const MAX_WORDS_PER_SEGMENT = 14;
const MAX_GAP_S = 1.2;

/** Pipeline chunk shape when `return_timestamps` is enabled */
export interface TimestampChunk {
    text: string;
    timestamp: [number | null, number | null];
}

/** Map ASR pipeline chunks to file-relative words */
export function chunksToWords(
    chunks: TimestampChunk[],
    chunkOffsetSeconds: number,
    maxEnd: number = Infinity,
): WordTimestamp[] {
    return chunks
        .map((c) => ({
            text: c.text.trim(),
            start: (c.timestamp[0] ?? 0) + chunkOffsetSeconds,
            end: (c.timestamp[1] ?? 0) + chunkOffsetSeconds,
        }))
        .filter((w) => w.text.length > 0 && w.end >= w.start)
        .map((w) => clampSpan(w, maxEnd));
}

/**
 * Clamp a timed span so it never runs past `maxEnd` (the real audio end),
 * keeping `start <= end`. Models can report times inside the zero-padded
 * tail of the final 30 s window, past the end of the actual audio.
 */
export function clampSpan<T extends { start: number; end: number }>(span: T, maxEnd: number): T {
    if (!Number.isFinite(maxEnd)) return span;
    const start = Math.min(span.start, maxEnd);
    const end = Math.max(start, Math.min(span.end, maxEnd));
    return start === span.start && end === span.end ? span : { ...span, start, end };
}

/** Clamp segments (and their words) to the real audio end. */
export function clampSegments(segments: TranscriptSegment[], maxEnd: number): TranscriptSegment[] {
    return segments.map((seg) => {
        const clamped = clampSpan(seg, maxEnd);
        return seg.words
            ? { ...clamped, words: seg.words.map((w) => clampSpan(w, maxEnd)) }
            : clamped;
    });
}

/** Group word-level timestamps into readable segments for display and streaming */
export function groupWordsIntoSegments(words: WordTimestamp[]): TranscriptSegment[] {
    if (words.length === 0) return [];

    const segments: TranscriptSegment[] = [];
    let batch: WordTimestamp[] = [];

    const flush = (): void => {
        if (batch.length === 0) return;
        const text = batch.map((w) => w.text).join(' ').replace(/\s+/g, ' ').trim();
        if (!text) {
            batch = [];
            return;
        }
        segments.push({
            text,
            start: batch[0].start,
            end: batch[batch.length - 1].end,
            words: [...batch],
        });
        batch = [];
    };

    for (const word of words) {
        if (!word.text.trim()) continue;

        if (batch.length > 0) {
            const gap = word.start - batch[batch.length - 1].end;
            if (gap > MAX_GAP_S) flush();
        }

        batch.push({ ...word, text: word.text.trim() });

        if (batch.length >= MAX_WORDS_PER_SEGMENT || SENTENCE_END.test(word.text)) {
            flush();
        }
    }

    flush();
    return segments;
}

/**
 * Turn one pipeline result into file-relative segments for a PCM chunk.
 * Every branch (word timestamps, segment timestamps, text-only models such as
 * Parakeet CTC) is clamped to the chunk's real audio end, because the final
 * chunk is zero-padded to a 30 s window.
 */
export function buildSegments(
    output: { text: string; chunks?: TimestampChunk[] },
    chunk: Pick<PCMChunk, 'timestamp' | 'samples' | 'duration'>,
    config: Pick<ModelConfig, 'supportsWordTimestamps'>,
): TranscriptSegment[] {
    const chunkEnd = chunk.timestamp + (chunk.duration ?? chunk.samples.length / 16_000);
    let segments: TranscriptSegment[];
    if (config.supportsWordTimestamps && output.chunks?.length) {
        segments = groupWordsIntoSegments(chunksToWords(output.chunks, chunk.timestamp, chunkEnd));
    } else if (output.chunks?.length) {
        segments = output.chunks.map((c) => ({
            text: c.text.trim(),
            start: (c.timestamp[0] ?? 0) + chunk.timestamp,
            end: (c.timestamp[1] ?? 0) + chunk.timestamp,
        })).filter((s) => s.text.length > 0);
    } else if (output.text.trim()) {
        segments = [{ text: output.text.trim(), start: chunk.timestamp, end: chunkEnd }];
    } else {
        segments = [];
    }
    return clampSegments(segments, chunkEnd);
}
