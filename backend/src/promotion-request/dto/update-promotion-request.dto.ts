import { PartialType } from '@nestjs/mapped-types';
import { CreatePromotionRequestDto } from './create-promotion-request.dto';

export class UpdatePromotionRequestDto extends PartialType(CreatePromotionRequestDto) {}
