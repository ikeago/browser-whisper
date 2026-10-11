import { describe, expect, test } from 'bun:test';
import { MODELS, type ASRModel } from '../types';

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

    test('every model uses an onnx-community Hugging Face ID', () => {
        for (const config of Object.values(MODELS)) {
            expect(config.hfId).toStartWith('onnx-community/');
            expect(config.hfId.length).toBeGreaterThan('onnx-community/'.length);
        }
    });

    test('timestamped model variants support word timestamps', () => {
        for (const [name, config] of Object.entries(MODELS)) {
            if (name.endsWith('_timestamped')) expect(config.supportsWordTimestamps).toBe(true);
        }
    });

    test('English-only models reject language selection', () => {
        const englishOnlyModels = [
            'moonshine-tiny',
            'moonshine-base',
            'distil-whisper-small',
        ] satisfies ASRModel[];

        for (const model of englishOnlyModels) {
            expect(MODELS[model].supportsLanguage).toBe(false);
        }
    });

    test('Moonshine models do not support timestamps', () => {
        const moonshineModels = ['moonshine-tiny', 'moonshine-base'] satisfies ASRModel[];

        for (const model of moonshineModels) {
            expect(MODELS[model].supportsTimestamps).toBe(false);
        }
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

    test('whisper-large-v3 declares external data for its fp32 encoder and decoder only', () => {
        // onnx-community/whisper-large-v3-ONNX ships fp32 weights in *.onnx_data but its
        // config.json has no transformers.js_config, so we must declare them ourselves.
        expect(MODELS['whisper-large-v3'].externalData).toEqual({
            'encoder_model.onnx': true,
            'decoder_model_merged.onnx': true,
        });
        // Keys are full file names so quantized variants (e.g. decoder_model_merged_q4.onnx) are not affected.
        for (const key of Object.keys(MODELS['whisper-large-v3'].externalData!)) {
            expect(key).toMatch(/^[a-z_]+\.onnx$/);
        }
    });

    test('only whisper-large-v3 overrides external data (others declare it on the Hub or have none)', () => {
        const withOverride = (Object.keys(MODELS) as ASRModel[]).filter((m) => MODELS[m].externalData);
        expect(withOverride).toEqual(['whisper-large-v3']);
    });
});
