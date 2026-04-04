// src/process-att-logs/process_att_logs.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { ProcessAttLogsService } from './process_att_logs.service';
import { CreateProcessAttLogDto } from './dto/create-process_att_log.dto';
import { UpdateProcessAttLogDto } from './dto/update-process_att_log.dto';
import { QueryProcessAttLogDto } from './dto/query-process_att_log.dto';

@Controller('process-att-logs')
export class ProcessAttLogsController {
  constructor(private readonly processAttLogsService: ProcessAttLogsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createProcessAttLogDto: CreateProcessAttLogDto) {
    return this.processAttLogsService.create(createProcessAttLogDto);
  }

  @Get()
  findAll(@Query() query: QueryProcessAttLogDto) {
    return this.processAttLogsService.findAll(query);
  }

  @Get('by-devices')
  async findByDeviceIds(
    @Query('deviceIds') deviceIds: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    if (!deviceIds) {
      throw new BadRequestException('deviceIds parameter is required');
    }
    
    const deviceIdArray = deviceIds.split(',').map(id => parseInt(id.trim()));
    const logs = await this.processAttLogsService.findByDeviceIds(
      deviceIdArray,
      dateFrom,
      dateTo,
    );
    
    // Transform the data for frontend use
    const transformedLogs = logs.map(log => ({
      ...log,
      punch_time: log.punch_time ? log.punch_time.toISOString() : null,
    }));
    
    return {
      success: true,
      data: transformedLogs,
      count: logs.length,
      deviceIds: deviceIdArray,
    };
  }

  @Get('by-device/:deviceId')
  async findByDeviceId(
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const logs = await this.processAttLogsService.findByDeviceId(
      deviceId,
      dateFrom,
      dateTo,
    );
    
    const transformedLogs = logs.map(log => ({
      ...log,
      punch_time: log.punch_time ? log.punch_time.toISOString() : null,
    }));
    
    return {
      success: true,
      data: transformedLogs,
      count: logs.length,
      deviceId,
    };
  }

  @Get('by-username/:username')
  async findByUsername(
    @Param('username') username: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const logs = await this.processAttLogsService.findByUsername(
      username,
      dateFrom,
      dateTo,
    );
    
    const transformedLogs = logs.map(log => ({
      ...log,
      punch_time: log.punch_time ? log.punch_time.toISOString() : null,
    }));
    
    return {
      success: true,
      data: transformedLogs,
      count: logs.length,
      username,
    };
  }

  @Get('summary')
  async getSummary(
    @Query('deviceIds') deviceIds?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const deviceIdArray = deviceIds 
      ? deviceIds.split(',').map(id => parseInt(id.trim()))
      : undefined;
    
    const summary = await this.processAttLogsService.getAttendanceSummary(
      deviceIdArray,
      dateFrom,
      dateTo,
    );
    
    return {
      success: true,
      data: summary,
      count: summary.length,
    };
  }

  @Get('stats')
  async getStats() {
    return this.processAttLogsService.getStats();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const log = await this.processAttLogsService.findOne(id);
    return {
      ...log,
      punch_time: log.punch_time ? log.punch_time.toISOString() : null,
    };
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProcessAttLogDto: UpdateProcessAttLogDto,
  ) {
    return this.processAttLogsService.update(id, updateProcessAttLogDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.processAttLogsService.remove(id);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  removeMany(@Body('ids') ids: number[]) {
    if (!ids || !Array.isArray(ids)) {
      throw new BadRequestException('ids array is required');
    }
    return this.processAttLogsService.removeMany(ids);
  }
}