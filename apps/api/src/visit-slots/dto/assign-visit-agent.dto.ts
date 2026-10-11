import { IsString, ValidateIf } from 'class-validator';

export class AssignVisitAgentDto {
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  agentId!: string | null;
}
