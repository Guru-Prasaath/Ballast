import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import type { SignupDto } from './dto/signup.dto';
import type { LoginDto } from './dto/login.dto';
import { hashPassword, verifyPassword } from './password';
import { TokenService } from './token.service';
import type {
  AuthSession,
  AuthTokens,
  OrgDto,
  UserDto,
} from './auth.types';

type Db = NodePgDatabase<typeof schema>;

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'org'}-${randomBytes(3).toString('hex')}`;
}

function toUserDto(user: schema.User): UserDto {
  return {
    id: user.id,
    orgId: user.orgId,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

function toOrgDto(org: schema.Org): OrgDto {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    createdAt: org.createdAt.toISOString(),
  };
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Provisions a new org with an owner user and a working default project,
   * retry policy, and queue — so the account is usable immediately.
   */
  async signup(dto: SignupDto): Promise<AuthSession> {
    const email = dto.email.toLowerCase();
    const existing = await this.findUserByEmail(email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await hashPassword(dto.password);

    const { org, user } = await this.db.transaction(async (tx) => {
      const [org] = await tx
        .insert(schema.orgs)
        .values({ name: dto.orgName, slug: slugify(dto.orgName) })
        .returning();

      const [user] = await tx
        .insert(schema.users)
        .values({
          orgId: org.id,
          email,
          name: dto.name,
          role: 'owner',
          passwordHash,
        })
        .returning();

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

      return { org, user };
    });

    return this.session(user, org);
  }

  async login(dto: LoginDto): Promise<AuthSession> {
    const user = await this.findUserByEmail(dto.email.toLowerCase());
    if (!user || !(await verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const org = await this.getOrg(user.orgId);
    return this.session(user, org);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let sub: string;
    try {
      ({ sub } = await this.tokens.verifyRefresh(refreshToken));
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.getUser(sub);
    return this.tokens.issueTokens({
      sub: user.id,
      orgId: user.orgId,
      role: user.role,
    });
  }

  async me(userId: string): Promise<{ user: UserDto; org: OrgDto }> {
    const user = await this.getUser(userId);
    const org = await this.getOrg(user.orgId);
    return { user: toUserDto(user), org: toOrgDto(org) };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async session(
    user: schema.User,
    org: schema.Org,
  ): Promise<AuthSession> {
    const tokens = await this.tokens.issueTokens({
      sub: user.id,
      orgId: user.orgId,
      role: user.role,
    });
    return { user: toUserDto(user), org: toOrgDto(org), tokens };
  }

  private async findUserByEmail(
    email: string,
  ): Promise<schema.User | undefined> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    return user;
  }

  private async getUser(id: string): Promise<schema.User> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    if (!user) throw new UnauthorizedException('User no longer exists');
    return user;
  }

  private async getOrg(id: string): Promise<schema.Org> {
    const [org] = await this.db
      .select()
      .from(schema.orgs)
      .where(eq(schema.orgs.id, id))
      .limit(1);
    if (!org) throw new UnauthorizedException('Org no longer exists');
    return org;
  }
}
