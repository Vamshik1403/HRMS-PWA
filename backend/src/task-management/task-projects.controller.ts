import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TaskProjectsService } from './task-projects.service';
import {
  CreateTaskProjectDto,
  CreateTaskChatDto,
  CreateTaskRemarkDto,
  FieldAttendanceDto,
  TaskAssignmentActionDto,
  TaskPriorityChangeDto,
  TaskSiteVisitDto,
  TaskStatusChangeDto,
  UpdateTaskProjectDto,
} from './dto/create-task-project.dto';

@Controller('task-projects')
export class TaskProjectsController {
  constructor(private readonly service: TaskProjectsService) {}

  @Get()
  findAll(@Query() query: Record<string, string>) {
    return this.service.findAll(query);
  }

  @Get('employees-by-department/:departmentId')
  employeesByDepartment(
    @Param('departmentId', ParseIntPipe) departmentId: number,
    @Query() query: Record<string, string>,
  ) {
    return this.service.getEmployeesByDepartment(departmentId, query);
  }

  @Post('sync-from-enpl')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(200)
  syncFromEnpl(@Query() query: Record<string, string>) {
    return this.service.syncFromEnpl(query);
  }

  @Get('my-day')
  @UseGuards(AuthGuard('jwt'))
  myDay(@Query() query: Record<string, string>) {
    return this.service.myDayVisits(query);
  }

  @Post('field-attendance')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(200)
  fieldAttendance(@Body() dto: FieldAttendanceDto, @Query() query: Record<string, string>) {
    return this.service.recordFieldAttendance(dto, query);
  }

  @Get(':id/report')
  getReport(@Param('id', ParseIntPipe) id: number, @Query() query: Record<string, string>) {
    return this.service.getTaskReport(id, query);
  }

  @Post(':id/assignment-action')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(200)
  assignmentAction(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TaskAssignmentActionDto,
    @Query() query: Record<string, string>,
  ) {
    return this.service.assignmentAction(id, dto, query);
  }

  @Post(':id/site-visit')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(200)
  recordSiteVisit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TaskSiteVisitDto,
    @Query() query: Record<string, string>,
  ) {
    return this.service.recordSiteVisit(id, dto, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Query() query: Record<string, string>) {
    return this.service.findOne(id, query);
  }

  @Post()
  create(@Body() dto: CreateTaskProjectDto, @Query() query: Record<string, string>) {
    return this.service.create(dto, query);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskProjectDto,
    @Query() query: Record<string, string>,
  ) {
    return this.service.update(id, dto, query);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Query() query: Record<string, string>) {
    return this.service.remove(id, query);
  }

  @Patch(':id/status')
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TaskStatusChangeDto,
    @Query() query: Record<string, string>,
  ) {
    return this.service.changeStatus(id, dto, query);
  }

  @Patch(':id/priority')
  changePriority(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TaskPriorityChangeDto,
    @Query() query: Record<string, string>,
  ) {
    return this.service.changePriority(id, dto, query);
  }

  @Get(':id/remarks')
  getRemarks(@Param('id', ParseIntPipe) id: number, @Query() query: Record<string, string>) {
    return this.service.getRemarks(id, query);
  }

  @Post(':id/remarks')
  addRemark(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTaskRemarkDto,
    @Query() query: Record<string, string>,
  ) {
    return this.service.addRemark(id, dto, query);
  }

  @Get(':id/chats')
  getChats(@Param('id', ParseIntPipe) id: number, @Query() query: Record<string, string>) {
    return this.service.getChats(id, query);
  }

  @Post(':id/chats')
  addChat(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTaskChatDto,
    @Query() query: Record<string, string>,
  ) {
    return this.service.addChat(id, dto, query);
  }

  @Patch(':id/assign')
  assignEmployees(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { assignedEmployeeIds: number[]; dueAt?: string; dueDateTime?: string },
    @Query() query: Record<string, string>,
  ) {
    return this.service.assignEmployees(id, body.assignedEmployeeIds ?? [], query, {
      dueAt: body.dueAt,
      dueDateTime: body.dueDateTime,
    });
  }

  @Get(':id/activities')
  getActivities(@Param('id', ParseIntPipe) id: number, @Query() query: Record<string, string>) {
    return this.service.getActivities(id, query);
  }
}
