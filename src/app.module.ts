import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { AttributesModule } from './attributes/attributes.module';

@Module({
  imports: [CategoriesModule, ProductsModule, AttributesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
