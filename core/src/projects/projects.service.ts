import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';

export interface ProjectDto {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  createdAt: string;
}

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class ProjectsService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async list(orgId: string): Promise<ProjectDto[]> {
    const rows = await this.db
      .select({
        id: schema.projects.id,
        orgId: schema.projects.orgId,
        name: schema.projects.name,
        slug: schema.projects.slug,
        createdAt: schema.projects.createdAt,
      })
      .from(schema.projects)
      .where(eq(schema.projects.orgId, orgId));

    return rows.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
    }));
  }
}
