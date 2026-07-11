import { Type } from 'class-transformer';
import {
  IsInt,
  Matches,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'IsTimeAfter', async: false })
class IsTimeAfter implements ValidatorConstraintInterface {
  validate(endTime: string, args: ValidationArguments) {
    const obj = args.object as CreateTemplateDto;
    return obj.startTime < endTime;
  }
  defaultMessage() {
    return 'endTime must be after startTime';
  }
}

export class CreateTemplateDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @Matches(/^\d{2}:\d{2}$/)
  startTime!: string;

  @Matches(/^\d{2}:\d{2}$/)
  @Validate(IsTimeAfter)
  endTime!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  slotMinutes!: number;
}
