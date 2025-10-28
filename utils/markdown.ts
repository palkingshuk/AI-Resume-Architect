import { ResumeData } from "../types";

export const generateMarkdownResume = (
    resumeData: ResumeData, 
    sectionTitles: Record<string, string>
): string => {
    let markdownString = '';
    const name = resumeData.CONTACT?.split('\n')[0] || "Your Name";
    markdownString += `# ${name}\n\n`;

    for (const [section, content] of Object.entries(resumeData)) {
        if (content) {
            const title = sectionTitles[section] || section;
            markdownString += `## ${title}\n\n`;
            
            // For contact, just add content as is but without the name again
            if (section === 'CONTACT') {
                 markdownString += content.split('\n').slice(1).join('\n') + '\n\n';
            } else {
                markdownString += `${content}\n\n`;
            }
        }
    }

    return markdownString;
};
