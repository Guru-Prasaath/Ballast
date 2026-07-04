/** Response and token shapes for auth, matching the web `types/api.ts` contract. */

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Access-token expiry, ISO-8601. */
  expiresAt: string;
}

export interface UserDto {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export interface OrgDto {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface AuthSession {
  user: UserDto;
  org: OrgDto;
  tokens: AuthTokens;
}

/** Claims carried by the access token; attached to the request by the guard. */
export interface AccessTokenPayload {
  sub: string;
  orgId: string;
  role: string;
}

export interface RefreshTokenPayload {
  sub: string;
}
