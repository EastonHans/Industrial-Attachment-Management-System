import jsPDF from 'jspdf';

/**
 * Generates an introductory letter for industrial attachment (CUEA format)
 */
export const generateIntroductoryLetter = (
  studentName: string,
  registrationNumber: string,
  program: string,
  year: string,
  attachmentPeriod: string,
  date: string = new Date().toLocaleDateString()
): string => {
  return `THE CATHOLIC UNIVERSITY OF EASTERN AFRICA
FACULTY OF SCIENCE
DEPARTMENT OF COMPUTER AND INFORMATION SCIENCE

${date}

To Whom It May Concern,

Dear Sir/Madam,

Re: Attachment/Internship for: ${studentName}\nRegistration No.: ${registrationNumber}

The above named is a ${year} year student taking a four-year Degree programme at The Catholic University of Eastern Africa in the Faculty of Science, Department of Computer and Information Science. The student is taking a Bachelor of Science in ${program}.

The Faculty believes that through Industrial attachments/internships the students will be able to tap a wide range of experience, skills and knowledge that would be difficult to replicate in a classroom setting or through written material alone.

To expedite the process, we are therefore, requesting you to consider our student for attachment within the months of ${attachmentPeriod} 2024 when on long vacation and perhaps, let us know how we can proceed to establish the envisaged inter-organization linkage.

I highly recommend the student for any attachment that may exist in your esteemed firm.

______________________________
Dr. Elicah Wabululu
Industrial Attachment Coordinator
`;
};

/**
 * Generates an insurance cover letter for industrial attachment (CUEA format)
 */
export const generateInsuranceLetter = (
  studentName: string,
  registrationNumber: string,
  program: string,
  date: string = new Date().toLocaleDateString()
): string => {
  return `THE CATHOLIC UNIVERSITY OF EASTERN AFRICA
Office of the Dean of Students

Date: ${date}

TO WHOM IT MAY CONCERN

Dear Sir/Madam,

RE: ${studentName} REG. NO. ${registrationNumber}

The above named person is a student at the Catholic University of Eastern Africa in the Faculty of Science, specializing in ${program}.

Kindly be informed that all our students have accident cover which is 24hrs within or outside the campus (Catholic University of Eastern Africa). The cover is specifically Accident and NOT medical cover. The Insurer is Pacis Insurance Co. Ltd, Policy No. is 010/0092/009793/2020 and the cover period is 1st November 2023 – 31st October 2024.

Any assistance accorded will be highly appreciated.

Yours faithfully,

______________________________
Samuel Wakwanya
DEAN OF STUDENTS
`;
};

/**
 * Downloads a letter as a PDF file with proper formatting
 */
export const downloadLetter = (content: string, filename: string): void => {
  // Create a new PDF document with A4 size
  const doc = new jsPDF('portrait', 'mm', 'a4');
  
  // Page dimensions (A4: 210mm x 297mm)
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20; // 20mm margins
  const maxLineWidth = pageWidth - (2 * margin);
  
  // Font settings
  doc.setFont('Times', 'normal');
  doc.setFontSize(12);
  
  // Split content into lines
  const lines = content.split('\n');
  let y = margin; // Starting y position
  
  lines.forEach((line) => {
    // Check if we need a new page
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    
    // Handle empty lines
    if (line.trim() === '') {
      y += 5; // Add small space for empty lines
      return;
    }
    
    // Handle special formatting
    if (line.includes('THE CATHOLIC UNIVERSITY OF EASTERN AFRICA')) {
      doc.setFont('Times', 'bold');
      doc.setFontSize(14);
      // Center the university name
      const textWidth = doc.getTextWidth(line);
      const x = (pageWidth - textWidth) / 2;
      doc.text(line, x, y);
      doc.setFont('Times', 'normal');
      doc.setFontSize(12);
      y += 8;
      return;
    }
    
    // Handle department/faculty lines (smaller, centered)
    if (line.includes('FACULTY') || line.includes('DEPARTMENT')) {
      doc.setFontSize(11);
      const textWidth = doc.getTextWidth(line);
      const x = (pageWidth - textWidth) / 2;
      doc.text(line, x, y);
      doc.setFontSize(12);
      y += 6;
      return;
    }
    
    // Handle subject line (bold)
    if (line.startsWith('Re:')) {
      doc.setFont('Times', 'bold');
      doc.text(line, margin, y);
      doc.setFont('Times', 'normal');
      y += 8;
      return;
    }
    
    // Handle signature line
    if (line.includes('___________')) {
      y += 10; // Extra space before signature
      doc.text(line, margin, y);
      y += 6;
      return;
    }
    
    // Handle normal text with word wrapping
    if (line.length > 0) {
      const splitText = doc.splitTextToSize(line, maxLineWidth);
      splitText.forEach((textLine: string) => {
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(textLine, margin, y);
        y += 6; // Line height
      });
    }
  });
  
  // Save the PDF
  doc.save(filename);
}; 