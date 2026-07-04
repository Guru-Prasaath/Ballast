import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FleetService, WorkerDto } from './fleet.service';

@Controller('workers')
@UseGuards(JwtAuthGuard)
export class FleetController {
  constructor(private readonly fleet: FleetService) {}

  @Get()
  list(): Promise<WorkerDto[]> {
    return this.fleet.list();
  }
}
