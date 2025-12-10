import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ArticleRenderer from './components/ArticleRenderer';
import TimelineHorizontal from './components/TimelineHorizontal';
import { EraId, HistoryContent } from './types';
import { TIMELINE_DATA } from './constants';
import { generateHistoryArticle, generateSearchArticle } from './services/geminiService';

const App: React.FC = () => {
  const [selectedEraId, setSelectedEraId] = useState<EraId | null>(EraId.INTRO);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [content, setContent] = useState<HistoryContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!process.env.API_KEY) {
        if (isMounted) setError("API Key not found in environment.");
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        let data: HistoryContent;
        
        if (searchQuery) {
          // Search Mode
          data = await generateSearchArticle(searchQuery);
        } else {
          // Timeline Mode
          const currentEraId = selectedEraId || EraId.INTRO;
          const era = TIMELINE_DATA.find(t => t.id === currentEraId) || TIMELINE_DATA[0];
          data = await generateHistoryArticle(era);
        }

        if (isMounted) {
          setContent(data);
        }
      } catch (err: any) {
        console.error(err);
        if (isMounted) {
          setError(err.message || "Failed to load history content. Please try again.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [selectedEraId, searchQuery]);

  const handleSelectEra = (id: EraId) => {
    setSearchQuery(null); // Clear search to switch back to timeline mode
    setSelectedEraId(id);
    setIsSidebarOpen(false);
  };

  const handleSearch = (query: string) => {
    setSelectedEraId(null); // Clear selection to switch to search mode
    setSearchQuery(query);
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-history-paper text-history-dark overflow-hidden font-sans">
      <Sidebar 
        selectedEra={selectedEraId}
        onSelectEra={handleSelectEra}
        onSearch={handleSearch}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10 shadow-sm shrink-0">
          <span className="font-serif font-bold text-history-dark">Chronos</span>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-md"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </div>

        {/* Horizontal Timeline (Only visible in Timeline Mode) */}
        {!searchQuery && (
          <TimelineHorizontal 
            selectedEra={selectedEraId}
            onSelectEra={handleSelectEra}
          />
        )}

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto scroll-smooth p-6 md:p-12">
          
          {loading && !content && (
            <div className="flex flex-col items-center justify-center h-full space-y-4 animate-pulse">
               <div className="w-16 h-16 border-4 border-history-gold border-t-transparent rounded-full animate-spin"></div>
               <p className="text-xl font-serif text-gray-400">Consulting the archives...</p>
               <p className="text-sm text-gray-300">
                 {searchQuery ? `Researching "${searchQuery}"` : "Retrieving timeline data..."}
               </p>
            </div>
          )}

          {error && (
            <div className="max-w-xl mx-auto mt-20 p-6 bg-red-50 border border-red-200 rounded-lg text-center">
              <h3 className="text-red-800 font-bold mb-2">Connection with History Severed</h3>
              <p className="text-red-600 mb-4">{error}</p>
              {!process.env.API_KEY && (
                 <p className="text-sm text-gray-500">
                   This app requires a valid Gemini API key to generate content.
                 </p>
              )}
            </div>
          )}

          {!loading && !error && content && (
            <ArticleRenderer content={content} onTopicClick={handleSearch} />
          )}

          {/* Loading Overlay when changing chapters but keeping old content visible briefly */}
          {loading && content && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center">
               <div className="bg-white p-4 rounded-full shadow-xl">
                 <div className="w-8 h-8 border-4 border-history-gold border-t-transparent rounded-full animate-spin"></div>
               </div>
            </div>
          )}
          
        </div>
      </main>
    </div>
  );
};

export default App;