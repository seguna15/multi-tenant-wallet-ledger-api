import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { JwtPayload, RequestUser } from "@modules/auth/types/auth.types";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt'){

    
    constructor(config: ConfigService) {
        const secret = config.get<string>('ACCESS_TOKEN_SECRET');
        if (!secret) throw new Error('ACCESS_TOKEN_SECRET is not defined');

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: secret,
        });
    }

    async validate(payload: JwtPayload): Promise<RequestUser> {
        if(!payload.sub || !payload.tenantId) {
            throw new UnauthorizedException('Invalid or malformed token');
        }

        
        // The returned object is assigned to req.user used by UserClsGuard to populate CLS context
        return {
            userId: payload.sub,
            email: payload.email,
            tenantId: payload.tenantId,
        };
    }
}