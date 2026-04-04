import { Controller, Get, Post, Body, Param, Patch, Delete, Query } from "@nestjs/common";
import { EmpPromotionService } from "./emp-promotion.service";
import { CreateEmpPromotionDto } from "./dto/create-emp-promotion.dto";
import { UpdateEmpPromotionDto } from "./dto/update-emp-promotion.dto";

@Controller("emp-promotion")
export class EmpPromotionController {
  constructor(private readonly service: EmpPromotionService) {}

  @Post()
  create(@Body() dto: CreateEmpPromotionDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query("manageEmployeeID") manageEmployeeID?: string) {
    return this.service.findAll(manageEmployeeID ? Number(manageEmployeeID) : undefined);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(Number(id));
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateEmpPromotionDto) {
    return this.service.update(Number(id), dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(Number(id));
  }
}
