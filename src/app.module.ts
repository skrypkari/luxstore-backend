import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { AttributesModule } from './attributes/attributes.module';
import { OrdersModule } from './orders/orders.module';
import { TelegramModule } from './telegram/telegram.module';
import { PlisioModule } from './plisio/plisio.module';
import { CointopayModule } from './cointopay/cointopay.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    CategoriesModule,
    ProductsModule,
    AttributesModule,
    OrdersModule,
    TelegramModule,
    PlisioModule,
    CointopayModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
