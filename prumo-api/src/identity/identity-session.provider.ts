import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  SessionCookieProvider,
  type SessionRecord,
} from '@nestjs/authentication';
import { IdentityUserRepository } from './identity-user.repository.js';
import type { IdentityUser } from './identity-user.repository.js';

@Injectable()
export class IdentitySessionProvider extends SessionCookieProvider<IdentityUser> {
  constructor(
    private readonly users: IdentityUserRepository,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this);
  }

  protected validate(session: SessionRecord): Promise<IdentityUser | null> {
    return this.users.findActiveById(session.userId);
  }
}
