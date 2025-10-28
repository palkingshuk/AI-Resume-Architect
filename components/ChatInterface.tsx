import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AppStatus, TTSState, Section } from '../types';
import { Icon } from './Icon';

interface ChatInterfaceProps {
  chatHistory: ChatMessage[];
  appStatus: AppStatus;
  onSendMessage: (message: string) => void;
  onTTS: (text: string) => void;
  ttsState: TTSState;
  currentSection: Section;
  isRecording: boolean;
  onToggleRecording: () => void;
  liveTranscript: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
    chatHistory, 
    appStatus,
    onSendMessage,
    onTTS,
    ttsState,
    currentSection,
    isRecording,
    onToggleRecording,
    liveTranscript,
}) => {
  const [userInput, setUserInput] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Sync user input with live transcript
    setUserInput(liveTranscript);
  }, [liveTranscript]);

  useEffect(() => {
    // Auto-scroll to bottom of chat
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [userInput])

  const handleSend = () => {
    if (userInput.trim() && appStatus !== AppStatus.THINKING) {
      onSendMessage(userInput);
      setUserInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isDone = currentSection === Section.DONE;
  const isInputDisabled = appStatus === AppStatus.THINKING || isDone || isRecording;

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg">
      {/* Chat messages */}
      <div ref={chatContainerRef} className="flex-grow p-6 overflow-y-auto space-y-6">
        {chatHistory.map((message, index) => (
          <div key={index} className={`flex items-start gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}>
            {message.role === 'model' && (
              <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center flex-shrink-0">
                <Icon icon="bot" className="w-5 h-5 text-white" />
              </div>
            )}
            <div className={`w-full max-w-2xl p-4 rounded-lg ${message.role === 'user' ? 'bg-cyan-500/10' : 'bg-gray-700/70'}`}>
                <div className="whitespace-pre-wrap text-gray-200">{message.content}</div>
                {message.sources && message.sources.length > 0 && (
                    <div className="mt-4 border-t border-gray-600/50 pt-3">
                        <h4 className="text-xs font-semibold text-gray-400 mb-1">Sources:</h4>
                        <ul className="text-xs space-y-1.5">
                            {message.sources.map((source, i) => (
                                <li key={i}>
                                    <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline truncate block">
                                        {source.title}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                 {message.role === 'model' && (
                    <button 
                        onClick={() => onTTS(message.content)} 
                        disabled={ttsState !== TTSState.IDLE}
                        className="text-gray-400 hover:text-cyan-400 transition-colors mt-2 disabled:opacity-50"
                        aria-label="Play text to speech"
                    >
                        <Icon icon="speaker" className="w-5 h-5"/>
                    </button>
                 )}
            </div>
             {message.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                <Icon icon="user" className="w-5 h-5 text-gray-300" />
              </div>
            )}
          </div>
        ))}
        {appStatus === AppStatus.THINKING && (
            <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center flex-shrink-0">
                    <Icon icon="bot" className="w-5 h-5 text-white" />
                </div>
                <div className="max-w-xl p-4 rounded-lg bg-gray-700/50 flex items-center">
                    <Icon icon="spinner" className="w-5 h-5 text-cyan-400 animate-spin mr-2" />
                    <span className="text-gray-400">Thinking...</span>
                </div>
            </div>
        )}
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-gray-700/50 flex-shrink-0">
        <div className="relative bg-gray-700/70 rounded-xl">
          <textarea
            ref={textareaRef}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? "Listening..." : isDone ? "Ask for final tweaks or download your resume." : "Type or click the mic to talk..."}
            disabled={isInputDisabled}
            className="w-full bg-transparent text-gray-200 rounded-xl p-4 pr-32 border border-transparent focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
            rows={1}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
            <button
                onClick={onToggleRecording}
                disabled={appStatus === AppStatus.THINKING || isDone}
                className={`p-2.5 rounded-full text-white transition-all duration-200 ${isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-cyan-500 hover:bg-cyan-600'} disabled:bg-gray-600 disabled:cursor-not-allowed`}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
                <Icon icon="microphone" className="w-5 h-5" />
            </button>
            <button 
                onClick={handleSend}
                disabled={!userInput.trim() || isInputDisabled}
                className="p-2.5 rounded-full bg-cyan-500 text-white hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                aria-label="Send message"
            >
                <Icon icon="send" className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};