import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  Sse,
  MessageEvent,
  UseGuards,
  Query,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Response } from 'express';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '@common/guards/api-key.guard';
import { TenantClsGuard } from '@common/guards/tenant-cls.guard';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { UserClsGuard } from '@common/guards/user-cls.guard';
import { CreateTransferDto, ExportTransfersQueryDto, ListTransfersQueryDto } from '@modules/transfer/dto';
import { TransferService } from '@modules/transfer/transfer.service';
import {  fromEvent, Observable, timer, merge, from } from 'rxjs';
import { filter, map, mergeMap, takeUntil } from 'rxjs/operators';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { SkipApiKey } from '@common/decorators/skip-api-key.decorator';
import { RateLimit } from '@common/decorators/rate-limit.decorator';
import { IdempotencyKeyGuard } from '@common/guards/idempotency-key.guard';


@ApiTags('Transfers')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard, TenantClsGuard)
@Controller('transfers')
export class TransferController {
  constructor(
    private readonly transferService: TransferService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, UserClsGuard, IdempotencyKeyGuard)
  @RateLimit({ limit: 10, windowMs: 60_000 })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Initiate a transfer between two tenant-owned wallets',
  })
  @ApiCreatedResponse({
    description: 'Transfer created with INITIATED status + outbox event',
  })
  createTransfer(
    @Body() dto: CreateTransferDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.transferService.createTransfer({ ...dto, idempotencyKey });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, UserClsGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'List paginated transfers for wallets the authenticated user owns, filterable by status and date range',
  })
  @ApiOkResponse({ description: 'Cursor-paginated transfers with nextCursor' })
  listMyTransfers(@Query() query: ListTransfersQueryDto) {
    return this.transferService.listMyTransfers(query);
  }

  @Sse('stream/activity')
  @SkipApiKey()
  @UseGuards(JwtAuthGuard, UserClsGuard)
  @ApiOperation({
    summary:
      "Stream live status events for transfers touching the authenticated user's wallets — powers the activity feed",
  })
  streamActivity(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
  ): Observable<MessageEvent> {
    // Safety timeout — close stream after 5 min regardless
    const timeout$ = timer(5 * 60 * 1000);

    const events$ = fromEvent(this.eventEmitter, 'transfer.status').pipe(
      filter((payload: any) => payload.tenantId === tenantId),
      mergeMap((payload: any) =>
        from(
          this.transferService.isTransferVisibleToUser(
            payload.transferId,
            tenantId,
            userId,
          ),
        ).pipe(
          filter(Boolean),
          map((): MessageEvent => ({ data: payload })),
        ),
      ),
      takeUntil(timeout$),
    );

    // Keep-alive ping every 15s so proxies don't kill the connection
    const ping$ = timer(0, 15_000).pipe(
      map((): MessageEvent => ({ data: { type: 'ping' } })),
      takeUntil(timeout$),
    );

    return merge(events$, ping$);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, UserClsGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fetch transfer by ID with current status' })
  @ApiOkResponse({ description: 'Transfer details' })
  getTransfer(@Param('id') id: string) {
    return this.transferService.getTransfer(id);
  }

  @Sse(':id/stream')
  @SkipApiKey()
  @UseGuards(JwtAuthGuard, UserClsGuard)
  streamTransfer(
    @Param('id') id: string,
    @Res() res: Response,
  ): Observable<MessageEvent> {
    // Safety timeout — close stream after 5 min regardless
    const timeout$ = timer(5 * 60 * 1000);

    const events$ = fromEvent(this.eventEmitter, 'transfer.status').pipe(
      filter((payload: any) => payload.transferId === id),
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
  @UseGuards(JwtAuthGuard, UserClsGuard)
  @ApiOperation({
    summary:
      "Stream a CSV export of the authenticated user's transfers, filterable by status and date range",
  })
  @ApiOkResponse({ description: 'text/csv stream of matching transfers' })
  exportMyTransfers(
    @Query() query: ExportTransfersQueryDto,
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

    const csvStream = this.transferService.streamMyTransfersExport(
      query,
      abortController.signal,
    );

    csvStream.on('error', () => res.destroy());
    csvStream.pipe(res);
  }
}
