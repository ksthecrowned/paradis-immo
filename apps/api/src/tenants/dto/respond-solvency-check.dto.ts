import { IsBoolean } from 'class-validator';

export class RespondSolvencyCheckDto {
  @IsBoolean()
  accept!: boolean;
}
