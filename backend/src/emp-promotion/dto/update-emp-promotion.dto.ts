import { PartialType } from "@nestjs/mapped-types";
import { CreateEmpPromotionDto } from "./create-emp-promotion.dto";

export class UpdateEmpPromotionDto extends PartialType(CreateEmpPromotionDto) {}
