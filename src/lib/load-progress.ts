/**
 * Aggregates transformers.js `progress_callback` events across the files a
 * pipeline downloads concurrently into a single 0–1 fraction.
 *
 * transformers.js 4.x event shapes (src/utils/hub.js):
 *  - `initiate`  { name, file }                       — no `total` in 4.x
 *  - `download`  { name, file }
 *  - `progress`  { name, file, progress, loaded, total }
 *  - `done`      { name, file }
 *  - `progress_total` { progress, loaded, total, files } — only emitted when
 *    transformers wraps the callback itself; ignored here (we aggregate ourselves)
 *  - `ready`     { task, model }
 *
 * 3.x also sent `total` on `initiate`; that is still honoured if present.
 * The result is capped at 0.99 so the bar never shows 100% before the
 * WebGPU warm-up inference has finished.
 */
export interface ProgressInfo {
    status?: string;
    file?: string;
    loaded?: number;
    total?: number;
}

export const LOAD_PROGRESS_CAP = 0.99;

export function createLoadProgressTracker(onProgress: (fraction: number) => void) {
    const files = new Map<string, { loaded: number; total: number }>();

    return (info: ProgressInfo): void => {
        const { status, file, loaded, total } = info ?? {};
        if (!file || (status !== 'initiate' && status !== 'progress')) return;

        const prev = files.get(file);
        if (status === 'initiate') {
            if (!prev) files.set(file, { loaded: 0, total: total || 0 });
            if (!total) return; // 4.x: size unknown until first `progress` event
        } else {
            files.set(file, {
                loaded: loaded || 0,
                total: total || prev?.total || 0,
            });
        }

        let totalLoaded = 0;
        let totalExpected = 0;
        for (const state of files.values()) {
            totalLoaded += state.loaded;
            totalExpected += state.total;
        }

        if (totalExpected > 0) {
            onProgress(Math.min(totalLoaded / totalExpected, LOAD_PROGRESS_CAP));
        }
    };
}
