import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { FactualRosterEmployeeService } from './factual-roster-employee.service';
import { AddFactualRosterEmployeeDto } from './dto/add-factual-roster-employee.dto';

@Controller('factual-roster-employees')
export class FactualRosterEmployeeController {
  constructor(private readonly service: FactualRosterEmployeeService) {}

  @Post()
  add(@Body() dto: AddFactualRosterEmployeeDto) {
    return this.service.add(dto);
  }

  @Get('select-employees')
  selectEmployees(
    @Query('serviceProviderID') serviceProviderID: string,
    @Query('companyID') companyID: string,
    @Query('branchesID') branchesID: string,
    @Query('departmentID') departmentID: string,
    @Query('designationID') designationID?: string,
  ) {
    return this.service.listEmployeesForSelection({
      serviceProviderID: +serviceProviderID,
      companyID: +companyID,
      branchesID: +branchesID,
      departmentID: +departmentID,
      designationID: designationID ? +designationID : undefined,
    });
  }

  @Get('by-roster/:factualRosterID')
  listByRoster(@Param('factualRosterID', ParseIntPipe) factualRosterID: number) {
    return this.service.listByRoster(factualRosterID);
  }

  @Get('by-employee/:employeeID')
  findByEmployeeId(@Param('employeeID', ParseIntPipe) employeeID: number) {
    return this.service.findByEmployeeId(employeeID);
  }

  @Post('attach-all')
  attachAll(@Body() body: { factualRosterID: number; employeeIDs: number[] }) {
    return this.service.attachAllToRoster(body.factualRosterID, body.employeeIDs);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
