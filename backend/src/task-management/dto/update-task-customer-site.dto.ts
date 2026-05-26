import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskCustomerSiteDto } from './create-task-customer-site.dto';

export class UpdateTaskCustomerSiteDto extends PartialType(CreateTaskCustomerSiteDto) {}
