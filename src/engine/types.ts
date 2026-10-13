export type Team = 'Sales' | 'CS' | 'Marketing' | 'Ops' | 'Talent';

export interface WorkflowCandidate {
  id: string;
  team: Team;
  name: string;
  description: string;
  occurrencesPerMonth: number | null;
  minutesPerOccurrence: number | null;
  savedShare: number | null;
  commercialWeight: number | null;
  buildDays: number | null;
  hypothesisNote: string;
  overlapsProduct: string | null;
}

export type CriterionId = 'timeToValue' | 'evidenceFit' | 'runningCost' | 'maintenance' | 'security' | 'reversibility';

export interface Criterion { id: CriterionId; label: string; weight: number; question: string }

export interface BuildBuyOption {
  id: 'build' | 'buy' | 'configure' | 'nothing';
  label: string;
  summary: string;
  scores: Record<CriterionId, number | null>;
  notes: Partial<Record<CriterionId, string>>;
}

export type SourceKind = 'order_form' | 'call_note' | 'crm_field' | 'security_review' | 'email_recap';

export interface Source {
  id: string;
  kind: SourceKind;
  capturedAt: string;
  author: string;
  text: string;
}

export type FieldId = 'ats' | 'seats' | 'goLive' | 'sso' | 'videoTool' | 'recordingConsent' | 'executiveSponsor' | 'successCriterion';

export interface Resolution { field: FieldId; value: string; sourceId: string; reason: string; by: string; candidatesFingerprint: string }

export interface Checkpoint { date: string; metric: string; thresholdPct: number }

export interface Approval { by: string; at: string; fingerprint: string }

export interface Execution { receiptId: string; idempotencyKey: string; at: string; fingerprint: string; plan: string[] }

export interface HandoffPacket {
  id: string;
  account: string;
  segment: Segment;
  closeDate: string;
  ae: string;
  sources: Source[];
  owner: string | null;
  checkpoint: Checkpoint | null;
  resolutions: Resolution[];
  approval: Approval | null;
  execution: Execution | null;
}

export type Segment = 'enterprise' | 'mid-market' | 'strategic';

export type EffortArm = 'baseline' | 'assisted';

export interface EffortRow {
  id: string;
  arm: EffortArm;
  segment: Segment;
  minutes: number | null;
  status: 'complete' | 'partial';
  packetId: string | null;
  origin: 'fixture' | 'visitor';
}

export interface Workspace {
  schema: 1;
  revision: number;
  selection: { workflowId: string; at: string; fingerprint: string } | null;
  candidates: WorkflowCandidate[];
  options: BuildBuyOption[];
  decision: { optionId: BuildBuyOption['id']; by: string; at: string; fingerprint: string } | null;
  packets: HandoffPacket[];
  effort: EffortRow[];
}

export interface EventRecord {
  seq: number;
  at: string;
  type: string;
  revision: number;
  subject: string | null;
  detail: string;
}

export const LIMITS = {
  packets: 25,
  sourcesPerPacket: 8,
  sourceTextChars: 4000,
  effortRows: 200,
  events: 1000,
  bodyBytes: 256 * 1024,
  textField: 200,
  reason: 400,
} as const;
