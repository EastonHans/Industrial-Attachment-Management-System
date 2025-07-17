import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { processTranscriptFile, TranscriptVerificationResult } from '../utils/transcriptProcessor';
import { generateIntroductoryLetter, generateInsuranceLetter, downloadLetter } from '../utils/letterGenerator';

export default function Dashboard() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [verificationResult, setVerificationResult] = useState<TranscriptVerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load verification status from localStorage on component mount
  useEffect(() => {
    const savedVerification = localStorage.getItem('verificationResult');
    if (savedVerification) {
      setVerificationResult(JSON.parse(savedVerification));
    }
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFile || !user) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await processTranscriptFile(
        selectedFile,
        user.displayName || '',
        'Bachelor of Science in Computer Science',
        3,
        1
      );
      setVerificationResult(result);
      // Save verification result to localStorage
      localStorage.setItem('verificationResult', JSON.stringify(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadIntroductoryLetter = () => {
    if (!user) return;
    
    const letter = generateIntroductoryLetter(
      user.displayName || 'Student Name',
      user.uid,
    );
    downloadLetter(letter, 'introductory_letter.pdf');
  };

  const handleDownloadInsuranceLetter = () => {
    if (!user) return;
    
    const letter = generateInsuranceLetter(
      user.displayName || 'Student Name',
      user.uid,
    );
    downloadLetter(letter, 'insurance_cover_letter.pdf');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Transcript Verification</h2>
            
            {!verificationResult ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Upload Transcript
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="mt-1 block w-full"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!selectedFile || isLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                >
                  {isLoading ? 'Verifying...' : 'Verify Transcript'}
                </button>
                {error && (
                  <p className="mt-2 text-sm text-red-600">{error}</p>
                )}
              </form>
            ) : (
              <div className="space-y-4">
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Verification Result
                    </h3>
                  </div>
                  <div className="border-t border-gray-200">
                    <dl>
                      <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Eligibility</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          {verificationResult.eligible ? 'Eligible' : 'Not Eligible'}
                        </dd>
                      </div>
                      <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Completed Units</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          {verificationResult.completedUnits} / {verificationResult.requiredUnits}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {verificationResult.eligible && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Download Required Documents</h3>
                    <div className="space-y-4">
                      <button
                        onClick={handleDownloadIntroductoryLetter}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Download Introductory Letter
                      </button>
                      <button
                        onClick={handleDownloadInsuranceLetter}
                        className="ml-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        Download Insurance Cover Letter
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 