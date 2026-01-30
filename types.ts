export enum EventType {
  SLEEP = 'SLEEP',
  FEEDING = 'FEEDING',
  PUMPING = 'PUMPING',
  DIAPER = 'DIAPER',
  WALK = 'WALK',
  BATH = 'BATH',
  HEALTH = 'HEALTH',
  GROWTH = 'GROWTH',
  MOOD = 'MOOD',
  MILESTONE = 'MILESTONE'
}

export enum FeedingType {
  BREAST = 'BREAST',
  BOTTLE = 'BOTTLE',
  SOLIDS = 'SOLIDS'
}

export enum SleepType {
  NIGHT = 'NIGHT',
  DAY = 'DAY'
}

export enum DiaperType {
  WET = 'WET',
  DIRTY = 'DIRTY',
  MIXED = 'MIXED'
}

export enum HealthSubtype {
  DOCTOR = 'DOCTOR',
  VACCINE = 'VACCINE',
  SICKNESS = 'SICKNESS',
  MEDICINE = 'MEDICINE',
  TEMPERATURE = 'TEMPERATURE',
  OTHER = 'OTHER'
}

export interface BaseEvent {
  id: string;
  timestamp: string; // ISO String
  type: EventType;
  note?: string;
}

export interface DurationEvent extends BaseEvent {
  endTime?: string; 
}

export interface SleepEvent extends DurationEvent {
  type: EventType.SLEEP;
  subtype?: SleepType;
}

export interface WalkEvent extends DurationEvent {
  type: EventType.WALK;
}

export interface BathEvent extends DurationEvent {
  type: EventType.BATH;
}

export interface FeedingEvent extends BaseEvent {
  type: EventType.FEEDING;
  feedingType: FeedingType;
  endTime?: string; 
  amountMl?: number; 
  side?: 'Left' | 'Right' | 'Both';
}

export interface PumpingEvent extends BaseEvent {
  type: EventType.PUMPING;
  amountMl: number;
  side?: 'Left' | 'Right' | 'Both';
}

export interface DiaperEvent extends BaseEvent {
  type: EventType.DIAPER;
  status: DiaperType;
}

export interface GrowthEvent extends BaseEvent {
  type: EventType.GROWTH;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
}

export interface HealthEvent extends BaseEvent {
  type: EventType.HEALTH;
  subtype: HealthSubtype;
  value?: string; // Name of medicine, vaccine, or doctor
  temperature?: number;
}

export interface MoodEvent extends BaseEvent {
  type: EventType.MOOD;
  mood: string; // 'Happy', 'Crying', etc.
}

export interface MilestoneEvent extends BaseEvent {
  type: EventType.MILESTONE;
  title?: string;
}

export type BabyEvent = 
  | SleepEvent 
  | FeedingEvent
  | PumpingEvent 
  | DiaperEvent 
  | WalkEvent 
  | BathEvent
  | GrowthEvent 
  | HealthEvent
  | MoodEvent
  | MilestoneEvent;

export interface BabyProfile {
  name: string;
  birthDate: string;
  birthWeight: number;
  birthHeight: number;
}