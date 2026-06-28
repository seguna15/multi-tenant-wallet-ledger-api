import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Query,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
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
import { TransferService } from '@modules/transfer/transfer.service';
import { ExportTenantTransfersQueryDto, ListTransfersQueryDto } from '@modules/transfer/dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { filter, fromEvent, map, merge, Observable, takeUntil, timer } from 'rxjs';

@ApiTags('Admin — Transfers')
@Controller('admin/transfers')
@UseGuards(AdminJwtAuthGuard, UserClsGuard, RolesGuard)
@Roles(UserRole.TENANT_ADMIN)
@ApiForbiddenResponse({ description: 'TENANT_ADMIN role required' })
export class TransferAdminController {
  constructor(
    private readonly transferService: TransferService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'List every transfer across the tenant, filterable by status, date range, and account number — used by the dashboard to investigate customer complaints',
  })
  @ApiOkResponse({ description: 'Cursor-paginated transfers with nextCursor' })
  listTransfers(@Query() query: ListTransfersQueryDto) {
    return this.transferService.listTransfersForTenant(query);
  }

  @Sse('stream/activity')
  @ApiOperation({
    summary:
      'Stream live status events for every transfer in the tenant — powers the admin activity feed',
  })
  streamActivity(
    @CurrentUser('tenantId') tenantId: string,
  ): Observable<MessageEvent> {
    // Safety timeout — close stream after 5 min regardless
    const timeout$ = timer(5 * 60 * 1000);

    const events$ = fromEvent(this.eventEmitter, 'transfer.status').pipe(
      filter((payload: any) => payload.tenantId === tenantId),
      map((payload): MessageEvent => ({ data: payload })),
      takeUntil(timeout$),
    );

    // Keep-alive ping every 15s so proxies don't kill the connection
    const ping$ = timer(0, 15_000).pipe(
      map((): MessageEvent => ({ data: { type: 'ping' } })),
      takeUntil(timeout$),
    );

    return merge(events$, ping$);
  }

  @Get('export')
  @ApiOperation({
    summary:
      'Stream a CSV export of every transfer in the tenant, filterable by status, date range, and account number',
  })
  @ApiOkResponse({ description: 'text/csv stream of matching transfers' })
  exportTenantTransfers(
    @Query() query: ExportTenantTransfersQueryDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="transfers.csv"',
    );
    res.setHeader('Transfer-Encoding', 'chunked');

    const abortController = new AbortController();
    res.once('close', () => abortController.abort());

    const csvStream = this.transferService.streamTenantTransfersExport(
      query,
      abortController.signal,
    );

    csvStream.on('error', () => res.destroy());
    csvStream.pipe(res);
  }
}
