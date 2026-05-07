import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AdminKeyGuard extends AuthGuard('admin-key') {}
