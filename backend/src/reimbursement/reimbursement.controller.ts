import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { ReimbursementService } from './reimbursement.service';
import { CreateReimbursementDto } from './dto/create-reimbursement.dto';
import { UpdateReimbursementDto } from './dto/update-reimbursement.dto';

@Controller('reimbursement')
export class ReimbursementController {
  constructor(private readonly service: ReimbursementService) {}

  // ➕ Single record
  @Post()
  create(@Body() dto: CreateReimbursementDto) {
    return this.service.create(dto);
  }

  // 🧾 Multiple records in one request
  @Post('bulk')
  createMany(@Body() dtos: CreateReimbursementDto[]) {
    return this.service.createMany(dtos);
  }

  // 📄 All reimbursements
  @Get()
  findAll() {
    return this.service.findAll();
  }

  // 👨 Employee specific reimbursements
  @Get('employee/:empId')
  findByEmployee(@Param('empId', ParseIntPipe) empId: number) {
    return this.service.findByEmployee(empId);
  }

  // 🏢 Company specific reimbursements
  @Get('company/:companyId')
  findByCompany(@Param('companyId', ParseIntPipe) companyId: number) {
    return this.service.findByCompany(companyId);
  }

  // 🔍 Single reimbursement
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  // ✏️ Update reimbursement
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReimbursementDto,
  ) {
    return this.service.update(id, dto);
  }

  @Patch(':id/payment')
async updatePayment(
  @Param('id') id: string,
  @Body() paymentData: {
    paymentMode?: string;
    paymentType?: string;
    paymentDate?: string;
    paymentRemark?: string;
    paymentProof?: string;
    status?: string;
  }
) {
  return this.service.updatePayment(+id, paymentData);
}

@Patch(':id/approval')
async updateApproval(
  @Param('id') id: string,
  @Body() approvalData: {
    approvalType?: string;
    salaryPeriod?: string;
    voucherCode?: string;
    voucherDate?: string;
    status?: string;
  }
) {
  return this.service.updateApproval(+id, approvalData);
}

@Get('status/:status')
async findByStatus(@Param('status') status: string) {
  return this.service.findByStatus(status);
}

@Get('approval-type/:type')
async findByApprovalType(@Param('type') type: string) {
  return this.service.findByApprovalType(type);
}

  // ❌ Delete reimbursement
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
