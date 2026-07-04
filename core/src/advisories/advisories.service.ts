import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';

export interface AdvisoryDto {
  id: string;
  kind: string;
  severity: string;
  title: string;
  summary: string;
  recommendation: string;
  confidence: number;
  jobId: string | null;
  queueId: string | null;
  createdAt: string;
  acknowledged: boolean;
}

type Db = NodePgDatabase<typeof schema>;

function toDto(a: schema.Advisory): AdvisoryDto {
  return {
    id: a.id,
    kind: a.kind,
    severity: a.severity,
    title: a.title,
    summary: a.summary,
    recommendation: a.recommendation,
    confidence: a.confidence,
    jobId: a.jobId,
    queueId: a.queueId,
    createdAt: a.createdAt.toISOString(),
    acknowledged: a.acknowledged,
  };
}

/**
 * Reads advisories the AI service (Phase 6) writes to the database. Empty until
 * that service runs; the core never generates advisories itself.
 */
@Injectable()
export class AdvisoriesService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async list(orgId: string): Promise<AdvisoryDto[]> {
    const rows = await this.db
      .select()
      .from(schema.advisories)
      .where(eq(schema.advisories.orgId, orgId))
      .orderBy(desc(schema.advisories.createdAt));
    return rows.map(toDto);
  }

  async acknowledge(orgId: string, id: string): Promise<AdvisoryDto> {
    const [row] = await this.db
      .update(schema.advisories)
      .set({ acknowledged: true })
      .where(
        and(
          eq(schema.advisories.id, id),
          eq(schema.advisories.orgId, orgId),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException('Advisory not found');
    return toDto(row);
  }
}
