import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class RequestEnrollmentDto {
  @ApiProperty()
  @IsString()
  @Matches(/^\d+$/)
  offerId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observations?: string;
}

export class CreatePaymentIntentDto {
  @ApiProperty()
  @IsString()
  @Matches(/^\d+$/)
  enrollmentId!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^\d+$/)
  paymentMethodId!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{12,120}$/)
  idempotencyKey!: string;
}
