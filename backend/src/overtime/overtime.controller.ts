// src/overtime/overtime.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  ParseIntPipe,
  Delete,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { OvertimeService } from "./overtime.service";
import dayjs from "dayjs";

@Controller("overtime")
export class OvertimeController {
  constructor(private service: OvertimeService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get("pending")
  findPending() {
    return this.service.findPending();
  }

  @Get("employee/:employeeId")
  findForEmployee(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const start = startDate ? dayjs(startDate).toDate() : undefined;
    const end = endDate ? dayjs(endDate).toDate() : undefined;
    
    return this.service.findForEmployee(employeeId, start, end);
  }

  @Post("calculate/daily")
  @HttpCode(HttpStatus.OK)
  calculateDailyOT(
    @Body() body: { employeeId: number; date: string }
  ) {
    return this.service.generateForEmployeeDate(
      body.employeeId,
      dayjs(body.date).toDate()
    );
  }

  @Post("calculate/range")
  @HttpCode(HttpStatus.OK)
  calculateRangeOT(
    @Body() body: { startDate: string; endDate: string }
  ) {
    return this.service.generateForDateRange(
      dayjs(body.startDate).toDate(),
      dayjs(body.endDate).toDate()
    );
  }

  @Post("recalculate")
  @HttpCode(HttpStatus.OK)
  recalculateOT(
    @Body() body: { employeeId: number; date: string }
  ) {
    return this.service.recalculateOT(
      body.employeeId,
      dayjs(body.date).toDate()
    );
  }

  @Post("debug")
  @HttpCode(HttpStatus.OK)
  debugOT(
    @Body() body: { employeeId: number; date: string }
  ) {
    return this.service.debugEmployeeOT(
      body.employeeId,
      dayjs(body.date).toDate()
    );
  }

  @Patch(":id/approve")
  approve(@Param("id", ParseIntPipe) id: number) {
    return this.service.approve(id);
  }

  @Patch(":id/reject")
  reject(
    @Param("id", ParseIntPipe) id: number,
    @Body() body?: { reason: string }
  ) {
    return this.service.reject(id, body?.reason);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}