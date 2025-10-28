export enum Section {
  INTRODUCTION = 'INTRODUCTION',
  CONTACT = 'CONTACT',
  SUMMARY = 'SUMMARY',
  EXPERIENCE = 'EXPERIENCE',
  EDUCATION = 'EDUCATION',
  SKILLS = 'SKILLS',
  PROJECTS = 'PROJECTS',
  DONE = 'DONE',
}

export type ResumeData = {
  [key in Exclude<Section, Section.INTRODUCTION | Section.DONE>]?: string;
};

export interface GroundedSource {
  title: string;
  uri: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  sources?: GroundedSource[];
}

export enum AppStatus {
  IDLE,
  THINKING,
  AWAITING_USER_INPUT,
}

export enum TTSState {
    IDLE,
    LOADING,
    PLAYING,
}
