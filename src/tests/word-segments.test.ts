import { describe, expect, it } from 'bun:test';
import { chunksToWords, clampSegments, clampSpan, groupWordsIntoSegments } from '../lib/word-segments.js';

describe('chunksToWords', () => {
    it('offsets timestamps by chunk start', () => {
        const words = chunksToWords(
            [{ text: ' hello', timestamp: [1, 2] }],
            30,
        );
        expect(words[0]).toEqual({ text: 'hello', start: 31, end: 32 });
    });
});

describe('groupWordsIntoSegments', () => {
    it('splits on sentence-ending punctuation', () => {
        const segments = groupWordsIntoSegments([
            { text: 'Hello', start: 0, end: 0.5 },
            { text: 'world.', start: 0.5, end: 1.2 },
            { text: 'Again', start: 1.5, end: 2 },
        ]);
        expect(segments).toHaveLength(2);
        expect(segments[0].words).toHaveLength(2);
        expect(segments[0].text).toBe('Hello world.');
    });

    it('splits on long pauses between words', () => {
        const segments = groupWordsIntoSegments([
            { text: 'A', start: 0, end: 0.2 },
            { text: 'B', start: 2, end: 2.2 },
        ]);
        expect(segments).toHaveLength(2);
    });
});

describe('timing clamps', () => {
    it('clamps word end past audio end (whisper word overrun)', () => {
        const words = chunksToWords([{ text: ' country', timestamp: [10.56, 15.9] }], 0, 11);
        expect(words[0]).toEqual({ text: 'country', start: 10.56, end: 11 });
    });
    it('keeps start <= end when start is also past audio end', () => {
        expect(clampSpan({ start: 12, end: 14 }, 11)).toEqual({ start: 11, end: 11 });
    });
    it('clamps a 30 s window segment to an 11 s file (parakeet ctc)', () => {
        const [seg] = clampSegments([{ text: 'x', start: 0, end: 30 }], 11);
        expect(seg).toEqual({ text: 'x', start: 0, end: 11 });
    });
    it('clamps segment words and leaves in-range spans untouched', () => {
        const [seg] = clampSegments([{ text: 'a b', start: 1, end: 12, words: [
            { text: 'a', start: 1, end: 2 }, { text: 'b', start: 10, end: 12 },
        ] }], 11);
        expect(seg.end).toBe(11);
        expect(seg.words).toEqual([{ text: 'a', start: 1, end: 2 }, { text: 'b', start: 10, end: 11 }]);
    });
    it('is a no-op with Infinity', () => {
        expect(chunksToWords([{ text: 'a', timestamp: [1, 99] }], 0)[0].end).toBe(99);
    });
});
