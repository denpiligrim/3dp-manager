import { SetMetadata } from '@nestjs/common';

export const OPERATION = 'operation-definition';
export interface OperationDefinition {
  kind: string;
  title: string;
  background?: boolean;
  args?: string[];
}
export const BackgroundTask = (
  kind: string,
  title: string,
  args: string[] = [],
) =>
  SetMetadata(OPERATION, {
    kind,
    title,
    args,
    background: true,
  } satisfies OperationDefinition);
export const JournalAction = (kind: string, title: string) =>
  SetMetadata(OPERATION, { kind, title } satisfies OperationDefinition);
