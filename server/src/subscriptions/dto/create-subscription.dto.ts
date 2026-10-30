import {
  IsString,
  IsIn,
  MaxLength,
  IsUrl,
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

  @IsOptional()
  @IsIn(['chrome', 'firefox', 'safari', 'ios', 'android', 'edge', '360', 'qq', 'random', 'randomized', 'randomizednoalpn', 'unsafe'])
  fingerprint?: string;

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

  @IsString()
  @IsOptional()
  routingProfile?: string;
}

export class CreateSubscriptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;

  @IsOptional()
  @ValidateIf((_dto, value: unknown) => value !== '')
  @IsUrl({
    protocols: ['http', 'https', 'tg'],
    require_protocol: true,
    require_tld: false,
  })
  @MaxLength(2048)
  supportUrl?: string;

  @IsOptional()
  @ValidateIf((_dto, value: unknown) => value !== '')
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
  })
  @MaxLength(2048)
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  clientId?: string;

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
