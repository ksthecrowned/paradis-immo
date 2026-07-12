import { Allow } from 'class-validator';

export class AssignMandateDto {
  /** Null clears assignment. Must be AGENT or ADMIN of the mandate agency. */
  @Allow()
  agentUserId!: string | null;
}
