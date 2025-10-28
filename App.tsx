import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, Blob, LiveServerMessage } from "@google/genai";
import { ChatInterface } from './components/ChatInterface';
import { ResumePreview } from './components/ResumePreview';
import { RESUME_SECTIONS, SECTION_PROMPTS } from './constants';
import { Section, ResumeData, ChatMessage, AppStatus, TTSState, GroundedSource } from './types';
import { generateFlashWithGroundingStream, generateSpeech } from './services/geminiService';
import { generateMarkdownResume } from './utils/markdown';
import { decode, decodeAudioData, encode } from './utils/audio';
import { Icon } from './components/Icon';

// The LiveSession type is not exported from the SDK, so we define a local interface.
interface LiveSession {
  sendRealtimeInput(req: { media: Blob }): void;
  close(): void;
}

const App: React.FC = () => {
  const [currentSection, setCurrentSection] = useState<Section>(Section.INTRODUCTION);
  const [resumeData, setResumeData] = useState<ResumeData>({});
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [appStatus, setAppStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [ttsState, setTtsState] = useState<TTSState>(TTSState.IDLE);
  const [isAutoSpeakEnabled, setIsAutoSpeakEnabled] = useState<boolean>(true);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [isMobilePreviewVisible, setIsMobilePreviewVisible] = useState<boolean>(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastModelResponseRef = useRef<string>('');
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const nextAudioStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<LiveSession | null>(null);
  const liveInputAudioContextRef = useRef<AudioContext | null>(null);
  const liveInputProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const liveInputStreamRef = useRef<MediaStream | null>(null);

  const playAudioQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0 || !audioContextRef.current) return;
    
    isPlayingRef.current = true;
    const audioContext = audioContextRef.current;
    
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
    
    nextAudioStartTimeRef.current = Math.max(nextAudioStartTimeRef.current, audioContext.currentTime);

    while (audioQueueRef.current.length > 0) {
        const audioBuffer = audioQueueRef.current.shift();
        if (audioBuffer) {
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start(nextAudioStartTimeRef.current);
            nextAudioStartTimeRef.current += audioBuffer.duration;

            await new Promise<void>(resolve => {
                source.onended = () => resolve();
            });
        }
    }
    
    isPlayingRef.current = false;
    setTtsState(TTSState.IDLE);
  }, []);

  const handleTTS = useCallback(async (text: string) => {
    if (!text) return;
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    
    setTtsState(TTSState.LOADING);
    const base64Audio = await generateSpeech(text);
    
    if (base64Audio && audioContextRef.current) {
        try {
            const audioData = decode(base64Audio);
            const audioBuffer = await decodeAudioData(audioData, audioContextRef.current, 24000, 1);
            audioQueueRef.current.push(audioBuffer);
            playAudioQueue();
        } catch (error) {
            console.error("Error processing TTS audio:", error);
            setTtsState(TTSState.IDLE);
        }
    } else {
        setTtsState(TTSState.IDLE);
    }
  }, [playAudioQueue]);

  useEffect(() => {
    if (currentSection !== Section.INTRODUCTION || chatHistory.length > 0) return;
    
    setAppStatus(AppStatus.THINKING);
    const initialMessage: ChatMessage = {
      role: 'model',
      content: SECTION_PROMPTS[Section.INTRODUCTION],
    };
    setChatHistory([initialMessage]);
    if (isAutoSpeakEnabled) {
      handleTTS(initialMessage.content);
    }
    setAppStatus(AppStatus.AWAITING_USER_INPUT);
  }, [currentSection, chatHistory.length, isAutoSpeakEnabled, handleTTS]);

  const handleSendMessage = async (userInput: string) => {
    if (!userInput.trim()) return;

    const newUserMessage: ChatMessage = { role: 'user', content: userInput };
    setChatHistory(prev => [...prev, newUserMessage]);
    setAppStatus(AppStatus.THINKING);

    const isApproval = ['next', 'ok', 'looks good', 'approve'].some(term => userInput.toLowerCase().includes(term));
    
    if (isApproval && currentSection !== Section.INTRODUCTION && currentSection !== Section.DONE) {
      const sectionKey = currentSection as keyof ResumeData;
      setResumeData(prev => ({ ...prev, [sectionKey]: lastModelResponseRef.current }));

      const currentIndex = RESUME_SECTIONS.indexOf(currentSection);
      const nextSection = RESUME_SECTIONS[currentIndex + 1];
      setCurrentSection(nextSection);
      
      const nextPrompt = SECTION_PROMPTS[nextSection];
      const newModelMessage: ChatMessage = { role: 'model', content: nextPrompt };
      setChatHistory(prev => [...prev, newModelMessage]);
      
      if (isAutoSpeakEnabled) {
        handleTTS(nextPrompt);
      }
      
      setAppStatus(AppStatus.AWAITING_USER_INPUT);
      lastModelResponseRef.current = '';
    } else {
        const modelMessagePlaceholder: ChatMessage = { role: 'model', content: '', sources: [] };
        setChatHistory(prev => [...prev, modelMessagePlaceholder]);

        let fullResponseText = '';
        let sentenceBuffer = '';
        const stream = generateFlashWithGroundingStream(chatHistory, userInput);

        for await (const chunk of stream) {
            const chunkText = chunk.text;
            if (chunkText) {
                fullResponseText += chunkText;
                if(isAutoSpeakEnabled) sentenceBuffer += chunkText;

                setChatHistory(prev => {
                    const newHistory = [...prev];
                    const lastMessage = newHistory[newHistory.length - 1];
                    if (lastMessage && lastMessage.role === 'model') {
                        lastMessage.content = fullResponseText;
                    }
                    return newHistory;
                });

                if (isAutoSpeakEnabled) {
                    let boundaryIndex;
                    while ((boundaryIndex = sentenceBuffer.search(/[.?!]/)) !== -1) {
                        const sentence = sentenceBuffer.substring(0, boundaryIndex + 1).trim();
                        sentenceBuffer = sentenceBuffer.substring(boundaryIndex + 1);
                        if (sentence) {
                            handleTTS(sentence);
                        }
                    }
                }
            }

            const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (groundingChunks?.length) {
                 const sources: GroundedSource[] = groundingChunks
                    .map(c => ({ uri: c.web?.uri ?? '', title: c.web?.title ?? 'Untitled Source' }))
                    .filter(s => s.uri);
                if (sources.length > 0) {
                     setChatHistory(prev => {
                        const newHistory = [...prev];
                        const lastMessage = newHistory[newHistory.length - 1];
                        if (lastMessage?.role === 'model') {
                            lastMessage.sources = [...(lastMessage.sources || []), ...sources];
                        }
                        return newHistory;
                    });
                }
            }
        }
        
        if (isAutoSpeakEnabled && sentenceBuffer.trim()) {
            handleTTS(sentenceBuffer.trim());
        }

        if (currentSection !== Section.INTRODUCTION && currentSection !== Section.DONE) {
            lastModelResponseRef.current = fullResponseText;
        }

        setAppStatus(AppStatus.AWAITING_USER_INPUT);
    }
  };

  const handleDownload = () => {
    const sectionTitles: Record<string, string> = {
      [Section.CONTACT]: 'Contact',
      [Section.SUMMARY]: 'Professional Summary',
      [Section.EXPERIENCE]: 'Work Experience',
      [Section.EDUCATION]: 'Education',
      [Section.SKILLS]: 'Skills',
      [Section.PROJECTS]: 'Projects',
    };
    const markdown = generateMarkdownResume(resumeData, sectionTitles);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resume.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const manualPlayTTS = useCallback((text: string) => {
    audioQueueRef.current = [];
    if(audioContextRef.current) {
    }
    handleTTS(text);
  }, [handleTTS]);

  function createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
  }

  const handleToggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false);
      sessionRef.current?.close();
      liveInputProcessorRef.current?.disconnect();
      liveInputStreamRef.current?.getTracks().forEach(track => track.stop());
      sessionRef.current = null;
      if (liveTranscript.trim()) {
        handleSendMessage(liveTranscript);
      }
      setLiveTranscript('');
    } else {
      setIsRecording(true);
      setLiveTranscript('');
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: async () => {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            liveInputStreamRef.current = stream;
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            liveInputAudioContextRef.current = audioContext;
            const source = audioContext.createMediaStreamSource(stream);
            const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
            liveInputProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              setLiveTranscript(prev => prev + text);
            }
            if (message.serverContent?.turnComplete) {
                // In manual mode, we don't auto-stop, user clicks button again
            }
          },
          onerror: (e: ErrorEvent) => console.error('Live session error:', e),
          onclose: () => console.log('Live session closed'),
        },
        config: {
          responseModalities: [Modality.AUDIO], // Required for live session even if only using transcription
          inputAudioTranscription: {},
        },
      });
      sessionRef.current = await sessionPromise;
    }
  };


  return (
    <main className="bg-gray-900 text-gray-100 min-h-screen font-sans flex flex-col lg:flex-row">
      {/* Chat View */}
      <div className={`w-full lg:w-1/2 p-4 sm:p-8 flex flex-col lg:max-h-screen ${isMobilePreviewVisible ? 'hidden lg:flex' : 'flex'}`}>
        <header className="pb-6 mb-6 flex-shrink-0 flex justify-between items-start border-b border-gray-700/50">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-cyan-400">AI Resume Architect</h1>
            <p className="text-gray-400 mt-1">Craft your perfect resume with Gemini.</p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => setIsAutoSpeakEnabled(!isAutoSpeakEnabled)}
              className="p-2 rounded-full hover:bg-gray-700 transition-colors hidden sm:flex items-center gap-2"
              aria-label={isAutoSpeakEnabled ? "Disable auto-speak" : "Enable auto-speak"}
            >
              <Icon icon={isAutoSpeakEnabled ? 'speaker' : 'speaker-x-mark'} className="w-6 h-6 text-cyan-400" />
            </button>
             <button
              onClick={() => setIsMobilePreviewVisible(true)}
              className="p-2.5 rounded-full bg-gray-700/80 hover:bg-gray-700 transition-colors lg:hidden"
              aria-label="Show Resume Preview"
            >
              <Icon icon={'document-text'} className="w-6 h-6 text-cyan-400" />
            </button>
          </div>
        </header>
        <div className="flex-grow min-h-0">
          <ChatInterface 
            chatHistory={chatHistory} 
            appStatus={appStatus}
            onSendMessage={handleSendMessage}
            onTTS={manualPlayTTS}
            ttsState={ttsState}
            currentSection={currentSection}
            isRecording={isRecording}
            onToggleRecording={handleToggleRecording}
            liveTranscript={liveTranscript}
          />
        </div>
      </div>
      {/* Resume Preview View */}
      <div className={`w-full lg:w-1/2 bg-gray-800/50 p-4 sm:p-8 lg:border-l border-gray-700/50 flex flex-col lg:max-h-screen ${isMobilePreviewVisible ? 'flex' : 'hidden lg:flex'}`}>
        <ResumePreview 
          resumeData={resumeData}
          onDownload={handleDownload}
          isDone={currentSection === Section.DONE}
          onShowChat={() => setIsMobilePreviewVisible(false)}
        />
      </div>
    </main>
  );
};

export default App;