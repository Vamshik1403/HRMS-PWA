import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ContractorPayoutService } from './contractor-payout.service';
import { CreateContractorPayoutDto } from './dto/create-contractor-payout.dto';
import { UpdateContractorPayoutDto } from './dto/update-contractor-payout.dto';

@Controller('contractor-payout')
export class ContractorPayoutController {
  constructor(private readonly service: ContractorPayoutService) {}

  @Post()
  create(@Body() dto: CreateContractorPayoutDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  // --- Cascading dropdown endpoints (declared before :id to prevent shadowing) ---

  @Get('filter/branches')
  getBranches(@Query('contractorID') contractorID: string) {
    return this.service.getBranchesForContractor(+contractorID);
  }

  @Get('filter/departments')
  getDepartments(
    @Query('contractorID') contractorID: string,
    @Query('branchID') branchID: string,
  ) {
    return this.service.getDepartmentsForContractorBranch(+contractorID, +branchID);
  }

  @Get('filter/designations')
  getDesignations(
    @Query('contractorID') contractorID: string,
    @Query('branchID') branchID: string,
    @Query('departmentIDs') departmentIDs: string,
  ) {
    const deptIDs = departmentIDs
      ? departmentIDs.split(',').map(Number).filter(Boolean)
      : [];
    return this.service.getDesignationsForContractorBranchDepts(
      +contractorID,
      +branchID,
      deptIDs,
    );
  }

  @Get('filter/employees')
  getEmployees(
    @Query('contractorID') contractorID: string,
    @Query('branchID') branchID: string,
    @Query('departmentIDs') departmentIDs: string,
    @Query('designationIDs') designationIDs: string,
  ) {
    const deptIDs = departmentIDs
      ? departmentIDs.split(',').map(Number).filter(Boolean)
      : [];
    const desigIDs = designationIDs
      ? designationIDs.split(',').map(Number).filter(Boolean)
      : [];
    return this.service.getEmployeesForFilters(
      +contractorID,
      +branchID,
      deptIDs,
      desigIDs,
    );
  }

  @Get('filter/workshifts')
  getWorkshifts(
    @Query('contractorID') contractorID: string,
    @Query('branchID') branchID: string,
    @Query('departmentIDs') departmentIDs: string,
    @Query('designationIDs') designationIDs: string,
    @Query('employeeIDs') employeeIDs: string,
  ) {
    const deptIDs = departmentIDs
      ? departmentIDs.split(',').map(Number).filter(Boolean)
      : [];
    const desigIDs = designationIDs
      ? designationIDs.split(',').map(Number).filter(Boolean)
      : [];
    const empIDs = employeeIDs
      ? employeeIDs.split(',').map(Number).filter(Boolean)
      : [];
    return this.service.getWorkshiftsForFilters(
      +contractorID,
      +branchID,
      deptIDs,
      desigIDs,
      empIDs,
    );
  }

  @Get('filter/rate-card')
  getRateCard(
    @Query('contractorID') contractorID: string,
    @Query('branchID') branchID: string,
    @Query('departmentIDs') departmentIDs: string,
    @Query('designationIDs') designationIDs: string,
    @Query('workshiftIDs') workshiftIDs: string,
  ) {
    const deptIDs = departmentIDs
      ? departmentIDs.split(',').map(Number).filter(Boolean)
      : [];
    const desigIDs = designationIDs
      ? designationIDs.split(',').map(Number).filter(Boolean)
      : [];
    const shiftIDs = workshiftIDs
      ? workshiftIDs.split(',').map(Number).filter(Boolean)
      : [];
    return this.service.fetchRateCard(
      +contractorID,
      branchID ? +branchID : undefined,
      deptIDs,
      desigIDs,
      shiftIDs,
    );
  }

  @Get('by-contractor/:contractorID')
  findByContractor(@Param('contractorID') id: string) {
    return this.service.findByContractor(+id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContractorPayoutDto) {
    return this.service.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
