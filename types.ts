export enum EraId {
  INTRO = 'intro',
  PROTO = 'proto',
  OLD_ENGLISH = 'old_english',
  MIDDLE_ENGLISH = 'middle_english',
  EARLY_MODERN = 'early_modern',
  RESTORATION = 'restoration',
  LATE_MODERN = 'late_modern',
  GLOBAL = 'global'
}

export interface TimelineItem {
  id: EraId;
  title: string;
  yearRange: string;
  description: string;
}

export interface RelatedTopic {
  topic: string;
  reason: string;
}

export interface GlossaryItem {
  term: string;
  definition: string;
}

export interface HistoryContent {
  title: string;
  subtitle: string;
  academicContext: string; // References to scholars/works
  sections: Array<{
    heading: string;
    body: string;
  }>;
  relatedTopics?: RelatedTopic[];
  glossary?: GlossaryItem[];
  imagePrompt: string; // To generate an image
}

export interface GeneratedImage {
  url: string;
  alt: string;
}