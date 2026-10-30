import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Domain } from './entities/domain.entity';

@Injectable()
export class DomainsService implements OnModuleInit {
  constructor(
    @InjectRepository(Domain)
    private repo: Repository<Domain>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultDomains();
  }

  private async seedDefaultDomains() {
    const count = await this.repo.count();

    if (count === 0) {
      const defaultDomains = [
        'yastatic.net',
        'vk.com',
        'ok.ru',
        'gosuslugi.ru',
        'ozon.ru',
        'max.ru',
        'vkvideo.ru',
        'rutube.ru',
        'kinopoisk.ru',
        'avito.ru',
      ];

      const entities = defaultDomains.map((name) => this.repo.create({ name }));
      await this.repo.save(entities);
    }
  }

  async create(createDomainDto: { name: string }) {
    const normalized = this.normalizeImportedDomain(createDomainDto.name);
    if (!normalized) {
      throw new BadRequestException('Некорректное доменное имя');
    }

    const exists = await this.repo
      .createQueryBuilder('domain')
      .where('LOWER(domain.name) = LOWER(:name)', { name: normalized })
      .getOne();
    if (exists) return exists;

    const domain = this.repo.create({ name: normalized });
    return this.repo.save(domain);
  }

  async addHostDomain(host: string | undefined, manager: EntityManager) {
    const name = this.normalizeImportedDomain(host || '');
    if (!name) return;
    const repo = manager.getRepository(Domain);
    const existing = await repo
      .createQueryBuilder('domain')
      .where('LOWER(domain.name) = LOWER(:name)', { name })
      .getOne();
    if (existing) return;
    await repo
      .createQueryBuilder()
      .insert()
      .into(Domain)
      .values({ name, isEnabled: true })
      .orIgnore()
      .execute();
  }

  async findAll(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [result, total] = await this.repo.findAndCount({
      take: limit,
      skip: skip,
      order: { id: 'DESC' },
    });

    return {
      data: result,
      total: total,
    };
  }

  async findAllUnpaginated(): Promise<Domain[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  findOne(id: number) {
    return this.repo.findOneBy({ id });
  }

  remove(id: number) {
    return this.repo.delete(id);
  }

  async removeAll() {
    await this.repo.clear();
    return { success: true };
  }

  async createMany(names: string[]) {
    if (!names || names.length === 0) return { count: 0 };

    const cleanNames = names
      .map((name) => this.normalizeImportedDomain(name))
      .filter((name): name is string => Boolean(name));

    const existing = await this.repo.find();
    const existingSet = new Set(existing.map((d) => d.name.toLowerCase()));

    const uniqueNewNames = [...new Set(cleanNames)].filter(
      (name) => !existingSet.has(name.toLowerCase()),
    );

    if (uniqueNewNames.length === 0) return { count: 0 };

    const entities = uniqueNewNames.map((name) => this.repo.create({ name }));
    await this.repo.save(entities);

    return { count: entities.length };
  }

  private normalizeImportedDomain(input: string) {
    let value = (input || '').replace(/^\uFEFF/, '').trim();
    if (!value) return null;

    // Skip full-line comments often used in shared lists.
    if (/^(#|;|\/\/)/.test(value)) {
      return null;
    }

    // Remove inline comments while keeping the domain token itself.
    value = value.replace(/\s+(#|;|\/\/).*$/, '').trim();
    if (!value) return null;

    value = value
      .replace(/^['"`]+|['"`]+$/g, '')
      .replace(/^[a-z]+:\/\//i, '')
      .split('/')[0]
      .split('?')[0]
      .split('#')[0]
      .trim()
      .toLowerCase();

    const hostPortMatch = value.match(/^(.+):(\d{1,5})$/);
    if (hostPortMatch) {
      value = hostPortMatch[1];
    }

    // Wildcard entries are valid for input UX, but in whitelist storage we keep root form.
    value = value
      .replace(/^\*+\./, '')
      .replace(/^\.+/, '')
      .replace(/\.+$/, '');
    if (!value) return null;

    return this.isValidDomain(value) ? value : null;
  }

  private isValidDomain(domain: string) {
    if (domain.length > 253) return false;
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(domain)) return false;

    const parts = domain.split('.');
    if (parts.length < 2) return false;

    return parts.every(
      (part) =>
        /^[a-z0-9-]{1,63}$/.test(part) &&
        !part.startsWith('-') &&
        !part.endsWith('-'),
    );
  }
}
