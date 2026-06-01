import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { EmailTemplateModule } from '../email-template/email-template.module';

@Global()
@Module({
  imports: [EmailTemplateModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
