import React, { useState, useEffect, useRef } from 'react';
import { HistoryContent, GlossaryItem } from '../types';
import { generateHistoricalIllustration } from '../services/geminiService';

interface ArticleRendererProps {
  content: HistoryContent;
  onTopicClick: (topic: string) => void;
}

const ArticleRenderer: React.FC<ArticleRendererProps> = ({ content, onTopicClick }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);

  // Glossary State
  const [activeGlossaryTerm, setActiveGlossaryTerm] = useState<GlossaryItem | null>(null);

  // Text-to-Speech State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  // Store multiple utterances to prevent garbage collection issues
  const utterancesRef = useRef<SpeechSynthesisUtterance[]>([]);

  // Feedback State
  const [userRating, setUserRating] = useState<'up' | 'down' | null>(null);
  
  // Citation State
  const [citationCopied, setCitationCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchImage = async () => {
      if (!content.imagePrompt) return;
      
      setLoadingImage(true);
      setImageUrl(null);
      setImageError(false);

      try {
        const fullPrompt = `A high quality, museum-style historical painting or artifact depicting: ${content.imagePrompt}. Use warm, academic lighting.`;
        const url = await generateHistoricalIllustration(fullPrompt);
        if (isMounted) {
          setImageUrl(url);
        }
      } catch (err) {
        console.error("Failed to generate image", err);
        if (isMounted) setImageError(true);
      } finally {
        if (isMounted) setLoadingImage(false);
      }
    };

    fetchImage();

    // Close glossary on content change
    setActiveGlossaryTerm(null);
    setCitationCopied(false);

    // Load existing feedback
    const savedFeedback = localStorage.getItem('chronos_feedback_v1');
    if (savedFeedback) {
      const ratings = JSON.parse(savedFeedback);
      if (isMounted) {
        setUserRating(ratings[content.title] || null);
      }
    } else {
      if (isMounted) {
        setUserRating(null);
      }
    }

    // Stop speaking if the component unmounts or content changes
    return () => {
      isMounted = false;
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      setIsPaused(false);
      utterancesRef.current = [];
    };
  }, [content.title, content.imagePrompt]);

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) {
      console.warn("Text-to-speech not supported");
      return;
    }

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsSpeaking(true);
      return;
    }

    if (isSpeaking) {
      return;
    }

    // Clear any existing speech
    window.speechSynthesis.cancel();

    // Helper to clean text
    const safeText = (t: string | undefined | null) => t ? t.replace(/\[\[/g, '').replace(/\]\]/g, '').trim() : '';

    // Prepare chunks to speak
    // Chunking avoids "text-too-long" errors in some browsers
    const chunks: string[] = [
      safeText(content.title),
      safeText(content.subtitle),
      "Academic Context.",
      safeText(content.academicContext)
    ];

    (content.sections || []).forEach(s => {
      chunks.push(safeText(s.heading));
      if (s.body) {
        // Split body by newlines to keep chunks manageable
        const paragraphs = s.body.split('\n').map(p => safeText(p)).filter(p => p.length > 0);
        chunks.push(...paragraphs);
      }
    });

    const validChunks = chunks.filter(c => c.length > 0);
    const newUtterances: SpeechSynthesisUtterance[] = [];

    validChunks.forEach((text, index) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN'; 
      
      // We only attach onend to the last utterance to signal completion of the whole article
      if (index === validChunks.length - 1) {
        utterance.onend = () => {
          setIsSpeaking(false);
          setIsPaused(false);
          utterancesRef.current = [];
        };
      }

      utterance.onerror = (e) => {
        // Ignore errors caused by manual cancellation/interruption which are expected
        if (e.error === 'canceled' || e.error === 'interrupted') return;
        
        console.error("Speech synthesis error:", e.error);
        setIsSpeaking(false);
        setIsPaused(false);
      };

      newUtterances.push(utterance);
    });

    utterancesRef.current = newUtterances;
    
    // Queue all chunks
    newUtterances.forEach(u => window.speechSynthesis.speak(u));
    
    if (newUtterances.length > 0) {
      setIsSpeaking(true);
    }
  };

  const handlePause = () => {
    if (isSpeaking && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const handleStop = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsPaused(false);
    utterancesRef.current = [];
  };

  const handleRate = (rating: 'up' | 'down') => {
    setUserRating(rating);
    const savedFeedback = localStorage.getItem('chronos_feedback_v1');
    const ratings = savedFeedback ? JSON.parse(savedFeedback) : {};
    ratings[content.title] = rating;
    localStorage.setItem('chronos_feedback_v1', JSON.stringify(ratings));
  };

  const handleCopyCitation = () => {
    const today = new Date().toISOString().split('T')[0];
    const citation = `Gemini 2.5 Flash (${today})`;
    
    // Clipboard API might fail in non-secure contexts
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(citation).then(() => {
          setCitationCopied(true);
          setTimeout(() => setCitationCopied(false), 2000);
        }).catch(err => console.warn("Citation copy failed", err));
    }
  };

  // Helper to parse text and render glossary terms and date markers
  const renderRichText = (text: string) => {
    // 1. Split by Glossary terms [[term]]
    // The capturing group ( ) in split includes the separators in the result array
    const parts = text.split(/(\[\[.*?\]\])/g);

    return parts.map((part, index) => {
      // Handle Glossary Term
      if (part.startsWith('[[') && part.endsWith(']]')) {
        const termText = part.slice(2, -2);
        const glossaryItem = content.glossary?.find(g => g.term.toLowerCase() === termText.toLowerCase()) || { term: termText, definition: "Definition unavailable." };
        
        return (
          <button
            key={index}
            onClick={(e) => { e.stopPropagation(); setActiveGlossaryTerm(glossaryItem); }}
            className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 hover:text-blue-900 border border-blue-200 transition-colors cursor-help align-baseline transform hover:scale-105"
            title="Click for definition"
          >
            {termText}
            {/* Small info icon */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-50">
              <path fillRule="evenodd" d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0ZM9 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6.75 8a.75.75 0 0 0 0 1.5h.75v1.75a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8.25 8h-1.5Z" clipRule="evenodd" />
            </svg>
          </button>
        );
      }

      // Handle Dates/Events in plain text parts
      // Regex detects years (e.g. 1066, 1700s, 43 AD) and centuries (e.g. 5th century)
      // Matches: 400-2029 to avoid small numbers like '100 words'
      const dateRegex = /(\b(?:AD\s*)?(?:4[0-9]{2}|[5-9][0-9]{2}|1[0-9]{3}|20[0-2][0-9])(?:s|\s*BC|\s*AD)?\b|\b\d{1,2}(?:st|nd|rd|th)\s+[Cc]entury\b)/g;
      
      const subParts = part.split(dateRegex);
      
      return subParts.map((subPart, subIndex) => {
        // Since split with capturing group outputs [text, match, text, match...], 
        // odd indices are matches.
        if (subIndex % 2 === 1) {
             return (
                <span key={`${index}-${subIndex}`} className="inline-flex items-center mx-1 px-1.5 py-0.5 rounded text-xs font-bold font-serif text-amber-700 bg-amber-50 border border-amber-200 select-none whitespace-nowrap">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 mr-1 opacity-70">
                      <path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z" clipRule="evenodd" />
                    </svg>
                    {subPart}
                </span>
            );
        }
        return <span key={`${index}-${subIndex}`}>{subPart}</span>;
      });
    });
  };

  const altText = `Historical illustration depicting ${content.imagePrompt}`;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 relative">
      
      {/* Glossary Modal/Popup */}
      {activeGlossaryTerm && (
        <div 
          className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white rounded-lg shadow-2xl border border-history-gold animate-in slide-in-from-bottom-5 duration-300"
          role="dialog"
          aria-labelledby="glossary-term"
        >
          <div className="p-4 relative">
             <button 
               onClick={() => setActiveGlossaryTerm(null)}
               className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
             >
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                 <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
               </svg>
             </button>
             <h4 id="glossary-term" className="text-lg font-serif font-bold text-history-dark mb-2 pr-6">
               {activeGlossaryTerm.term}
             </h4>
             <p className="text-gray-700 text-sm leading-relaxed">
               {activeGlossaryTerm.definition}
             </p>
             <div className="mt-2 text-xs text-history-gold font-bold uppercase tracking-wider text-right">
               Glossary
             </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b-2 border-history-gold pb-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-history-dark mb-4 leading-tight">
              {content.title}
            </h1>
            <p className="text-xl text-gray-600 italic font-serif">
              {content.subtitle}
            </p>
          </div>
          
          {/* Read Aloud Controls */}
          <div className="flex items-center space-x-2 bg-gray-100 p-2 rounded-lg ml-4 shrink-0">
            {!isSpeaking || isPaused ? (
              <button 
                onClick={handleSpeak}
                title="Read Aloud"
                className="p-2 rounded-full hover:bg-history-gold hover:text-white text-history-dark transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                </svg>
              </button>
            ) : (
               <button 
                onClick={handlePause}
                title="Pause"
                className="p-2 rounded-full hover:bg-gray-300 text-history-dark transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                </svg>
              </button>
            )}
            
            <button 
              onClick={handleStop}
              disabled={!isSpeaking && !isPaused}
              title="Stop"
              className={`p-2 rounded-full transition-colors ${(!isSpeaking && !isPaused) ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-red-500 hover:text-white text-history-dark'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Academic Context Banner */}
      <div className="bg-white border-l-4 border-blue-500 p-4 shadow-sm rounded-r-lg">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <p className="text-sm font-bold text-blue-800 uppercase tracking-wide mb-1">
              Academic Lens
            </p>
            <p className="text-gray-700 text-sm">
              {content.academicContext}
            </p>
          </div>
          <button 
            onClick={handleCopyCitation}
            className="text-gray-400 hover:text-blue-600 transition-colors p-1 shrink-0"
            title="Copy Citation"
            aria-label="Copy citation"
          >
            {citationCopied ? (
              <span className="text-xs font-bold text-green-600 flex items-center bg-green-50 px-2 py-1 rounded">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                </svg>
                Copied
              </span>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Dynamic Image Area */}
      <div 
        className="w-full aspect-video bg-gray-200 rounded-xl overflow-hidden shadow-inner flex items-center justify-center relative"
        role="img"
        aria-label={altText}
      >
        {imageUrl && !imageError ? (
          <img 
            src={imageUrl} 
            alt={altText}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover animate-in fade-in duration-700 hover:scale-105 transition-transform duration-1000"
          />
        ) : loadingImage ? (
           <>
             {/* Shimmer Background */}
             <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer" />
             
             {/* Loading Content */}
             <div className="flex flex-col items-center space-y-3 text-gray-500 z-10 relative">
               <div className="w-8 h-8 border-4 border-history-gold border-t-transparent rounded-full animate-spin"></div>
               <p className="text-sm font-medium animate-pulse">Designing historical illustration...</p>
             </div>
           </>
        ) : (
           <div className="text-gray-400 text-sm p-4 text-center bg-gray-100 w-full h-full flex flex-col items-center justify-center">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mb-2 opacity-50">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
             </svg>
             <p>Illustration unavailable.</p>
             <p className="text-xs italic mt-2 max-w-md opacity-70">
                Image description: {content.imagePrompt}
             </p>
           </div>
        )}
        
        {/* Only show the AI tag if image is loaded and valid */}
        {imageUrl && !imageError && !loadingImage && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
             <p className="text-white/90 text-xs md:text-sm font-serif italic text-right">
               AI Generated Representation
             </p>
          </div>
        )}
      </div>

      {/* Main Content Sections */}
      <article className="space-y-10">
        {(content.sections || []).map((section, idx) => (
          <section key={idx} className="group">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
              <span className="text-history-gold mr-3 text-xl opacity-50">§</span>
              {section.heading}
            </h2>
            <div 
              className="prose prose-lg text-gray-700 leading-relaxed font-sans text-justify"
            >
              {/* Splitting by newline and then parsing glossary terms and dates in each paragraph */}
              {(section.body || '').split('\n').map((paragraph, pIdx) => (
                 paragraph.trim().length > 0 && 
                 <p key={pIdx} className="mb-4">
                   {renderRichText(paragraph)}
                 </p>
              ))}
            </div>
          </section>
        ))}
      </article>

      {/* Feedback Section */}
      <section className="py-8 mt-12 border-t border-gray-200 flex flex-col items-center justify-center space-y-4">
        <h4 className="text-sm uppercase tracking-widest text-gray-500 font-bold">Was this lesson helpful?</h4>
        <div className="flex items-center space-x-6">
          <button 
            onClick={() => handleRate('up')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-300 ${
              userRating === 'up' 
                ? 'bg-green-100 text-green-700 shadow-inner' 
                : 'hover:bg-gray-100 text-gray-500 hover:text-green-600'
            } ${userRating === 'down' ? 'opacity-50' : ''}`}
            aria-label="Thumbs up"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill={userRating === 'up' ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V3a.75.75 0 0 1 .75-.75A2.25 2.25 0 0 1 16.5 4.5c0 1.152-.26 2.247-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" />
            </svg>
            <span className="font-medium">Yes</span>
          </button>

          <button 
            onClick={() => handleRate('down')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-300 ${
              userRating === 'down' 
                ? 'bg-red-100 text-red-700 shadow-inner' 
                : 'hover:bg-gray-100 text-gray-500 hover:text-red-600'
            } ${userRating === 'up' ? 'opacity-50' : ''}`}
            aria-label="Thumbs down"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill={userRating === 'down' ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 15h2.25m8.024-9.75c.011.05.028.1.052.148.591 1.2.924 2.55.924 3.977a8.96 8.96 0 0 1-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398C20.613 14.547 19.833 15 19 15h-1.053c-.472 0-.745-.556-.5-.96a8.95 8.95 0 0 0 .303-.54m.023-8.25H16.48a4.5 4.5 0 0 1-1.423-.23l-3.114-1.04a4.5 4.5 0 0 0-1.423-.23H6.504c-.618 0-1.217.247-1.605.729A11.95 11.95 0 0 0 2.25 12c0 .434.023.863.068 1.285C2.427 14.306 3.346 15 4.372 15h3.126c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.5a2.25 2.25 0 0 0 2.25 2.25.75.75 0 0 0 .75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 0 0 2.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384" />
            </svg>
            <span className="font-medium">No</span>
          </button>
        </div>
        {userRating && (
          <p className="text-xs text-gray-400 animate-in fade-in slide-in-from-bottom-2">
            Thanks for your feedback!
          </p>
        )}
      </section>

      {/* Related Topics Section */}
      {content.relatedTopics && content.relatedTopics.length > 0 && (
        <section className="mt-8 pt-8 border-t border-gray-300">
          <h3 className="text-xl font-serif font-bold text-history-dark mb-6">Further Exploration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {content.relatedTopics.map((topic, idx) => (
              <button
                key={idx}
                onClick={() => onTopicClick(topic.topic)}
                className="flex flex-col text-left p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:border-history-gold transition-all duration-200 group"
              >
                <span className="font-bold text-lg text-history-dark group-hover:text-history-gold transition-colors">
                  {topic.topic}
                </span>
                <span className="text-sm text-gray-500 mt-2">
                  {topic.reason}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Footer Quote */}
      <div className="pt-12 pb-6 text-center">
        <div className="w-16 h-1 bg-history-gold mx-auto mb-4 opacity-30"></div>
        <p className="text-gray-400 text-sm">
          Content generated by Gemini 2.5 Flash based on historical linguistics research.
        </p>
      </div>
    </div>
  );
};

export default ArticleRenderer;