import {
  BackgroundTask,
  JournalAction,
} from '../operations/operations.decorators';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CreateNodeDto, UpdateNodeDto } from './dto/node.dto';
import { NodesService } from './nodes.service';

@Controller('nodes')
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  @Get()
  findAll() {
    return this.nodesService.findAll();
  }

  @Post()
  @JournalAction('node.create', 'Создание ноды')
  create(@Body() dto: CreateNodeDto) {
    return this.nodesService.create(dto);
  }

  @Post('check')
  checkPayload(@Body() dto: CreateNodeDto) {
    return this.nodesService.checkPayload(dto);
  }

  @Post('detect-location')
  detectLocation(@Body() body: { url: string }) {
    return this.nodesService.detectLocation(body.url);
  }

  @Put(':id')
  @JournalAction('node.update', 'Изменение ноды')
  update(@Param('id') id: string, @Body() dto: UpdateNodeDto) {
    return this.nodesService.update(id, dto);
  }

  @Delete(':id')
  @BackgroundTask('node.delete', 'Удаление ноды', ['param:id', 'query:force'])
  remove(@Param('id') id: string, @Query('force') force?: string) {
    const isForce = force === 'true';
    return this.nodesService.remove(id, isForce);
  }

  @Post(':id/main')
  @JournalAction('node.main', 'Смена основной ноды')
  setMain(@Param('id') id: string) {
    return this.nodesService.setMain(id);
  }

  @Post(':id/check')
  check(@Param('id') id: string) {
    return this.nodesService.checkConnection(id);
  }

  @Post('sync/main')
  @JournalAction('node.sync', 'Импорт нод')
  syncFromMain() {
    return this.nodesService.syncFromMain();
  }
}
