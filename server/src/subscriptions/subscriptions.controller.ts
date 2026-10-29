import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Put,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  findAll() {
    return this.subscriptionsService.findAll();
  }

  @Post()
  create(@Body() createSubscriptionDto: CreateSubscriptionDto) {
    return this.subscriptionsService.create(createSubscriptionDto);
  }

  @Put('bulk-auto-rotation')
  @HttpCode(HttpStatus.OK)
  async bulkUpdateAutoRotation(
    @Body() body: { subscriptionIds: string[]; enabled: boolean },
  ) {
    const { subscriptionIds, enabled } = body;

    if (!Array.isArray(subscriptionIds)) {
      return {
        success: false,
        message: 'subscriptionIds должен быть массивом',
      };
    }

    if (subscriptionIds.length > 100) {
      return {
        success: false,
        message: 'Максимум 100 ID за раз',
      };
    }

    const updated: string[] = [];
    const notFound: string[] = [];

    for (const id of subscriptionIds) {
      const result = await this.subscriptionsService.update(id, {
        isAutoRotationEnabled: enabled,
      });

      if (result) {
        updated.push(id);
      } else {
        notFound.push(id);
      }
    }

    return {
      success: true,
      message: `Обновлено ${updated.length} подписок`,
      updatedCount: updated.length,
      notFound: notFound.length > 0 ? notFound : undefined,
    };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
  ) {
    const result = await this.subscriptionsService.update(
      id,
      updateSubscriptionDto,
    );
    if (!result) {
      throw new NotFoundException(`Подписка ${id} не найдена`);
    }
    return result;
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('force') force?: string) {
    return this.subscriptionsService.remove(id, force === 'true');
  }
}
