import {
  IsString,
  IsArray,
  ValidateNested,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsInt,
  ValidateIf,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateBy,
  ValidationOptions,
} from 'class-validator';
import { Type } from 'class-transformer';

const PORT_OR_RANDOM = 'portOrRandom';

function IsPortOrRandom(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: PORT_OR_RANDOM,
      validator: {
        validate: (value: unknown) => {
          if (value === undefined || value === null || value === '') {
            return true;
          }
          if (value === 'random') return true;
          const port =
            typeof value === 'number'
              ? value
              : typeof value === 'string' && /^\d+$/.test(value)
                ? Number(value)
                : NaN;
          return Number.isInteger(port) && port >= 1 && port <= 65535;
        },
        defaultMessage: () =>
          'port must be "random" or an integer from 1 to 65535',
      },
    },
    validationOptions,
  );
}

export class InboundConfigDto {
  @IsString()
  type: string;

  @IsOptional()
  @IsPortOrRandom()
  port?: number | string;

  @IsString()
  @IsOptional()
  sni?: string;

  @IsString()
  @IsOptional()
  link?: string;

  @IsUUID()
  @IsOptional()
  nodeId?: string;

  @ValidateIf((dto: InboundConfigDto) => dto.relayServerId !== undefined)
  @Type(() => Number)
  @IsInt()
  relayServerId?: number;

  @IsString()
  @IsOptional()
  flag?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  certificateFile?: string;

  @IsString()
  @IsOptional()
  keyFile?: string;

  // ⬇️ НОВОЕ ПОЛЕ ДЛЯ HAPP ROUTING ⬇️
  @IsString()
  @IsOptional()
  routingProfile?: string;
}

export class CreateSubscriptionDto {
  @IsString()
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InboundConfigDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsOptional()
  inboundsConfig?: InboundConfigDto[];

  @IsBoolean()
  @IsOptional()
  isAutoRotationEnabled?: boolean;

  @IsUUID()
  @IsOptional()
  nodeId?: string;

  @ValidateIf((dto: CreateSubscriptionDto) => dto.relayServerId !== undefined)
  @Type(() => Number)
  @IsInt()
  relayServerId?: number;
}
