import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseIntPipe, Patch, Post, Query, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { toPublic } from '../auth/auth.service';
import { generatePassword, hashPassword } from '../auth/passwords';
import { DatabaseService, DuplicateUsername, Role } from '../database/database.service';
import { accuracy, effectiveStreak } from '../student/progress';

type ManagedRole = 'teacher' | 'student';

class CreateUserDto {
  @IsString() @Length(2, 80) full_name: string;
  @IsIn(['teacher', 'student']) role: ManagedRole;
  @IsOptional() @IsString() @MaxLength(40) class_name?: string | null;
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() || undefined : value))
  @Matches(/^[a-z0-9._-]{3,32}$/)
  username?: string | null;
  @IsOptional() @IsString() @Length(6, 128) password?: string | null;
}

class BulkCreateDto {
  @IsIn(['teacher', 'student']) role: ManagedRole;
  @IsOptional() @IsString() @MaxLength(40) class_name?: string | null;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsString({ each: true }) full_names: string[];
}

class UpdateUserDto {
  @IsOptional() @IsString() @Length(2, 80) full_name?: string;
  @IsOptional() @IsString() @MaxLength(40) class_name?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

class RoleQuery {
  @IsOptional() @IsIn(['admin', 'teacher', 'student']) role?: Role;
}

/** /api/admin: chỉ quản trị viên – cấp tài khoản giáo viên/học sinh, xem toàn bộ người dùng */
@Controller('admin')
@UseGuards(AuthGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly db: DatabaseService) {}

  @Get('stats')
  async stats() {
    const users = await this.db.listUsers();
    const counts = await this.db.countByRole();
    return {
      teachers: counts.teacher, students: counts.student, admins: counts.admin,
      active: users.filter((u) => u.role !== 'admin' && u.is_active).length,
      pending_first_login: users.filter((u) => u.role !== 'admin' && u.must_change_password).length,
      classes: [...new Set(users.map((u) => u.class_name).filter((c): c is string => Boolean(c)))].sort(),
      storage: 'postgres',
    };
  }

  /** Tài khoản kèm tiến độ học tập thật (chỉ học sinh) */
  @Get('users')
  async users(@Query() query: RoleQuery) {
    const progress = await this.db.allProgress(true);
    return (await this.db.listUsers(query.role)).map((u) => {
      const p = progress.get(u.id);
      const student = u.role === 'student';
      return {
        ...toPublic(u),
        xp: student ? Number(p?.xp ?? 0) : null,
        streak: student ? effectiveStreak(p) : null,
        lessons_completed: student ? Number(p?.lessons_completed ?? 0) : null,
        accuracy: student ? accuracy(p) : null,
      };
    });
  }

  /** Cấp một tài khoản; mật khẩu tạm chỉ trả về một lần */
  @Post('users')
  async create(@Body() body: CreateUserDto) {
    const username = body.username || (await this.db.uniqueUsername(body.full_name, body.role));
    const password = body.password || generatePassword();
    try {
      const user = await this.db.createUser({
        username, full_name: body.full_name, role: body.role, class_name: body.class_name ?? null, password_hash: await hashPassword(password), must_change_password: true,
      });
      return { user: toPublic(user), password };
    } catch (exc) {
      if (exc instanceof DuplicateUsername) throw new ConflictException(`Tên đăng nhập '${username}' đã tồn tại`);
      throw exc;
    }
  }

  @Post('users/bulk')
  async bulk(@Body() body: BulkCreateDto) {
    const names = body.full_names.map((n) => n.split(/\s+/).filter(Boolean).join(' ')).filter(Boolean);
    if (!names.length) throw new UnprocessableEntityException('Danh sách tên trống');
    if (names.some((n) => n.length < 2 || n.length > 80)) throw new UnprocessableEntityException('Mỗi họ tên cần từ 2 đến 80 ký tự');
    const created = [];
    for (const fullName of names) {
      const password = generatePassword();
      const user = await this.db.createUser({
        username: await this.db.uniqueUsername(fullName, body.role), full_name: fullName, role: body.role, class_name: body.class_name ?? null,
        password_hash: await hashPassword(password), must_change_password: true,
      });
      created.push({ user: toPublic(user), password });
    }
    return created;
  }

  @Patch('users/:id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateUserDto) {
    const target = await this.db.getById(id);
    if (!target) throw new NotFoundException('Không tìm thấy tài khoản');
    if (target.role === 'admin' && body.is_active === false) throw new BadRequestException('Không thể khóa tài khoản quản trị');
    return toPublic((await this.db.updateUser(id, body))!);
  }

  @Post('users/:id/reset-password')
  @HttpCode(200)
  async resetPassword(@Param('id', ParseIntPipe) id: number) {
    const target = await this.db.getById(id);
    if (!target) throw new NotFoundException('Không tìm thấy tài khoản');
    if (target.role === 'admin') throw new BadRequestException('Quản trị viên tự đổi mật khẩu trong phần Đổi mật khẩu');
    const password = generatePassword();
    await this.db.setPassword(id, await hashPassword(password), true);
    return { user: toPublic((await this.db.getById(id))!), password };
  }

  @Delete('users/:id')
  @HttpCode(204)
  async remove(@Param('id', ParseIntPipe) id: number) {
    const target = await this.db.getById(id);
    if (!target) throw new NotFoundException('Không tìm thấy tài khoản');
    if (target.role === 'admin') throw new BadRequestException('Không thể xóa tài khoản quản trị');
    await this.db.deleteUser(id);
  }
}
