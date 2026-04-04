import { IsInt, Min } from 'class-validator';

export class AddRosterEmployeeDto {
  @IsInt() @Min(1) rosterID: number;
  @IsInt() @Min(1) employeeID: number;
}
