/**
 * Dùng: npm run migrate -- [up|status|check|new ten_thay_doi]
 *  check  : kiểm tra file migration (không cần CSDL)
 *  status : xem migration đã chạy trên DATABASE_URL (chỉ đọc)
 *  up     : chạy migration còn thiếu (backend cũng tự chạy khi khởi động)
 *  new    : tạo file SQL đánh số tiếp theo trong database/migrations/
 */
import { openSync, writeSync, closeSync } from 'fs';
import { join } from 'path';
import { config } from '../config';
import { MigrationError, applyMigrations, loadMigrations, migrationStatus } from './migrator';

export async function main(args: string[]): Promise<number> {
  const [command = 'up', name] = args;
  try {
    const migrations = loadMigrations(config.migrationsDir);
    if (command === 'check') {
      for (const m of migrations) console.log(`OK ${m.name}`);
    } else if (command === 'new') {
      if (!name || !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(name)) {
        console.error('Đặt tên dạng add_student_badges');
        return 2;
      }
      const version = Math.max(...migrations.map((m) => m.version)) + 1;
      const file = `${String(version).padStart(3, '0')}_${name}.sql`;
      const fd = openSync(join(config.migrationsDir, file), 'wx');
      writeSync(fd, `-- ${name}\n-- Add forward-only SQL here. The runner manages the transaction.\n`);
      closeSync(fd);
      console.log(file);
    } else if (command === 'status') {
      for (const s of await migrationStatus(config.databaseUrl, config.migrationsDir)) console.log(`${s.applied ? 'APPLIED' : 'PENDING'} ${s.name}`);
    } else if (command === 'up') {
      const applied = await applyMigrations(config.databaseUrl, config.migrationsDir);
      console.log(`Database ready: ${applied.length} new migration(s)`);
    } else {
      console.error('Lệnh: up | status | check | new <ten>');
      return 2;
    }
    return 0;
  } catch (exc) {
    if (exc instanceof MigrationError) {
      console.error(exc.message);
      return 1;
    }
    throw exc;
  }
}

if (require.main === module) main(process.argv.slice(2)).then((code) => process.exit(code));
