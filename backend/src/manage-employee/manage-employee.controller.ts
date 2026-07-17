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
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { ManageEmployeeService } from './manage-employee.service';
import { CreateManageEmployeeDto, EmployeeCredentialsUpdateDto, EmployeeLoginDto } from './dto/create-manage-employee.dto';
import { UpdateManageEmployeeDto } from './dto/update-manage-employee.dto';

@Controller('manage-emp')
export class ManageEmployeeController {
  constructor(private readonly service: ManageEmployeeService) { }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() dto: CreateManageEmployeeDto, @Req() req: Request) {
    return this.service.create(dto, req);
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
  @UseGuards(AuthGuard('jwt'))
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


  @Get('list')
  findAllForList(@Query('status') status?: string) {
    return this.service.findAllForList(status);
  }

  @Get()
  findAll(@Query('status') status?: string) {
    return this.service.findAll(status);
  }



  @Get(':id/joining-form')
  async downloadJoiningForm(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    try {
      const { pdf, filenameCode } = await this.service.generateJoiningFormPdf(id);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="JoiningForm-${filenameCode}.pdf"`,
        'Content-Length': pdf.length,
      });
      res.send(pdf);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate joining form PDF';
      res.status(500).json({ message });
    }
  }

  @Get(':id/documents')
  @UseGuards(AuthGuard('jwt'))
  getEmployeeDocuments(@Param('id', ParseIntPipe) id: number) {
    return this.service.getEmployeeDocuments(id);
  }

  @Post(':id/documents')
  @UseGuards(AuthGuard('jwt'))
  createEmployeeDocument(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Req() req: Request,
  ) {
    return this.service.createEmployeeDocument(id, body, req);
  }

  @Patch('documents/:documentId')
  @UseGuards(AuthGuard('jwt'))
  updateEmployeeDocument(
    @Param('documentId', ParseIntPipe) documentId: number,
    @Body() body: any,
    @Req() req: Request,
  ) {
    return this.service.updateEmployeeDocument(documentId, body, req);
  }

  @Delete('documents/:documentId')
  @UseGuards(AuthGuard('jwt'))
  deleteEmployeeDocument(
    @Param('documentId', ParseIntPipe) documentId: number,
    @Req() req: Request,
  ) {
    return this.service.deleteEmployeeDocument(documentId, req);
  }


  @Get('workflow-search')
  workflowSearch(
    @Query('companyID', ParseIntPipe)
    companyID: number,

    @Query('branchesID')
    branchesID?: string,

    @Query('search')
    search?: string,
  ) {
    return this.service.workflowSearch({
      companyID,
      branchesID:
        branchesID != null &&
          branchesID.trim() !== ''
          ? Number(branchesID)
          : undefined,

      search:
        search?.trim() || undefined,
    });
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
  @UseGuards(AuthGuard('jwt'))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateManageEmployeeDto,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, req);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.remove(id, req);
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
