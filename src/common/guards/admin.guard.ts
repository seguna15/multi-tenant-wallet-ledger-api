import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantStore } from '@common/cls/tenant-store.interface';
import { ClsService } from 'nestjs-cls';
import { verifyApiKey } from '@shared/utils/api-key.util';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly clsService: ClsService<TenantStore>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const providedKey = request.headers['x-admin-key'];
    const adminKey = this.configService.get<string>('ADMIN_API_KEY_HASH');
    
    if (!adminKey || !providedKey || !verifyApiKey(providedKey, adminKey)) {
      throw new UnauthorizedException('Invalid or missing admin key');
    }

    this.clsService.set('isGlobalAdmin', true);
    return true;
  }
}
