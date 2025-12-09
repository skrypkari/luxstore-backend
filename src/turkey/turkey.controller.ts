import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TurkeyService } from './turkey.service';

@Controller('turkey')
export class TurkeyController {
  constructor(private readonly turkeyService: TurkeyService) {}

  @Post('upload-proof/:orderId')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPaymentProof(
    @Param('orderId') orderId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/pdf',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, JPG, PNG, and PDF are allowed.',
      );
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size must be less than 10MB');
    }

    return this.turkeyService.savePaymentProof(orderId, file);
  }
}
