import { describe, expect, it } from 'bun:test';
import { hasWebGPUAdapter } from '../lib/webgpu.js';

describe('hasWebGPUAdapter', () => {
    it('returns false when navigator.gpu is missing', async () => {
        expect(await hasWebGPUAdapter(undefined)).toBe(false);
    });

    it('returns false when requestAdapter resolves to null', async () => {
        expect(await hasWebGPUAdapter({ requestAdapter: async () => null })).toBe(false);
    });

    it('returns false when requestAdapter throws', async () => {
        expect(await hasWebGPUAdapter({ requestAdapter: async () => { throw new Error('boom'); } })).toBe(false);
    });

    it('returns true when an adapter is returned', async () => {
        expect(await hasWebGPUAdapter({ requestAdapter: async () => ({}) })).toBe(true);
    });
});
