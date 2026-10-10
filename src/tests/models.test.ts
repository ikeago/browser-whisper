import { describe, expect, test } from 'bun:test';
import { MODELS } from '../types';

describe('MODELS', () => {
    test('word timestamps imply segment timestamps', () => {
        for (const [name, cfg] of Object.entries(MODELS)) {
            if (cfg.supportsWordTimestamps) expect({ name, ts: cfg.supportsTimestamps }).toEqual({ name, ts: true });
        }
    });

    test('Hugging Face IDs are unique', () => {
        const ids = Object.values(MODELS).map((m) => m.hfId);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test('parakeet-ctc-0.6b is English-only CTC with no timestamps and an explicit q8 dtype', () => {
        // The transformers.js 4.x CTC pipeline (_call_wav2vec2) returns { text } only and
        // ignores language / return_timestamps / chunk_length_s.
        expect(MODELS['parakeet-ctc-0.6b']).toEqual({
            hfId: 'onnx-community/parakeet-ctc-0.6b-ONNX',
            hybridDtype: 'q8',
            supportsTimestamps: false,
            supportsWordTimestamps: false,
            supportsLanguage: false,
        });
    });
});
