import {
    ConflictException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from "@nestjs/common";
import { TenantRepository } from "@modules/tenant/tenant.repository";
import { CreateTenantDto, UpdateTenantDto } from "@modules/tenant/dto";
import { generateApiKey, hashApiKey } from "@shared/utils/api-key.util";
import { CreateTenantResult, RotateTenantApiKeyResult } from "@modules/tenant/types/tenant.types";
import { Prisma, Tenant } from "@prisma/client";

@Injectable()
export class TenantService {
    constructor(
        private readonly tenantRepository: TenantRepository,
    ) {}

    async createSingleTenant(dto: CreateTenantDto): Promise<CreateTenantResult> {
        const plaintextApiKey = generateApiKey();
        const apiKeyHash = await hashApiKey(plaintextApiKey);

        try {
            const tenant = await this.tenantRepository.createSingleTenant({
                name: dto.name,
                apiKeyHash,
                webhookUrl: dto.webhookUrl,
                webhookSecret: dto.webhookSecret,
            });

            return { tenant, apiKey: plaintextApiKey };
        } catch (error) {
            // P2002: unique constraint violation on apiKeyHash — astronomically rare
            // but if it happens, fail fast rather than silently storing a duplicate
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new InternalServerErrorException(
                    'API key generation collision. Please retry.',
                );
            }
            throw error;
        }
    }

    async updateSingleTenant(id: string, dto: UpdateTenantDto): Promise<Tenant> {
        try {
            return await this.tenantRepository.updateSingleTenant(id, dto);
        } catch (error) {
            // P2025: record not found — the id+tenantId where clause matched nothing
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new NotFoundException(`Tenant ${id} not found`);
            }
            throw error;
        }
    }

    async softDeleteSingleTenant(id: string): Promise<void> {
        const tenant = await this.tenantRepository.findSingleTenant(id);

        if (!tenant) {
            throw new NotFoundException(`Tenant ${id} not found`);
        }

        if (!tenant.isActive) {
            throw new ConflictException('Tenant is already deactivated');
        }

        await this.tenantRepository.softDeleteSingleTenant(id);
    }

    async rotateTenantApiKey(id: string): Promise<RotateTenantApiKeyResult> {
        const tenant = await this.tenantRepository.findSingleTenant(id);

        if (!tenant) {
            throw new NotFoundException(`Tenant ${id} not found`);
        }

        if(!tenant.isActive){
            throw new ConflictException('Cannot rotate API key for an inactive tenant');
        }

        const newPlaintextApiKey = generateApiKey();
        const newApiKeyHash = await hashApiKey(newPlaintextApiKey);

        try {
            await this.tenantRepository.rotateApiKey(id, newApiKeyHash);
            return {apiKey: newPlaintextApiKey}
        }catch (error) {
            if(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'){
                throw new InternalServerErrorException('API key generation collision. Please retry.');
            }
            throw error;
        
        }
    }
}