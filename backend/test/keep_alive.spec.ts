/**
 * Giữ máy chủ Render thức (18/11/2026): chỉ chạy khi có RENDER_EXTERNAL_URL (Render tự đặt), tự gọi /api/health?warm=ai sau 1 phút rồi mỗi 10 phút;
 * KEEP_ALIVE=off thì tắt; lỗi mạng không làm dừng máy chủ.
 */
describe('KeepAlive – máy chủ tự gọi chính mình để không ngủ', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; jest.useRealTimers(); delete process.env.RENDER_EXTERNAL_URL; delete process.env.KEEP_ALIVE; });

  test('địa chỉ: chỉ https hợp lệ của Render; tắt bằng KEEP_ALIVE=off', async () => {
    const { keepAliveUrl } = await import('../src/platform/keep-alive');
    expect(keepAliveUrl({})).toBeNull();
    expect(keepAliveUrl({ RENDER_EXTERNAL_URL: 'https://dong-a-api.onrender.com/' })).toBe('https://dong-a-api.onrender.com/api/health?warm=ai');
    expect(keepAliveUrl({ RENDER_EXTERNAL_URL: 'https://dong-a-api.onrender.com', KEEP_ALIVE: 'off' })).toBeNull();
    expect(keepAliveUrl({ RENDER_EXTERNAL_URL: 'http://dong-a-api.onrender.com' })).toBeNull();
    expect(keepAliveUrl({ RENDER_EXTERNAL_URL: 'https://x.onrender.com/evil?y=1' })).toBeNull();
  });

  test('trên Render: gọi lần đầu sau 1 phút rồi mỗi 10 phút; dừng khi tắt máy chủ; không chạy khi thiếu RENDER_EXTERNAL_URL', async () => {
    jest.useFakeTimers();
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: any) => { calls.push(String(url)); return { status: 200 } as Response; }) as any;
    const { KeepAlive } = await import('../src/platform/keep-alive');

    const off = new KeepAlive();
    off.onApplicationBootstrap();
    jest.advanceTimersByTime(30 * 60_000);
    expect(calls).toHaveLength(0);

    process.env.RENDER_EXTERNAL_URL = 'https://dong-a-api.onrender.com';
    const on = new KeepAlive();
    on.onApplicationBootstrap();
    jest.advanceTimersByTime(59_000);
    expect(calls).toHaveLength(0);
    jest.advanceTimersByTime(1_000);
    expect(calls).toEqual(['https://dong-a-api.onrender.com/api/health?warm=ai']);
    await Promise.resolve(); await Promise.resolve();
    const { keepAliveState } = await import('../src/platform/keep-alive');
    expect(keepAliveState()).toMatchObject({ enabled: true, last_status: 200 });
    jest.advanceTimersByTime(10 * 60_000);
    expect(calls).toHaveLength(2); // phút 1 (lần đầu) và phút 10 (nhịp 10 phút tính từ lúc khởi động)
    jest.advanceTimersByTime(10 * 60_000);
    expect(calls).toHaveLength(3); // phút 20
    on.onModuleDestroy();
    jest.advanceTimersByTime(60 * 60_000);
    expect(calls).toHaveLength(3);
  });

  test('lỗi mạng chỉ ghi cảnh báo, không ném lỗi', async () => {
    global.fetch = jest.fn(async () => { throw new Error('ECONNRESET'); }) as any;
    const { KeepAlive } = await import('../src/platform/keep-alive');
    await expect(new KeepAlive().ping('https://dong-a-api.onrender.com/api/health?warm=ai')).resolves.toBeNull();
  });
});
