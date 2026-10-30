import { BackgroundTask } from '../operations/operations.decorators';
import { Controller, Post, Param, Query } from '@nestjs/common';
import { RotationService } from './rotation.service';

@Controller('rotation')
export class RotationController {
  constructor(private readonly rotationService: RotationService) {}

  @Post('rotate-all')
  @BackgroundTask('rotation.all', 'Генерация всех подписок', ['query:force'])
  async rotateAll(@Query('force') force?: string) {
    const isForce = force === 'true';
    return this.rotationService.performRotation(isForce);
  }

  @Post('rotate-one/:id')
  @BackgroundTask('rotation.one', 'Генерация подписки', [
    'param:id',
    'query:force',
  ])
  async rotateSingle(@Param('id') id: string, @Query('force') force?: string) {
    const isForce = force === 'true';
    return this.rotationService.rotateSingleSubscription(id, isForce);
  }
}
