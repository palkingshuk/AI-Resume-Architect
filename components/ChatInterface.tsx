import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AppStatus, TTSState, GroundedSource } from '../types';
import { Icon } from './Icon';

interface ChatInterfaceProps {
  chatHistory: ChatMessage[];
  appStatus: AppStatus;
  onUserSubmit: (userInput: string) => void;
  isRecording: boolean;
  onToggleRecording: () => void;
  liveTranscript: string;
}

const ChatBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const [ttsState, setTtsState] = useState<TTSState>(TTSState.IDLE);
    
    // NOTE: Audio playback logic has been moved to the App component
    // to enable the global auto-speak feature. The per-message button
    // could be re-enabled by passing down a playback handler.

    const renderContent = () => {
      let content = message.content;
      // Basic markdown for bullet points
      content = content.replace(/^\s*([*-])\s/gm, '• ');
      return <div className="whitespace-pre-wrap">{content}</div>;
    };

    const renderSources = (sources: GroundedSource[]) => (
        <div className="mt-2 border-t border-gray-300 dark:border-gray-600 pt-2">
            <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400">Sources:</h4>
            <ul className="list-none p-0 m-0">
                {sources.map((source, index) => (
                    <li key={index} className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate">
                        <a href={source.uri} target="_blank" rel="noopener noreferrer" title={source.title}>
                            {source.title || source.uri}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );

    return (
        <div className={`flex items-start gap-3 my-4 ${message.role === 'user' ? 'justify-end' : ''}`}>
        {message.role === 'model' && (
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                <Icon icon="bot" className="w-5 h-5" />
            </div>
        )}
        <div className={`p-3 rounded-lg max-w-lg ${message.role === 'user' ? 'bg-blue-100 dark:bg-blue-800 text-gray-900 dark:text-gray-100' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}>
            {renderContent()}
            {message.sources && message.sources.length > 0 && renderSources(message.sources)}
        </div>
        {message.role === 'user' && (
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-800 dark:text-gray-200">
                <Icon icon="user" className="w-5 h-5" />
            </div>
        )}
        </div>
    );
};


export const ChatInterface: React.FC<ChatInterfaceProps> = ({ chatHistory, appStatus, onUserSubmit, isRecording, onToggleRecording, liveTranscript }) => {
  const [userInput, setUserInput] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);
  
  useEffect(() => {
    setUserInput(liveTranscript);
  }, [liveTranscript]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || appStatus === AppStatus.THINKING) return;
    onUserSubmit(userInput);
    setUserInput('');
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e as any);
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 md:rounded-lg shadow-md">
      <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto">
        {chatHistory.map((msg, index) => (
          <ChatBubble key={index} message={msg} />
        ))}
        {appStatus === AppStatus.THINKING && (
          <div className="flex items-start gap-3 my-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                <Icon icon="bot" className="w-5 h-5" />
            </div>
            <div className="p-3 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 flex items-center">
                <Icon icon="spinner" className="w-5 h-5 animate-spin mr-2" />
                <span>Thinking...</span>
            </div>
          </div>
        )}
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleRecording}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-full transition-colors disabled:opacity-50"
            disabled={appStatus === AppStatus.THINKING}
          >
            <Icon icon="microphone" className={`w-6 h-6 ${isRecording ? 'text-red-500' : ''}`} />
          </button>
          <textarea
            ref={textareaRef}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type or click the mic to talk..."
            className="flex-grow p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 resize-none"
            rows={1}
            disabled={appStatus === AppStatus.THINKING}
          />
          <button
            type="submit"
            className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-300 dark:disabled:bg-blue-800"
            disabled={!userInput.trim() || appStatus === AppStatus.THINKING}
          >
            <Icon icon="send" className="w-6 h-6" />
          </button>
        </form>
      </div>
    </div>
  );
};