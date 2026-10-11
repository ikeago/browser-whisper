/**
 * Catches errors that escape every await in the worker so a model load can't hang silently.
 *
 * transformers.js 4.x fetches ONNX external data inside `new Promise(async (resolve) => {
 * const data = await getModelFile(...); resolve(...) })` (utils/model-loader.js). If that
 * download throws (e.g. `RangeError: Array buffer allocation failed` for a multi-GB
 * .onnx_data), the error becomes an *unhandled rejection* of the async executor and the outer
 * promise never settles, so `pipeline()` never resolves or rejects. The only place the error
 * is still observable is the worker's global `unhandledrejection` / `error` event.
 */

type Listener = (event: Event) => void;

export interface FatalErrorTarget {
    addEventListener(type: string, listener: Listener): void;
    removeEventListener(type: string, listener: Listener): void;
}

export interface FatalErrorTrap {
    /**
     * Races `work` against any unhandled rejection / uncaught error raised while it runs.
     * Rejects with that error (and suppresses the default console report) if one occurs first.
     */
    guard<T>(work: Promise<T>): Promise<T>;
}

export function errorFromEvent(event: Event): unknown {
    const e = event as Event & { reason?: unknown; error?: unknown; message?: string };
    if ('reason' in e) return e.reason;
    if (e.error !== undefined && e.error !== null) return e.error;
    return new Error(e.message || 'Unknown worker error');
}

export function createFatalErrorTrap(target: FatalErrorTarget): FatalErrorTrap {
    return {
        guard<T>(work: Promise<T>): Promise<T> {
            return new Promise<T>((resolve, reject) => {
                let settled = false;
                const onFatal: Listener = (event) => {
                    if (settled) return;
                    event.preventDefault?.();
                    finish();
                    reject(errorFromEvent(event));
                };
                const finish = () => {
                    settled = true;
                    target.removeEventListener('unhandledrejection', onFatal);
                    target.removeEventListener('error', onFatal);
                };
                target.addEventListener('unhandledrejection', onFatal);
                target.addEventListener('error', onFatal);
                work.then(
                    (value) => { if (!settled) { finish(); resolve(value); } },
                    (error) => { if (!settled) { finish(); reject(error); } },
                );
            });
        },
    };
}
