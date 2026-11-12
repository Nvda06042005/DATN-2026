import type { PlatformJob } from '../src/platform/platform.job';

describe('Vận hành hệ thống tự động sau khi database sẵn sàng',()=>{
  let job:PlatformJob;
  let setting:string|undefined;
  beforeEach(()=>{setting=process.env.PLATFORM_JOB;delete process.env.PLATFORM_JOB;jest.useFakeTimers();});
  afterEach(()=>{job?.onModuleDestroy();jest.useRealTimers();if(setting===undefined)delete process.env.PLATFORM_JOB;else process.env.PLATFORM_JOB=setting;});

  test('khởi tạo chậm vẫn tự kiểm tra sao lưu và xử lý lịch sau một phút, dừng khi đóng',async()=>{
    process.env.DATABASE_URL='';
    const {Test}=await import('@nestjs/testing');
    const {PlatformJob}=await import('../src/platform/platform.job');
    const {DatabaseService}=await import('../src/database/database.service');
    const {NoticeService}=await import('../src/platform/notice.service');
    const {BackupService}=await import('../src/platform/backup.service');
    const {SystemService}=await import('../src/platform/system.service');
    const {SurveyService}=await import('../src/platform/survey.service');
    let begin!:()=>void,finish!:()=>void;
    const started=new Promise<void>(resolve=>{begin=resolve;});
    const pending=new Promise<void>(resolve=>{finish=resolve;});
    const db={ready:false,query:jest.fn().mockResolvedValue([]),onModuleInit:async()=>{begin();await pending;db.ready=true;}};
    const notices={dispatchDue:jest.fn().mockResolvedValue(0),automatic:jest.fn().mockResolvedValue(0)};
    const backups={autoIfDue:jest.fn().mockResolvedValue(null)};
    const system={beat:jest.fn().mockResolvedValue(undefined)};
    const module=await Test.createTestingModule({providers:[PlatformJob,{provide:DatabaseService,useValue:db},{provide:NoticeService,useValue:notices},
      {provide:BackupService,useValue:backups},{provide:SystemService,useValue:system},{provide:SurveyService,useValue:{dispatchDue:jest.fn().mockResolvedValue(0)}}]}).compile();
    job=module.get(PlatformJob);
    const initializing=module.init();await started;
    await jest.advanceTimersByTimeAsync(60_000);
    expect(backups.autoIfDue).not.toHaveBeenCalled();
    finish();await initializing;
    try{
      await jest.advanceTimersByTimeAsync(60_000);
      expect(backups.autoIfDue).toHaveBeenCalledTimes(1);
      expect(notices.dispatchDue).toHaveBeenCalledTimes(1);
      expect(system.beat).toHaveBeenCalledWith('backup',true);
      await module.close();
      await jest.advanceTimersByTimeAsync(60_000);
      expect(notices.dispatchDue).toHaveBeenCalledTimes(1);
    }finally{await module.close();}
  });
});
