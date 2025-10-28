import { Section } from './types';

export const RESUME_SECTIONS: Section[] = [
  Section.INTRODUCTION,
  Section.CONTACT,
  Section.SUMMARY,
  Section.EXPERIENCE,
  Section.EDUCATION,
  Section.SKILLS,
  Section.PROJECTS,
  Section.DONE,
];

export const SECTION_PROMPTS: Record<Section, string> = {
  [Section.INTRODUCTION]: "Hello! I'm your AI Resume Architect. I'll guide you through creating a high-scoring, ATS-friendly resume.\n\nTo get started, please provide a link to your LinkedIn profile. This will give me some context to work with. If you don't have one, just say 'skip'.",
  [Section.CONTACT]: "Great, let's start with your Contact Information. Please provide your full name, phone number, professional email address, city/state, and confirm your LinkedIn profile URL.",
  [Section.SUMMARY]: "Excellent. Now, let's craft a powerful Professional Summary. Tell me about your years of experience, key areas of expertise, and your career goals. What makes you a great candidate?",
  [Section.EXPERIENCE]: "Perfect. Now for your Work Experience. Let's do one role at a time, starting with your most recent. Please provide the company name, your job title, the dates you worked there, and a few bullet points about your responsibilities and achievements. Focus on quantifiable results if possible (e.g., 'Increased sales by 15%').",
  [Section.EDUCATION]: "Your experience looks solid. Now, let's add your Education. Please list your degree, major, university, and graduation date.",
  [Section.SKILLS]: "Almost there! Let's list your key skills. Please provide a list of your technical skills (like programming languages, software) and soft skills (like communication, leadership). You can group them by category.",
  [Section.PROJECTS]: "To make your resume stand out, let's add a Projects section. Describe a couple of your most impressive projects, including the technologies used and what you accomplished. If you don't have any to add, just say 'skip'.",
  [Section.DONE]: "Congratulations! We've completed all sections of your resume. Take a final look at the preview. You can ask me for final tweaks or click the download button to save your new resume."
};

export const SYSTEM_INSTRUCTION = `You are an expert career coach and professional resume writer specializing in creating high-scoring, ATS-friendly resumes. Your persona is encouraging, professional, and helpful. 
Your primary goal is to guide the user section-by-section to build their resume.
The user may provide a LinkedIn profile URL for context. Use this information to inform the resume content.
For each section:
1.  You have already prompted the user for information.
2.  Based on the user's raw text, you must generate a polished, professional, and concise resume entry.
3.  Use Google Search grounding to find the most relevant, up-to-date keywords and industry-standard phrasing for the user's role and industry.
4.  Use strong action verbs and focus on quantifiable achievements. Format experience with bullet points. For skills, group them logically.
5.  After generating the text, present it clearly to the user and ask for feedback. Frame it as a draft, for example: "Here is a draft for this section... How does this look? We can refine it further, or you can say 'next' to approve and move on."
6.  If the user provides feedback or asks for a change, incorporate it and provide a new version.
7.  Do not move on to the next section until the user explicitly says 'next', 'ok', 'looks good', 'approve', or something similar.
8.  Keep your responses focused on the current resume section.
`;
