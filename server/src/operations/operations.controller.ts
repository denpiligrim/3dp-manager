import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { OperationsService } from './operations.service';
import type { OperationStatus } from './operation.entity';

@Controller('operations')
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}
  @Get()
  list(
    @Query('page') page = '0',
    @Query('status') status?: OperationStatus,
    @Query('kind') kind?: string,
  ) {
    const index = Number(page);
    if (!Number.isInteger(index) || index < 0 || index > 10000)
      throw new BadRequestException('Некорректная страница');
    if (
      status &&
      ![
        'queued',
        'running',
        'success',
        'failed',
        'interrupted',
        'warning',
      ].includes(status)
    )
      throw new BadRequestException('Некорректный статус');
    if (kind && !/^[a-z.]{1,80}$/.test(kind))
      throw new BadRequestException('Некорректный процесс');
    return this.operations.list(index, status, kind);
  }
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.operations.get(id);
  }
}
