import { describe, expect, test } from 'bun:test';
import { createLoadProgressTracker, LOAD_PROGRESS_CAP } from '../lib/load-progress';

function run(events: object[]) {
    const out: number[] = [];
    const track = createLoadProgressTracker((p) => out.push(p));
    for (const e of events) track(e);
    return out;
}

describe('createLoadProgressTracker', () => {
    test('4.x initiate without total emits nothing until progress arrives', () => {
        expect(run([
            { status: 'initiate', name: 'm', file: 'config.json' },
            { status: 'download', name: 'm', file: 'config.json' },
        ])).toEqual([]);
    });

    test('aggregates concurrent files', () => {
        const out = run([
            { status: 'initiate', file: 'a' },
            { status: 'initiate', file: 'b' },
            { status: 'progress', file: 'a', loaded: 50, total: 100, progress: 50 },
            { status: 'progress', file: 'b', loaded: 0, total: 300, progress: 0 },
            { status: 'progress', file: 'b', loaded: 300, total: 300, progress: 100 },
        ]);
        expect(out).toEqual([0.5, 50 / 400, 350 / 400]);
    });

    test('caps at 0.99 when all files are done', () => {
        const out = run([
            { status: 'progress', file: 'a', loaded: 10, total: 10 },
            { status: 'done', file: 'a' },
        ]);
        expect(out).toEqual([LOAD_PROGRESS_CAP]);
    });

    test('ignores progress_total, ready and done', () => {
        expect(run([
            { status: 'progress_total', loaded: 5, total: 10, progress: 50 },
            { status: 'done', file: 'a' },
            { status: 'ready', task: 'automatic-speech-recognition', model: 'm' },
        ])).toEqual([]);
    });

    test('still honours 3.x-style initiate with total', () => {
        expect(run([{ status: 'initiate', file: 'a', total: 100 }])).toEqual([0]);
    });

    test('keeps previous total when a progress event omits it', () => {
        expect(run([
            { status: 'progress', file: 'a', loaded: 10, total: 100 },
            { status: 'progress', file: 'a', loaded: 20 },
        ])).toEqual([0.1, 0.2]);
    });
});
