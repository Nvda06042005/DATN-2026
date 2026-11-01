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
    expect(controller.health()).toEqual({ status: 'healthy', commit: 'a'.repeat(40) });
    process.env.RENDER_GIT_COMMIT = 'not-a-public-commit';
    expect(controller.health()).toEqual({ status: 'healthy', commit: null });
  });
});
