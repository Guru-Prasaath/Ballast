import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { jobStatus, jobType } from '../../database/schema';

export class ListJobsQuery {
  @IsIn(jobStatus.enumValues)
  @IsOptional()
  status?: (typeof jobStatus.enumValues)[number];

  @IsIn(jobType.enumValues)
  @IsOptional()
  type?: (typeof jobType.enumValues)[number];

  @IsUUID()
  @IsOptional()
  queueId?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = 25;
}
