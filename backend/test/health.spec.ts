describe('public deployment identity', () => {
  let previous: string | undefined;
  beforeEach(() => { previous = process.env.RENDER_GIT_COMMIT; });
  afterEach(() => {
    if (previous === undefined) delete process.env.RENDER_GIT_COMMIT;
    else process.env.RENDER_GIT_COMMIT = previous;
  });
  test('reports only a valid public Git commit, never arbitrary environment contents', async () => {
    const { AppController } = await import('../src/app.controller');
    const controller = new AppController({} as any);
    process.env.RENDER_GIT_COMMIT = 'a'.repeat(40);
    expect(controller.health()).toMatchObject({ status: 'healthy', commit: 'a'.repeat(40) });
    process.env.RENDER_GIT_COMMIT = 'not-a-public-commit';
    expect(controller.health()).toMatchObject({ status: 'healthy', commit: null });
  });

  test('ai_engine: cho biết trợ lý AI dùng mô hình Python hay chế độ dự phòng, kèm lý do và bộ nhớ; không lộ đường dẫn máy chủ', async () => {
    const { AppController } = await import('../src/app.controller');
    const health = new AppController({} as any).health() as { ai_engine: Record<string, unknown> };
    expect(health.ai_engine).toMatchObject({ mode: 'fallback', status: 'idle', reason: null, memory_mb: { node: expect.any(Number) } });
    expect(Object.keys(health.ai_engine).sort()).toEqual(['memory_mb', 'mode', 'python', 'ready_seconds', 'reason', 'since', 'status']);
  });
});

describe('môi trường chạy mô hình AI Python', () => {
  const keep = { ...process.env };
  afterEach(() => { process.env = { ...keep }; jest.resetModules(); });

  test('lệnh Python: AI_PYTHON trước, rồi bản cài trong backend/.ai-python, rồi python3/python của máy', async () => {
    process.env.AI_PYTHON = '/opt/py/bin/python3';
    expect((await import('../src/ai/python-runtime')).pythonCommand()).toBe('/opt/py/bin/python3');
    delete process.env.AI_PYTHON;
    jest.resetModules();
    expect(['python', 'python3']).toContain((await import('../src/ai/python-runtime')).pythonCommand().split(/[\\/]/).pop()?.replace('.exe', ''));
  });

  test('Render (máy chậm): chờ nạp mô hình lâu hơn và nạp sẵn khi khởi động; có thể chỉnh bằng biến môi trường', async () => {
    delete process.env.RENDER_SERVICE_NAME; delete process.env.RENDER;
    let rt = await import('../src/ai/python-runtime');
    expect([rt.bridgeReadyMs(), rt.bridgeRequestMs(), rt.warmOnBoot()]).toEqual([45_000, 8_000, false]);
    jest.resetModules();
    process.env.RENDER_SERVICE_NAME = 'dong-a-api';
    rt = await import('../src/ai/python-runtime');
    expect([rt.bridgeReadyMs(), rt.bridgeRequestMs(), rt.warmOnBoot()]).toEqual([240_000, 30_000, true]);
    process.env.AI_BRIDGE_WARM = '0';
    process.env.AI_BRIDGE_TIMEOUT_MS = '12000';
    expect([rt.warmOnBoot(), rt.bridgeRequestMs()]).toEqual([false, 12_000]);
  });

  test('câu trả lời của mô hình: hồ sơ học tập chỉ cho học sinh; bỏ hồ sơ khi chủ đề là mã nội bộ; độ tin cậy thấp thì nói rõ', async () => {
    const { shapePythonAnswer } = await import('../src/ai/python-runtime');
    const hint = '📊 Hồ sơ học tập ghi nhận em vừa ôn tập chủ đề **Hội nghị Diên Hồng** (Độ hiểu bài: `30%` ➔ **`32%`**).';
    const py = { answer: `Trả lời.\n\n---\n${hint}`, raw_answer: 'Trả lời.', study_hint: hint, student_mastery_summary: { topic: 'Hội nghị Diên Hồng (Đầu năm 1285)' }, confidence: 0.7, is_not_found: false };
    expect(shapePythonAnswer(py, 'student')).toMatchObject({ text: py.answer, study_hint: hint, student_mastery_summary: { topic: 'Hội nghị Diên Hồng (Đầu năm 1285)' }, low_confidence: false });
    // giáo viên: không có "em vừa ôn tập", không có độ hiểu bài
    expect(shapePythonAnswer(py, 'teacher')).toEqual({ text: 'Trả lời.', study_hint: null, student_mastery_summary: null, low_confidence: false });
    // chủ đề chỉ là mã của mô hình
    const code = { ...py, student_mastery_summary: { topic: 'CORRECTION_FALSE_PREMISE_ORANGE' } };
    expect(shapePythonAnswer(code, 'student')).toMatchObject({ text: 'Trả lời.', study_hint: null, student_mastery_summary: null });
    // độ tin cậy thấp: vẫn trả lời nhưng nói rõ cần đối chiếu; câu ngoài phạm vi thì không gắn
    const low = shapePythonAnswer({ ...py, confidence: 0.23 }, 'student');
    expect(low.low_confidence).toBe(true);
    expect(low.text).toContain('Thầy chưa chắc câu trả lời trên đúng trọng tâm');
    expect(shapePythonAnswer({ ...py, confidence: 0.2, is_not_found: true }, 'student').low_confidence).toBe(false);
    expect(shapePythonAnswer({ ...py, confidence: 0.2 }, 'teacher').text).toContain('thầy cô đối chiếu lại tư liệu');
  });

  test('trạng thái mô hình: đang nạp → sẵn sàng (mode python); dừng thì về dự phòng và ghi lý do', async () => {
    const rt = await import('../src/ai/python-runtime');
    rt.markEngine('starting', { python: '/x/python3', pid: null });
    expect(rt.engineHealth()).toMatchObject({ mode: 'fallback', status: 'starting', python: '/x/python3' });
    rt.markEngine('ready', { readyMs: 61_234 });
    expect(rt.engineHealth()).toMatchObject({ mode: 'python', status: 'ready', ready_seconds: 61.2 });
    rt.markEngine('unavailable', { reason: 'mô hình Python dừng (mã 1): ModuleNotFoundError: No module named sklearn' });
    expect(rt.engineHealth()).toMatchObject({ mode: 'fallback', status: 'unavailable', reason: expect.stringContaining('No module named sklearn') });
  });
});
