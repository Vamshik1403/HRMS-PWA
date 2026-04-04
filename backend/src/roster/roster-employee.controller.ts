import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { RosterEmployeeService } from './roster-employee.service';
import { AddRosterEmployeeDto } from './dto/add-roster-employee.dto';

@Controller('roster-employees')
export class RosterEmployeeController {
  constructor(private readonly service: RosterEmployeeService) {}

  @Post()
  add(@Body() dto: AddRosterEmployeeDto) {
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

  @Get('by-roster/:rosterID')
  listByRoster(@Param('rosterID') rosterID: string) {
    return this.service.listByRoster(+rosterID);
  }

  // ✅ ADD THIS: Get roster employee by employee ID
  @Get('by-employee/:employeeID')
  findByEmployeeId(@Param('employeeID') employeeID: string) {
    return this.service.findByEmployeeId(+employeeID);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }

  @Post('attach-all')
  attachAll(@Body() body: any) {
    return this.service.attachAllEmployeesToRoster(body.rosterID, {
      serviceProviderID: body.serviceProviderID,
      companyID: body.companyID,
      branchesID: body.branchesID,
      departmentID: body.departmentID,
      designationID: body.designationID,
    });
  }
}