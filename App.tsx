import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { ChatInterface } from './components/ChatInterface';
import { ResumePreview } from './components/ResumePreview';
import { Section, ResumeData, ChatMessage, AppStatus, GroundedSource } from './types';
import { RESUME_SECTIONS, SECTION_PROMPTS } from './constants';
import { generateFlashWithGroundingStream, generateSpeech } from './services/geminiService';
import { decode, decodeAudioData, createBlob } from './utils/audio';
import { Icon } from './components/Icon';

// Define a local interface for the session object as it's not exported
interface LiveSession {
  sendRealtimeInput: (params: { media: { data: string, mimeType: string } }) => void;
  close: () => void;
}

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  }
  return 'light';
};


function App() {
  const [currentSection, setCurrentSection] = useState<Section>(Section.INTRODUCTION);
  const [resumeData, setResumeData] = useState<ResumeData>({});
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [appStatus, setAppStatus] = useState<AppStatus>(AppStatus.AWAITING_USER_INPUT);
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState<boolean>(true);
  const [spokenMessageIndices, setSpokenMessageIndices] = useState<Set<number>>(new Set());
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [showPreviewOnMobile, setShowPreviewOnMobile] = useState<boolean>(false);
  
  const sessionRef = useRef<LiveSession | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  useEffect(() => {
    setChatHistory([{ role: 'model', content: SECTION_PROMPTS[Section.INTRODUCTION] }]);
  }, []);

  const handlePlayAudio = async (text: string, index: number) => {
      try {
          const base64Audio = await generateSpeech(text);
          if (base64Audio) {
              if (!outputAudioContextRef.current) {
                  outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
              }
              const audioContext = outputAudioContextRef.current;
              const audioData = decode(base64Audio);
              const audioBuffer = await decodeAudioData(audioData, audioContext, 24000, 1);
              const source = audioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContext.destination);
              source.start();
              setSpokenMessageIndices(prev => new Set(prev).add(index));
          }
      } catch (error) {
          console.error("Error playing audio:", error);
      }
  };

  useEffect(() => {
    if (autoSpeakEnabled && chatHistory.length > 0) {
      const lastMessageIndex = chatHistory.length - 1;
      const lastMessage = chatHistory[lastMessageIndex];
      if (lastMessage.role === 'model' && lastMessage.content && !spokenMessageIndices.has(lastMessageIndex)) {
        handlePlayAudio(lastMessage.content, lastMessageIndex);
      }
    }
  }, [chatHistory, autoSpeakEnabled]);

  const handleToggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false);
      sessionRef.current?.close();
      sessionRef.current = null;
      streamRef.current?.getTracks().forEach(track => track.stop());
      processorRef.current?.disconnect();
      if (liveTranscript) {
          handleUserSubmit(liveTranscript);
      }
      setLiveTranscript('');
      return;
    }
    
    setIsRecording(true);
    setLiveTranscript('');

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        }
        const audioContext = audioContextRef.current;

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: () => console.log('Live session opened'),
                onmessage: (message: LiveServerMessage) => {
                    if (message.serverContent?.inputTranscription) {
                        setLiveTranscript(prev => prev + message.serverContent.inputTranscription.text);
                    }
                },
                onerror: (e: ErrorEvent) => console.error('Live session error:', e),
                onclose: () => console.log('Live session closed'),
            },
            config: {
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {},
            },
        });

        sessionPromise.then(session => {
            sessionRef.current = session;
            const source = audioContext.createMediaStreamSource(stream);
            const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                session.sendRealtimeInput({ media: pcmBlob });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContext.destination);
        });

    } catch (err) {
        console.error("Error starting recording:", err);
        setIsRecording(false);
    }
  };


  const handleUserSubmit = async (userInput: string) => {
    if (!userInput.trim() || appStatus === AppStatus.THINKING) return;
    
    if (isRecording) {
        handleToggleRecording();
    }

    const userMessage: ChatMessage = { role: 'user', content: userInput };
    const newHistory: ChatMessage[] = [...chatHistory, userMessage];
    setChatHistory(newHistory);
    setAppStatus(AppStatus.THINKING);

    const isAdvancing = ['next', 'ok', 'looks good', 'approve', 'skip'].some(keyword => userInput.toLowerCase().includes(keyword));
    if (isAdvancing && currentSection !== Section.INTRODUCTION && currentSection !== Section.DONE) {
      const lastModelMessage = chatHistory.filter(m => m.role === 'model').pop()?.content;
      if (lastModelMessage && !Object.values(SECTION_PROMPTS).includes(lastModelMessage)) {
        const cleanedContent = lastModelMessage.replace(/Here is a draft for this section.*?('next' to approve and move on\.)/i, '').trim();
        if (!(currentSection in resumeData) || resumeData[currentSection] !== cleanedContent) {
            setResumeData(prev => ({ ...prev, [currentSection]: cleanedContent }));
        }
      }

      const currentIndex = RESUME_SECTIONS.indexOf(currentSection);
      if (currentIndex < RESUME_SECTIONS.length - 1) {
          const nextSection = RESUME_SECTIONS[currentIndex + 1];
          setCurrentSection(nextSection);
      }
    } else if (isAdvancing && currentSection === Section.INTRODUCTION) {
        setCurrentSection(Section.CONTACT);
    }

    setChatHistory(prev => [...prev, { role: 'model', content: '' }]);
    let fullResponse = '';
    let sources: GroundedSource[] = [];

    try {
      const stream = generateFlashWithGroundingStream(newHistory, userInput);
      for await (const chunk of stream) {
        if (chunk.text) { fullResponse += chunk.text; }
        if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            const chunkSources: GroundedSource[] = chunk.candidates[0].groundingMetadata.groundingChunks
                .filter((c: any) => c.web?.uri)
                .map((c: any) => ({ title: c.web.title, uri: c.web.uri, }));
            sources = [...new Map([...sources, ...chunkSources].map(item => [item.uri, item])).values()];
        }
        setChatHistory(prev => {
            const lastMessageIndex = prev.length - 1;
            const updatedHistory = [...prev];
            updatedHistory[lastMessageIndex] = { ...updatedHistory[lastMessageIndex], content: fullResponse, sources: sources.length > 0 ? sources : undefined };
            return updatedHistory;
        });
      }
    } catch (error) {
      console.error(error);
      const errorMessage = { role: 'model' as const, content: "Sorry, I encountered an error. Please try again." };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setAppStatus(AppStatus.AWAITING_USER_INPUT);
    }
  };

  return (
    <div className="flex flex-col h-screen font-sans bg-gray-100 dark:bg-gray-900">
      <header className="p-4 bg-white dark:bg-gray-800 shadow-md flex justify-between items-center w-full z-10 shrink-0">
          <div className="flex items-center">
              <Icon icon="bot" className="w-8 h-8 mr-3 text-blue-500" />
              <div>
                  <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">AI Resume Architect</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Craft your perfect resume with Gemini.</p>
              </div>
          </div>
          <div className="flex items-center gap-4">
              <button onClick={() => setAutoSpeakEnabled(!autoSpeakEnabled)} className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400" title={autoSpeakEnabled ? 'Disable Auto-Speak' : 'Enable Auto-Speak'}>
                  <Icon icon={autoSpeakEnabled ? 'speaker' : 'speaker-x-mark'} className="w-6 h-6" />
              </button>
              <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400" title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}>
                  <Icon icon={theme === 'light' ? 'moon' : 'sun'} className="w-6 h-6" />
              </button>
              {/* Mobile-only toggle */}
              <button onClick={() => setShowPreviewOnMobile(!showPreviewOnMobile)} className="md:hidden text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400" title={showPreviewOnMobile ? 'Show Chat' : 'Show Preview'}>
                  <Icon icon={showPreviewOnMobile ? 'chat-bubble' : 'document-text'} className="w-6 h-6" />
              </button>
          </div>
      </header>
      <main className="flex flex-row flex-grow overflow-hidden">
          <div className={`w-full md:w-1/2 md:p-4 flex-col ${showPreviewOnMobile ? 'hidden md:flex' : 'flex'}`}>
            <ChatInterface
              chatHistory={chatHistory}
              appStatus={appStatus}
              onUserSubmit={handleUserSubmit}
              isRecording={isRecording}
              onToggleRecording={handleToggleRecording}
              liveTranscript={liveTranscript}
            />
          </div>
          <div className={`w-full md:w-1/2 md:p-4 border-t md:border-t-0 md:border-l border-gray-300 dark:border-gray-700 flex-col ${!showPreviewOnMobile ? 'hidden md:flex' : 'flex'}`}>
            <ResumePreview resumeData={resumeData} currentSection={currentSection} />
          </div>
      </main>
    </div>
  );
}

export default App;