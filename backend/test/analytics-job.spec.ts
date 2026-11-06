import type { AnalyticsJob } from '../src/analytics/analytics.job';
import type { DatabaseService } from '../src/database/database.service';
import type { RecoService } from '../src/analytics/reco.service';

describe('Gợi ý chỉ chạy nền', () => {
  let setting: string | undefined;
  let Job: typeof import('../src/analytics/analytics.job').AnalyticsJob;
  let job: AnalyticsJob;
  beforeAll(async () => { process.env.DATABASE_URL=''; Job=(await import('../src/analytics/analytics.job')).AnalyticsJob; });
  beforeEach(() => { setting=process.env.ANALYTICS_JOB; delete process.env.ANALYTICS_JOB; jest.useFakeTimers(); });
  afterEach(() => {
    job?.onModuleDestroy(); jest.useRealTimers();
    if(setting===undefined) delete process.env.ANALYTICS_JOB; else process.env.ANALYTICS_JOB=setting;
  });
  test('tự chạy sau khởi động, chạy mỗi giờ và dừng lịch khi máy chủ đóng', async () => {
    const refreshStale=jest.fn().mockResolvedValue(2);
    job=new Job({ready:true} as DatabaseService,{refreshStale} as unknown as RecoService);
    job.onModuleInit();
    expect(refreshStale).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(10_000);
    expect(refreshStale).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(3_600_000-10_000);
    expect(refreshStale).toHaveBeenCalledTimes(2);
    job.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(3_600_000);
    expect(refreshStale).toHaveBeenCalledTimes(2);
  });
  test('không lên lịch khi tắt job hoặc database chưa sẵn sàng', async () => {
    const refreshStale=jest.fn();
    process.env.ANALYTICS_JOB='off';
    job=new Job({ready:true} as DatabaseService,{refreshStale} as unknown as RecoService);
    job.onModuleInit();
    await jest.advanceTimersByTimeAsync(3_600_000);
    expect(refreshStale).not.toHaveBeenCalled();
    delete process.env.ANALYTICS_JOB;
    job=new Job({ready:false} as DatabaseService,{refreshStale} as unknown as RecoService);
    job.onModuleInit();
    await jest.advanceTimersByTimeAsync(3_600_000);
    expect(refreshStale).not.toHaveBeenCalled();
  });
});
