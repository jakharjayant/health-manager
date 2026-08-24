import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock' });

export async function generatePreVisitSummary(symptomsRaw: string) {
  if (process.env.MOCK_LLM === 'true') {
    return {
      urgencyLevel: 'Medium',
      chiefComplaint: 'Mocked complaint based on ' + symptomsRaw.substring(0, 20),
      questions: JSON.stringify(['How long has this lasted?', 'Is there pain?', 'Any other symptoms?'])
    };
  }
  
  const prompt = `Analyse these symptoms and return JSON with keys: urgencyLevel (Low / Medium / High), chiefComplaint, and questions (array of exactly three suggested questions for the doctor). Symptoms: ${symptomsRaw}`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    const txt = response.text || "{}";
    const data = JSON.parse(txt);
    return {
      urgencyLevel: data.urgencyLevel || 'Medium',
      chiefComplaint: data.chiefComplaint || 'Unknown',
      questions: JSON.stringify(data.questions || [])
    };
  } catch(e) {
    console.error("LLM Error", e);
    return { urgencyLevel: 'Medium', chiefComplaint: 'Failed to analyze', questions: '[]' };
  }
}

export async function generatePostVisitSummary(notesRaw: string) {
  if (process.env.MOCK_LLM === 'true') {
    return {
      patientSummary: 'Mocked summary based on notes.',
      medicationSchedule: 'Mocked schedule',
      followUpSteps: 'Mocked steps'
    };
  }
  const prompt = `Convert these clinical notes into a patient-friendly summary. Return JSON with keys: patientSummary, medicationSchedule, followUpSteps. Notes: ${notesRaw}`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    const data = JSON.parse(response.text || "{}");
    return {
      patientSummary: data.patientSummary || 'No summary',
      medicationSchedule: data.medicationSchedule || 'No schedule',
      followUpSteps: data.followUpSteps || 'No steps'
    };
  } catch(e) {
    console.error("LLM Error", e);
    return { patientSummary: 'Failed to generate', medicationSchedule: '', followUpSteps: '' };
  }
}\n