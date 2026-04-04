import { Controller, Get, Header, HttpCode, Query } from '@nestjs/common';
import { EmpAttendanceSyncService } from './emp-attendance-sync.service';

@Controller()
export class EmpAttendanceSyncController {
  constructor(private readonly svc: EmpAttendanceSyncService) {}

  /**
   * Trigger the sync/transform:
   * - Reads ALL unprocessed AttendanceLogs (across all devices)
   * - Maps to device + employee
   * - Writes to EmpAttendanceLogs
   * - Marks AttendanceLogs.processed = true
   *
   * Optional query params:
   *   ?limit=1000   -- how many unprocessed rows to process (default 1000, max 5000)
   *   ?dry=1        -- dry run: don't write, just preview counts
   */
  @Get('sync-emp-attendance')
  @HttpCode(200)
  @Header('Content-Type', 'application/json')
  async run(
    @Query('limit') limit = '1000',
    @Query('dry') dry = '0',
  ) {
    let take = parseInt(String(limit), 10);
    if (isNaN(take) || take < 1) take = 1000;
    if (take > 5000) take = 5000;

    const isDry = String(dry) === '1' || String(dry).toLowerCase() === 'true';

    const result = await this.svc.sync({ take, dryRun: isDry });

    return {
      ok: true,
      dryRun: isDry,
      ...result,
    };
  }
}
