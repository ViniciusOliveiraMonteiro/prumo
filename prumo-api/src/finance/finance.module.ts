import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { IncomeController } from './income.controller.js';
import { IncomeService } from './income.service.js';
import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';
import { ExpenseController } from './expense.controller.js';
import { ExpenseService } from './expense.service.js';
import { TransferController } from './transfer.controller.js';
import { TransferService } from './transfer.service.js';
import { OpeningBalanceRevisionController } from './opening-balance-revision.controller.js';
import { OpeningBalanceRevisionService } from './opening-balance-revision.service.js';

@Module({
  imports: [IdentityModule],
  controllers: [
    AccountController,
    IncomeController,
    ExpenseController,
    TransferController,
    OpeningBalanceRevisionController,
  ],
  providers: [
    AccountService,
    IncomeService,
    ExpenseService,
    TransferService,
    OpeningBalanceRevisionService,
  ],
})
export class FinanceModule {}
