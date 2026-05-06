import { IsInt } from 'class-validator';

export class AddFactualRosterEmployeeDto {
  @IsInt() factualRosterID: number;
  @IsInt() employeeID: number;
}
