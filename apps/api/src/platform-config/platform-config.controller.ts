import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformConfigService } from './platform-config.service';

@ApiTags('Platform')
@Controller()
export class PlatformConfigController {
  constructor(private readonly platformConfig: PlatformConfigService) {}

  @Get('app/config')
  @ApiOperation({
    summary:
      'Bootstrap configuration — announcements, min app version, feature flags (specs 12/14)',
  })
  getAppConfig() {
    return this.platformConfig.getAppConfig();
  }
}
