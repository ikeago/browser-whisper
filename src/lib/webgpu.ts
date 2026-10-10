/** True when navigator.gpu exists and returns a GPU adapter. */
export async function hasWebGPUAdapter(
    gpu: { requestAdapter(options?: unknown): Promise<unknown> } | undefined =
        (globalThis.navigator as unknown as { gpu?: { requestAdapter(options?: unknown): Promise<unknown> } } | undefined)?.gpu,
): Promise<boolean> {
    if (!gpu) return false;
    try {
        return (await gpu.requestAdapter({ powerPreference: 'high-performance' })) != null;
    } catch {
        return false;
    }
}
