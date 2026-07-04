import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/auth.types';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { ListJobsQuery } from './dto/list-jobs.query';
import type { JobAttemptDto, JobDto, Paginated } from './job.types';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateJobDto,
  ): Promise<JobDto> {
    return this.jobs.create(user.orgId, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListJobsQuery,
  ): Promise<Paginated<JobDto>> {
    return this.jobs.list(user.orgId, query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<JobDto> {
    return this.jobs.get(user.orgId, id);
  }

  @Get(':id/attempts')
  attempts(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<JobAttemptDto[]> {
    return this.jobs.getAttempts(user.orgId, id);
  }

  @Post(':id/retry')
  @HttpCode(200)
  retry(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<JobDto> {
    return this.jobs.retry(user.orgId, id);
  }
}
