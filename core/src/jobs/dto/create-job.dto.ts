import { Type } from 'class-transformer';
import {
  IsInt,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { jobType } from '../../database/schema';

export class CreateJobDto {
  @IsUUID()
  queueId!: string;

  @IsIn(jobType.enumValues)
  type!: (typeof jobType.enumValues)[number];

  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  priority?: number;

  /** Delay eligibility until this instant. Mutually exclusive with `cron`. */
  @IsISO8601()
  @IsOptional()
  scheduledFor?: string;

  /** Cron expression for a recurring schedule. Mutually exclusive with `scheduledFor`. */
  @IsString()
  @IsOptional()
  cron?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  maxAttempts?: number;
}
