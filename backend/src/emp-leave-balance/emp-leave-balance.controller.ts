import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { EmpLeaveBalanceService } from './emp-leave-balance.service';

@Controller('emp-leave-balance')
export class EmpLeaveBalanceController {
  constructor(private readonly service: EmpLeaveBalanceService) {}

  /** Returns (and initialises if needed) the leave balance for one employee. */
  @Get('employee/:id')
  getBalance(@Param('id', ParseIntPipe) id: number) {
    return this.service.getOrInit(id);
  }
}
