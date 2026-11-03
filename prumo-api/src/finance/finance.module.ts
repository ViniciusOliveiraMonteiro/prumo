import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { IncomeController } from './income.controller.js';
import { IncomeService } from './income.service.js';
import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';

@Module({
  imports: [IdentityModule],
  controllers: [AccountController, IncomeController],
  providers: [AccountService, IncomeService],
})
export class FinanceModule {}
