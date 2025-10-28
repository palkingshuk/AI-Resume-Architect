import React from 'react';
import { ResumeData, Section } from '../types';
import { Icon } from './Icon';

interface ResumePreviewProps {
  resumeData: ResumeData;
  onDownload: () => void;
  isDone: boolean;
  onShowChat?: () => void;
}

const SECTION_TITLES: Record<keyof ResumeData, string> = {
  [Section.CONTACT]: 'Contact Information',
  [Section.SUMMARY]: 'Professional Summary',
  [Section.EXPERIENCE]: 'Work Experience',
  [Section.EDUCATION]: 'Education',
  [Section.SKILLS]: 'Skills',
  [Section.PROJECTS]: 'Projects',
};

const SECTION_ORDER: (keyof ResumeData)[] = [
    Section.CONTACT,
    Section.SUMMARY,
    Section.EXPERIENCE,
    Section.EDUCATION,
    Section.SKILLS,
    Section.PROJECTS
];

export const ResumePreview: React.FC<ResumePreviewProps> = ({ resumeData, onDownload, isDone, onShowChat }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <h2 className="text-2xl font-semibold text-gray-200">Resume Preview</h2>
        <div className="flex items-center gap-4">
            {isDone && (
                <button
                onClick={onDownload}
                className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2.5 px-4 rounded-lg flex items-center transition-colors duration-200"
                >
                <Icon icon="download" className="w-5 h-5 sm:mr-2" />
                <span className="hidden sm:inline">Download</span>
                </button>
            )}
            {onShowChat && (
                <button
                    onClick={onShowChat}
                    className="p-2.5 rounded-full bg-gray-700/80 hover:bg-gray-700 transition-colors lg:hidden"
                    aria-label="Show Chat"
                >
                    <Icon icon={'chat-bubble'} className="w-6 h-6 text-cyan-400" />
                </button>
            )}
        </div>
      </div>
      <div className="bg-gray-900/70 rounded-xl p-6 flex-grow overflow-y-auto text-gray-300 resume-preview">
        {Object.keys(resumeData).length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>Your resume content will appear here as you complete each section.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {SECTION_ORDER.map(sectionKey => {
                 const content = resumeData[sectionKey];
                 if (!content) return null;
                 return (
                    <div key={sectionKey}>
                        <h3 className="text-xl font-bold text-cyan-400 border-b border-gray-700/50 pb-3 mb-4">
                            {SECTION_TITLES[sectionKey]}
                        </h3>
                        <div className="whitespace-pre-wrap font-light leading-loose text-gray-300">{content}</div>
                    </div>
                 )
            })}
          </div>
        )}
      </div>
    </div>
  );
};