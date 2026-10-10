import { describe, expect, it } from 'bun:test';
import { Chunker } from '../lib/chunker.js';
import { buildSegments } from '../lib/word-segments.js';
import { MODELS, type PCMChunk } from '../types.js';

/** Run PCM through the real decoder-side path: Chunker -> MessagePort transfer -> worker receive */
async function throughPort(samples: Float32Array): Promise<PCMChunk[]> {
    const { port1, port2 } = new MessageChannel();
    const received: PCMChunk[] = [];
    const done = new Promise<void>((resolve) => {
        port2.onmessage = (e: MessageEvent<PCMChunk>) => {
            received.push(e.data);
            if (e.data.final) resolve();
        };
    });
    const chunker = new Chunker((chunk) => port1.postMessage(chunk, [chunk.samples.buffer]));
    chunker.push(samples);
    chunker.flush();
    await done;
    port1.close();
    port2.close();
    return received;
}

describe('text-only (CTC) segment end on the real chunk path', () => {
    const ctc = MODELS['parakeet-ctc-0.6b'];

    it('11 s file -> one segment ending at 11, not the 30 s window', async () => {
        const [chunk] = await throughPort(new Float32Array(16_000 * 11));
        expect(chunk.samples).toHaveLength(480_000);
        expect(chunk.duration).toBe(11);
        const segs = buildSegments({ text: ' and so my fellow americans ' }, chunk, ctc);
        expect(segs).toEqual([{ text: 'and so my fellow americans', start: 0, end: 11 }]);
    });

    it('41 s file -> segments 0-30 and 30-41', async () => {
        const chunks = await throughPort(new Float32Array(16_000 * 41));
        const segs = chunks.flatMap((c) => buildSegments({ text: 'x' }, c, ctc));
        expect(segs.map((s) => [s.start, s.end])).toEqual([[0, 30], [30, 41]]);
    });

    it('clamps a pipeline chunk reporting the full 30 s window', async () => {
        const [chunk] = await throughPort(new Float32Array(16_000 * 11));
        const segs = buildSegments({ text: 'x', chunks: [{ text: 'x', timestamp: [0, 30] }] }, chunk, ctc);
        expect(segs[0].end).toBe(11);
    });

    it('whisper word path clamps the last word to the audio end', async () => {
        const [chunk] = await throughPort(new Float32Array(16_000 * 11));
        const segs = buildSegments(
            { text: 'country', chunks: [{ text: ' country.', timestamp: [10.56, 15.9] }] },
            chunk,
            MODELS['whisper-tiny_timestamped'],
        );
        expect(segs[0]).toMatchObject({ start: 10.56, end: 11 });
        expect(segs[0].words![0].end).toBe(11);
    });
});
