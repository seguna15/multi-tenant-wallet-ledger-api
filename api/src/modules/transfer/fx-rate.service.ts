import { Injectable, Logger } from '@nestjs/common';
import { Currency } from '@prisma-client';
import { RATE_TABLE } from '@shared/data/currency-table';



@Injectable()
export class FxRateService {
  private readonly logger = new Logger(FxRateService.name);

  getRate(from: Currency, to: Currency): string {
    if (from === to) return '1';

    const key = `${from}:${to}`;
    const rate = RATE_TABLE[key];

    if (!rate) {
      this.logger.warn({ msg: 'no FX rate found, defaulting to 1', from, to });
      return '1';
    }

    this.logger.log({ msg: 'FX rate snapshot', from, to, rate });
    return rate;
  }
}
