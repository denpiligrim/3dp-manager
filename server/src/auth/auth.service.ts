import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Setting } from '../settings/entities/setting.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Setting)
    private settingsRepo: Repository<Setting>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(
    login: string,
    pass: string,
  ): Promise<{ login: string } | null> {
    this.logger.debug(`Попытка входа с логином: ${login}`);

    const dbLogin = await this.settingsRepo.findOne({
      where: { key: 'admin_login' },
    });
    const dbPass = await this.settingsRepo.findOne({
      where: { key: 'admin_password' },
    });

    // Проверяем наличие учётных данных (без деталей для безопасности)
    if (!dbLogin || !dbPass) {
      this.logger.error('Учётные данные не найдены в базе данных');
      return null;
    }

    this.logger.debug(`Пользователь найден, проверяем хеш пароля...`);

    const isMatch = await bcrypt.compare(pass, dbPass.value);

    if (isMatch) {
      this.logger.debug('Пароль верный!');
      return { login: dbLogin.value };
    } else {
      this.logger.warn('Пароль неверный.');
      return null;
    }
  }

  login(user: { login: string }) {
    const payload = { username: user.login };
    this.logger.debug(`Генерация access token для пользователя: ${user.login}`);
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async changePassword(newPass: string) {
    const hash = await bcrypt.hash(newPass, 10);
    let setting = await this.settingsRepo.findOne({
      where: { key: 'admin_password' },
    });
    if (!setting) {
      setting = this.settingsRepo.create({ key: 'admin_password' });
    }
    setting.value = hash;
    await this.settingsRepo.save(setting);
    this.logger.debug('Пароль администратора изменен.');
  }

  async updateAdminProfile(login: string, password?: string) {
    let loginSetting = await this.settingsRepo.findOne({
      where: { key: 'admin_login' },
    });
    if (!loginSetting)
      loginSetting = this.settingsRepo.create({ key: 'admin_login' });

    loginSetting.value = login;
    await this.settingsRepo.save(loginSetting);

    if (password && password.trim().length > 0) {
      const hash = await bcrypt.hash(password, 10);
      let passSetting = await this.settingsRepo.findOne({
        where: { key: 'admin_password' },
      });
      if (!passSetting)
        passSetting = this.settingsRepo.create({ key: 'admin_password' });

      passSetting.value = hash;
      await this.settingsRepo.save(passSetting);
    }

    this.logger.debug(`Профиль администратора обновлен. Новый логин: ${login}`);
  }

  async seedAdmin() {
    const login = await this.settingsRepo.findOne({
      where: { key: 'admin_login' },
    });

    if (!login) {
      this.logger.debug('Инициализация администратора...');
      const envLogin = this.configService.get<string>('ADMIN_LOGIN') || 'admin';
      const envPass = this.configService.get<string>('ADMIN_PASSWORD') || 'admin';

      if (envLogin === 'admin' && envPass === 'admin') {
        this.logger.warn(
          'Используются дефолтные логин и пароль: admin / admin. Настоятельно рекомендуется настроить ADMIN_LOGIN и ADMIN_PASSWORD в окружении.',
        );
      }

      const loginSetting = this.settingsRepo.create({
        key: 'admin_login',
        value: envLogin,
      });
      await this.settingsRepo.save(loginSetting);

      const hash = await bcrypt.hash(envPass, 10);
      const passSetting = this.settingsRepo.create({
        key: 'admin_password',
        value: hash,
      });
      await this.settingsRepo.save(passSetting);

      this.logger.debug('Администратор успешно создан.');
    } else {
      this.logger.debug('Администратор уже существует в базе.');
    }
  }
}
