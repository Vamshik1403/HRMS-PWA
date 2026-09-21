export class CreateAttendanceLocationDto {
  checkType: 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_IN' | 'BREAK_OUT';
  latitude: number;
  longitude: number;
  accuracy?: number;
  deviceType?: string;
  browser?: string;
  operatingSystem?: string;
  userAgent?: string;
  photoUrl?: string;
}
