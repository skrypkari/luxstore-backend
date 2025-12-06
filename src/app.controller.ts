import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('banner-settings')
  getBannerSettings() {
    return {
      url: process.env.URL_BANNER || '',
      isEnabled: process.env.IS_BANNER_ON === 'true',
    };
  }
}
