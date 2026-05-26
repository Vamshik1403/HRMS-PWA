import { Module } from '@nestjs/common';
import { TaskCustomersController } from './task-customers.controller';
import { TaskCustomersService } from './task-customers.service';
import { TaskCustomerSitesController } from './task-customer-sites.controller';
import { TaskCustomerSitesService } from './task-customer-sites.service';
import { TaskProjectsController } from './task-projects.controller';
import { TaskProjectsService } from './task-projects.service';

@Module({
  controllers: [TaskCustomersController, TaskCustomerSitesController, TaskProjectsController],
  providers: [TaskCustomersService, TaskCustomerSitesService, TaskProjectsService],
})
export class TaskManagementModule {}
