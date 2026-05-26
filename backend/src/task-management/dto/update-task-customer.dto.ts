import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskCustomerDto } from './create-task-customer.dto';

export class UpdateTaskCustomerDto extends PartialType(CreateTaskCustomerDto) {}
