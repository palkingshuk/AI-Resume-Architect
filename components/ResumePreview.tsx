import React from 'react';
import { ResumeData, Section } from '../types';
import { RESUME_SECTIONS } from '../constants';
import { generateMarkdownResume } from '../utils/markdown';
import { Icon } from './Icon';

interface ResumePreviewProps {
  resumeData: ResumeData;
  currentSection: Section;
}

// Map Section enum to display titles
const SECTION_TITLES: Record<string, string> = {
    [Section.CONTACT]: 'Contact Information',
    [Section.SUMMARY]: 'Professional Summary',
    [Section.EXPERIENCE]: 'Work Experience',
    [Section.EDUCATION]: 'Education',
    [Section.SKILLS]: 'Skills',
    [Section.PROJECTS]: 'Projects',
};

export const ResumePreview: React.FC<ResumePreviewProps> = ({ resumeData, currentSection }) => {

  const handleDownload = () => {
    const markdown = generateMarkdownResume(resumeData, SECTION_TITLES);
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

  const renderSection = (section: Exclude<Section, Section.INTRODUCTION | Section.DONE>) => {
    const content = resumeData[section];
    if (!content) return null;

    const title = SECTION_TITLES[section] || section;

    return (
      <div key={section} className="mb-6">
        <h2 className={`text-xl font-bold border-b-2 mb-2 pb-1 ${currentSection === section ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-gray-300 dark:border-gray-600'}`}>
          {title}
        </h2>
        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-gray-700 dark:text-gray-300">
          {section === 'CONTACT' ? content.split('\n').slice(1).join('\n') : content}
        </div>
      </div>
    );
  };
  
  const name = resumeData.CONTACT?.split('\n')[0] || 'Your Name';

  return (
    <div className="p-6 bg-white dark:bg-gray-800 md:rounded-lg shadow-md h-full flex flex-col text-gray-900 dark:text-gray-100">
      <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">{name}</h1>
          <button
            onClick={handleDownload}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-300"
            disabled={Object.keys(resumeData).length === 0}
            title="Download as Markdown"
          >
            <Icon icon="download" className="h-5 w-5 mr-2" />
            Download
          </button>
      </div>
      <div className="flex-grow overflow-y-auto">
        {RESUME_SECTIONS.filter(
          (sec): sec is Exclude<Section, Section.INTRODUCTION | Section.DONE> => sec !== Section.INTRODUCTION && sec !== Section.DONE
        ).map(renderSection)}
      </div>
    </div>
  );
};