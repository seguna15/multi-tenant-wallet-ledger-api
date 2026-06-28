import { SetMetadata } from '@nestjs/common';

export const SKIP_API_KEY_KEY = 'skipApiKey';

// Lets a route bypass ApiKeyGuard — for endpoints (e.g. SSE) that browsers
// can't attach an x-api-key header to. TenantClsGuard and UserClsGuard fall
// back to seeding tenantId from the JWT in this case.
export const SkipApiKey = () => SetMetadata(SKIP_API_KEY_KEY, true);
