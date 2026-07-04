import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * Provisions a shared demo account for reviewers, with the same default
 * project/retry-policy/queue a real signup gets. Idempotent — re-running once it
 * exists is a no-op. Standalone (no Nest) so it just needs DATABASE_URL.
 *
 * Run with: npm run db:seed-demo
 */
export const DEMO_ACCOUNT = {
  orgName: 'Ballast Demo',
  name: 'Demo Reviewer',
  email: 'demo@ballast.dev',
  password: 'ballast-demo',
};

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'org'}-${randomBytes(3).toString('hex')}`;
}

async function main(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const db = drizzle(pool, { schema });

  try {
    const [existing] = await db
      .select({ orgId: schema.users.orgId })
      .from(schema.users)
      .where(eq(schema.users.email, DEMO_ACCOUNT.email))
      .limit(1);
    if (existing) {
      // eslint-disable-next-line no-console
      console.log(
        `Demo account already exists: ${DEMO_ACCOUNT.email}\n` +
          `Run its worker with: WORKER_ORG_ID=${existing.orgId}`,
      );
      return;
    }

    const passwordHash = await bcrypt.hash(DEMO_ACCOUNT.password, 10);

    const orgId = await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(schema.orgs)
        .values({ name: DEMO_ACCOUNT.orgName, slug: slugify(DEMO_ACCOUNT.orgName) })
        .returning();
      await tx.insert(schema.users).values({
        orgId: org.id,
        email: DEMO_ACCOUNT.email,
        name: DEMO_ACCOUNT.name,
        role: 'owner',
        passwordHash,
      });
      const [project] = await tx
        .insert(schema.projects)
        .values({ orgId: org.id, name: 'Default', slug: 'default' })
        .returning();
      const [policy] = await tx
        .insert(schema.retryPolicies)
        .values({ projectId: project.id, name: 'Standard exponential' })
        .returning();
      await tx.insert(schema.queues).values({
        projectId: project.id,
        name: 'default',
        retryPolicyId: policy.id,
      });
      return org.id;
    });

    // eslint-disable-next-line no-console
    console.log(
      `Demo account ready: ${DEMO_ACCOUNT.email} / ${DEMO_ACCOUNT.password}\n` +
        `Run its worker with: WORKER_ORG_ID=${orgId}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seeding demo account failed:', err);
  process.exit(1);
});
