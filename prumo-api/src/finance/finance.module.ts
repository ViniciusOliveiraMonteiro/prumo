import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { IncomeController } from './income.controller.js';
import { IncomeService } from './income.service.js';
import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';
import { ExpenseController } from './expense.controller.js';
import { ExpenseService } from './expense.service.js';

@Module({
  imports: [IdentityModule],
  controllers: [AccountController, IncomeController, ExpenseController],
  providers: [AccountService, IncomeService, ExpenseService],
})
export class FinanceModule {}
