import { describe, expect, it } from 'bun:test';
import { createFatalErrorTrap, errorFromEvent } from '../lib/fatal-errors.js';
import { BrowserWhisperError, ModelLoadError, readyError } from '../errors.js';

class FakeRejectionEvent extends Event {
    constructor(readonly reason: unknown) { super('unhandledrejection', { cancelable: true }); }
}
class FakeErrorEvent extends Event {
    constructor(readonly error: unknown, readonly message = '') { super('error', { cancelable: true }); }
}

const never = <T>() => new Promise<T>(() => {});

describe('createFatalErrorTrap', () => {
    it('resolves with the work result when nothing escapes', async () => {
        const trap = createFatalErrorTrap(new EventTarget());
        expect(await trap.guard(Promise.resolve(42))).toBe(42);
    });

    it('passes through ordinary rejections', async () => {
        const trap = createFatalErrorTrap(new EventTarget());
        await expect(trap.guard(Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    });

    it('rejects a hung load when an unhandled rejection fires (the silent 99% hang)', async () => {
        const target = new EventTarget();
        const trap = createFatalErrorTrap(target);
        const guarded = trap.guard(never());
        const event = new FakeRejectionEvent(new RangeError('Array buffer allocation failed'));
        target.dispatchEvent(event);
        await expect(guarded).rejects.toThrow('Array buffer allocation failed');
        expect(event.defaultPrevented).toBe(true);
    });

    it('rejects on an uncaught worker error event', async () => {
        const target = new EventTarget();
        const trap = createFatalErrorTrap(target);
        const guarded = trap.guard(never());
        target.dispatchEvent(new FakeErrorEvent(new Error('worker blew up')));
        await expect(guarded).rejects.toThrow('worker blew up');
    });

    it('stops listening once the work settles', async () => {
        const target = new EventTarget();
        const trap = createFatalErrorTrap(target);
        await trap.guard(Promise.resolve('ok'));
        const event = new FakeRejectionEvent(new Error('later'));
        target.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
    });
});

describe('errorFromEvent', () => {
    it('falls back to the event message', () => {
        const err = errorFromEvent(new FakeErrorEvent(undefined, 'script error')) as Error;
        expect(err.message).toBe('script error');
    });
});

describe('readyError', () => {
    it('returns a ModelLoadError for load failures', () => {
        const err = readyError({ message: 'Array buffer allocation failed', loadModelId: 'org/model' });
        expect(err).toBeInstanceOf(ModelLoadError);
        expect(err.message).toBe('Failed to load model "org/model". Array buffer allocation failed');
    });

    it('returns a plain BrowserWhisperError otherwise', () => {
        const err = readyError({ message: 'x' });
        expect(err).toBeInstanceOf(BrowserWhisperError);
        expect(err).not.toBeInstanceOf(ModelLoadError);
    });
});
