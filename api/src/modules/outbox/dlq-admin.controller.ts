import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma-client';

import { AdminJwtAuthGuard } from '@common/guards/admin-jwt-auth.guard';
import { UserClsGuard } from '@common/guards/user-cls.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { DlqService } from '@modules/outbox/dlq.service';
import { ListDlqEventsQueryDto } from '@modules/outbox/dto/list-dlq-events-query.dto';

@ApiTags('Admin — DLQ')
@Controller('admin/dlq')
@UseGuards(AdminJwtAuthGuard, UserClsGuard, RolesGuard)
@Roles(UserRole.SYSTEM_ADMIN, UserRole.TENANT_ADMIN)
@ApiForbiddenResponse({ description: 'SYSTEM_ADMIN or TENANT_ADMIN role required' })
export class DlqAdminController {
  constructor(private readonly dlqService: DlqService) {}

  @Get('events')
  @ApiOperation({
    summary:
      'List dead-lettered events — TENANT_ADMIN sees only their own tenant, SYSTEM_ADMIN sees every tenant',
  })
  @ApiOkResponse({ description: 'Cursor-paginated DLQ events with nextCursor' })
  listEvents(@Query() query: ListDlqEventsQueryDto) {
    return this.dlqService.listEvents(query);
  }

  @Post('events/:id/replay')
  @ApiOperation({
    summary: 'Re-publish a dead-lettered event back onto its working queue',
  })
  replayEvent(@Param('id') id: string) {
    return this.dlqService.replayEvent(id);
  }
}
