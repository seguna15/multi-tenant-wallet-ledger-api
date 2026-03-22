import { Global, Module } from "@nestjs/common";
import { PrismaService } from "@common/database/prisma.service";


@Global() // prisma service available globally without re-importing the module
@Module({
    providers: [PrismaService],
    exports: [PrismaService],
})
export class PrismaModule {}