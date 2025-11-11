import { Module } from '@nestjs/common';
import { AttributesController } from './attributes.controller';
import { AttributesService } from './attributes.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AttributesController],
  providers: [AttributesService, PrismaService],
})
export class AttributesModule {}
