import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ManageEmployeeService } from './manage-employee.service';
import { CreateManageEmployeeDto, EmployeeCredentialsUpdateDto, EmployeeLoginDto } from './dto/create-manage-employee.dto';
import { UpdateManageEmployeeDto } from './dto/update-manage-employee.dto';

@Controller('manage-emp')
export class ManageEmployeeController {
  constructor(private readonly service: ManageEmployeeService) {}



  @Post()
  create(@Body() dto: CreateManageEmployeeDto) {
    return this.service.create(dto);
  }

  @Get('credentials/all')
async getAllCredentials() {
  const data = await this.service.getAllCredentials();
  return data;
}




   // 1. Get credentials by employee ID
  @Get(':id/credentials')
  getEmployeeCredentials(@Param('id') id: string) {
    return this.service.getEmployeeCredentials(+id);
  }

  // 2. Get credentials by username
  @Get('credentials/:username')
  getCredentialsByUsername(@Param('username') username: string) {
    return this.service.getCredentialsByUsername(username);
  }

  // 3. Update employee credentials
  @Patch(':id/credentials')
  updateCredentials(
    @Param('id') id: string,
    @Body() updateCredentialDto: EmployeeCredentialsUpdateDto,
  ) {
    return this.service.updateCredentials(+id, updateCredentialDto);
  }





  // Add this to your controller
@Get('credentials/search')
searchCredentials(
  @Query('username') username?: string,
  @Query('isActive') isActive?: string,
  @Query('serviceProviderID') serviceProviderID?: string,
  @Query('companyID') companyID?: string,
  @Query('branchesID') branchesID?: string,
) {
  return this.service.searchCredentials({
    ...(username && { username }),
    ...(isActive !== undefined && { isActive: isActive === 'true' }),
    ...(serviceProviderID && { serviceProviderID: +serviceProviderID }),
    ...(companyID && { companyID: +companyID }),
    ...(branchesID && { branchesID: +branchesID }),
  });
}

  // 4. Employee login endpoint
  @Post('login')
  employeeLogin(@Body() loginDto: EmployeeLoginDto) {
    return this.service.verifyEmployeeLogin(loginDto.username, loginDto.password);
  }

  // 5. Reset password for employee
  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string) {
    return this.service.resetPassword(+id);
  }

  // 5b. Employee changes own password
  @Post(':id/change-password')
  async changePassword(
    @Param('id') id: string,
    @Body() body: { oldPassword: string; newPassword: string },
  ) {
    return this.service.changePassword(+id, body.oldPassword, body.newPassword);
  }

  // 6. Activate/Deactivate credentials
  @Patch(':id/credentials/status')
  updateCredentialStatus(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.service.updateCredentials(+id, { isActive: body.isActive });
  }


@Get()
findAll(@Query('status') status?: string) {
  return this.service.findAll(status);
}



  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Get(':id/field-history')
  getFieldHistory(@Param('id', ParseIntPipe) id: number) {
    return this.service.getFieldHistory(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateManageEmployeeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  // --- Linked Employees ---

  @Get(':id/linked-employees')
  getLinkedEmployees(@Param('id', ParseIntPipe) id: number) {
    return this.service.getLinkedEmployees(id);
  }

  @Post(':id/linked-employees')
  saveLinkedEmployees(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { linkedEmployeeIds: number[] },
  ) {
    return this.service.saveLinkedEmployees(id, body.linkedEmployeeIds);
  }
}
