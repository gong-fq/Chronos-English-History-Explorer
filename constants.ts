import { TimelineItem, EraId } from './types';

export const TIMELINE_DATA: TimelineItem[] = [
  {
    id: EraId.INTRO,
    title: "Introduction",
    yearRange: "Overview",
    description: "Why English is the way it is."
  },
  {
    id: EraId.PROTO,
    title: "Before English",
    yearRange: "Pre-450 AD",
    description: "Indo-European roots, Celts, and Romans."
  },
  {
    id: EraId.OLD_ENGLISH,
    title: "Old English",
    yearRange: "450 - 1100",
    description: "Anglo-Saxons, Beowulf, and Viking invasions."
  },
  {
    id: EraId.MIDDLE_ENGLISH,
    title: "Middle English",
    yearRange: "1100 - 1500",
    description: "The Norman Conquest, Chaucer, and the Great Vowel Shift begins."
  },
  {
    id: EraId.EARLY_MODERN,
    title: "Early Modern English",
    yearRange: "1500 - 1700",
    description: "Shakespeare, King James Bible, and the Printing Press."
  },
  {
    id: EraId.RESTORATION,
    title: "Age of Reason",
    yearRange: "1700 - 1800",
    description: "Standardization, Dictionaries (Johnson), and Grammar prescriptivism."
  },
  {
    id: EraId.LATE_MODERN,
    title: "Late Modern English",
    yearRange: "1800 - 1900",
    description: "Industrial Revolution, Colonialism, and scientific vocabulary."
  },
  {
    id: EraId.GLOBAL,
    title: "Global English",
    yearRange: "1900 - Present",
    description: "Technology, the Internet, and World Englishes."
  }
];
