import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { useAuth } from '../contexts/AuthContext_django';
import { browserPDFProcessor } from '../utils/browserPDFProcessor';
import { tokenManager } from '../services/djangoApi';

interface IntelligentVerificationResult {
  eligible: boolean;
  requirements: {
    overall: boolean;
    name_matched: boolean;
    has_required_units: boolean;
    no_incompletes: boolean;
    meets_year_requirement: boolean;
    required_units: number;
    completed_units: number;
    incomplete_count: number;
    summary: string;
  };
  extracted_data: {
    student_name: string;
    program: string;
    year: number;
    semester: number;
    total_units: number;
    completed_units: number;
    gpa: number | null;
    units_count: number;
  };
  name_matching: {
    is_match: boolean;
    confidence: number;
    method: string;
    explanation: string;
  };
  processing_details: {
    pdf_analysis: {
      is_digital: boolean;
      text_coverage: number;
      extraction_method: string;
      confidence: number;
    };
    extraction: {
      method: string;
      confidence: number;
      processing_time: number;
      page_count: number;
      text_length: number;
    };
    confidence_scores: {
      name: number;
      program: number;
      units: number;
      overall: number;
    };
  };
}

interface FeeStatementResult {
  balance: number | null;
  balance_cleared: boolean;
  extracted_text: string;
  ocr_confidence: number;
  ocr_method: string;
  processing_time: number;
  errors: string[];
  [key: string]: any;
}

const API_BASE_URL = import.meta.env.VITE_DJANGO_API_URL || 'http://localhost:8080/api';
const API_INTELLIGENT_VERIFICATION = `${API_BASE_URL}/documents/verify/`;
const API_FEESTATEMENT = `${API_BASE_URL}/ocr/fee-statement/`;

interface DocumentVerificationTabsProps {
  onVerificationUpdate?: () => void;
}

export default function DocumentVerificationTabs({ onVerificationUpdate }: DocumentVerificationTabsProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<'transcript' | 'fee'>('transcript');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intelligentResult, setIntelligentResult] = useState<IntelligentVerificationResult | null>(null);
  const [feeResult, setFeeResult] = useState<FeeStatementResult | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [browserResult, setBrowserResult] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setIntelligentResult(null);
      setFeeResult(null);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setIntelligentResult(null);
    setFeeResult(null);

    if (!file) {
      setError('Please select a PDF file.');
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('document', file);

    try {
      let url = '';
      if (tab === 'transcript') {
        url = `${API_INTELLIGENT_VERIFICATION}${debugMode ? '?debug=true' : ''}`;
      } else {
        formData.append('file', file);
        url = API_FEESTATEMENT;
      }

      const headers: any = {};
      const token = tokenManager.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const resp = await fetch(url, {
        method: 'POST',
        body: formData,
        headers,
        credentials: 'include',
      });

      const data = await resp.json();
      
      if (!resp.ok || data.success === false) {
        setError(data.error || 'Processing failed.');
      } else {
        if (tab === 'transcript') {
          setIntelligentResult(data.verification_result);
        } else {
          setFeeResult(data);
        }
        
        // Trigger verification status update in parent component
        if (onVerificationUpdate) {
          onVerificationUpdate();
        }
      }
    } catch (err) {
      console.error('Processing error:', err);
      setError('Network or server error. Try browser fallback below.');
      setShowFallback(true);
    } finally {
      setLoading(false);
    }
  };

  const handleBrowserFallback = async () => {
    if (!file) return;
    
    setLoading(true);
    setError(null);
    setBrowserResult(null);
    
    try {
      console.log('Starting browser-based PDF processing...');
      const result = await browserPDFProcessor.extractText(file);
      const structuredData = browserPDFProcessor.extractStructuredData(result.text);
      
      setBrowserResult({
        ...result,
        structuredData,
        note: 'This is a browser-based extraction fallback. For full verification features, please ensure the backend is running.'
      });
      
      console.log('Browser processing complete:', result);
      
    } catch (err) {
      console.error('Browser processing error:', err);
      setError('Browser-based processing also failed. Please check your PDF file.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 max-w-2xl mx-auto mt-8">
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'transcript' | 'fee')} className="mb-6">
        <TabsList>
          <TabsTrigger value="transcript">Transcript Verification</TabsTrigger>
          <TabsTrigger value="fee">Fee Statement Verification</TabsTrigger>
        </TabsList>
        <TabsContent value="transcript">
          <form onSubmit={handleSubmit} className="space-y-4">

            <Input 
              type="file" 
              accept="application/pdf" 
              onChange={handleFileChange}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            
            {file && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-green-800 font-medium">Selected: {file.name}</span>
                  <span className="text-green-600 text-sm">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
              </div>
            )}


            <Button type="submit" disabled={loading || !file} className="w-full">
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Processing Document...</span>
                </div>
              ) : (
                '🔍 Verify Transcript'
              )}
            </Button>
            
            {loading && <Progress className="w-full" />}
            {error && <div className="text-red-600 font-semibold mt-2 p-3 bg-red-50 rounded">{error}</div>}
            
            {/* Browser Fallback Section */}
            {showFallback && !intelligentResult && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="text-lg font-semibold text-yellow-800 mb-2">🌐 Browser-Based Processing</h4>
                <p className="text-yellow-700 text-sm mb-3">
                  The backend service is unavailable. Try processing your PDF directly in the browser as a fallback option.
                </p>
                <Button 
                  onClick={handleBrowserFallback} 
                  disabled={loading || !file}
                  variant="outline"
                  className="w-full border-yellow-300 text-yellow-800 hover:bg-yellow-100"
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                      <span>Processing in Browser...</span>
                    </div>
                  ) : (
                    '🔍 Try Browser Processing'
                  )}
                </Button>
              </div>
            )}
            
            {/* Browser Processing Results */}
            {browserResult && (
              <div className="mt-6 space-y-4">
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl text-blue-600">🌐</span>
                    <div>
                      <h3 className="text-xl font-bold text-blue-800">DOCUMENT PROCESSED</h3>
                      <p className="text-sm text-blue-700">Text extracted successfully from your PDF document</p>
                    </div>
                  </div>
                </div>

                {/* Warning about manual verification needed */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <span className="text-yellow-500 text-xl">⚠️</span>
                    <div>
                      <h4 className="font-semibold text-yellow-800">Manual Verification Required</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        The document was processed using browser extraction. For full automatic verification, 
                        please contact your academic office or try again when the verification service is available.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Simplified Extracted Data */}
                {browserResult.structuredData && (
                  <div className="bg-white border rounded-lg p-4">
                    <h4 className="text-lg font-semibold mb-3">📋 Found in Your Document</h4>
                    <div className="space-y-3 text-sm">
                      {browserResult.structuredData.courseCodes?.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700">Course Codes:</span>
                          <p className="text-gray-900">{browserResult.structuredData.courseCodes.length} courses found</p>
                        </div>
                      )}
                      {browserResult.structuredData.grades?.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700">Grades:</span>
                          <p className="text-gray-900">{browserResult.structuredData.grades.length} grades extracted</p>
                        </div>
                      )}
                      {browserResult.structuredData.gpaInfo?.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700">GPA Info:</span>
                          <p className="text-gray-900">{browserResult.structuredData.gpaInfo.join(', ')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Contact Information */}
                <div className="bg-gray-50 border rounded-lg p-4">
                  <h4 className="text-lg font-semibold mb-2">📞 Need Help?</h4>
                  <p className="text-sm text-gray-700">
                    If you need official verification, please contact your academic registrar's office with your transcript document.
                  </p>
                </div>
              </div>
            )}
            
            {intelligentResult && (
              <div className="mt-6 space-y-6">
                {/* Main Result Card */}
                <div className={`border-2 rounded-xl p-6 text-center ${
                  intelligentResult.eligible 
                    ? 'border-green-400 bg-gradient-to-br from-green-50 to-green-100' 
                    : 'border-red-400 bg-gradient-to-br from-red-50 to-red-100'
                }`}>
                  <div className="flex flex-col items-center space-y-4">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                      intelligentResult.eligible ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      <span className="text-4xl text-white">
                        {intelligentResult.eligible ? '✓' : '✗'}
                      </span>
                    </div>
                    <div>
                      <h2 className={`text-3xl font-bold ${
                        intelligentResult.eligible ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {intelligentResult.eligible ? 'CONGRATULATIONS!' : 'NOT ELIGIBLE'}
                      </h2>
                      <p className={`text-lg mt-2 ${
                        intelligentResult.eligible ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {intelligentResult.eligible 
                          ? 'You meet all the requirements for industrial attachment application'
                          : 'Your transcript does not meet the current requirements'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Requirements Status */}
                {!intelligentResult.eligible && (
                  <div className="bg-white border border-red-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold mb-4 text-red-800">📋 Why You're Not Eligible</h4>
                    <div className="space-y-3">
                      {!intelligentResult.requirements?.name_matched && (
                        <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                          <span className="text-red-500 text-xl">❌</span>
                          <div>
                            <p className="font-medium text-red-800">Name Verification Failed</p>
                            <p className="text-sm text-red-600">The name on your transcript doesn't match your registered name</p>
                          </div>
                        </div>
                      )}
                      {!intelligentResult.requirements?.has_required_units && (
                        <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                          <span className="text-red-500 text-xl">❌</span>
                          <div>
                            <p className="font-medium text-red-800">Insufficient Completed Courses</p>
                            <p className="text-sm text-red-600">
                              You have {intelligentResult.requirements?.completed_units || 0} completed courses, but need {intelligentResult.requirements?.required_units || 0}
                            </p>
                          </div>
                        </div>
                      )}
                      {!intelligentResult.requirements?.no_incompletes && (
                        <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                          <span className="text-red-500 text-xl">❌</span>
                          <div>
                            <p className="font-medium text-red-800">Incomplete Courses</p>
                            <p className="text-sm text-red-600">
                              You have {intelligentResult.requirements?.incomplete_count || 0} incomplete courses that need to be resolved
                            </p>
                          </div>
                        </div>
                      )}
                      {!intelligentResult.requirements?.meets_year_requirement && (
                        <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                          <span className="text-red-500 text-xl">❌</span>
                          <div>
                            <p className="font-medium text-red-800">Academic Level Requirement Not Met</p>
                            <p className="text-sm text-red-600">
                              You must be in at least Year 3 Semester 2 (for degree) or Year 2 Semester 2 (for diploma)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {intelligentResult.eligible && (
                  <div className="bg-white border border-green-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold mb-4 text-green-800">✅ Requirements Met</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                        <span className="text-green-500 text-xl">✓</span>
                        <div>
                          <p className="font-medium text-green-800">Name Verified</p>
                          <p className="text-sm text-green-600">Identity confirmed</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                        <span className="text-green-500 text-xl">✓</span>
                        <div>
                          <p className="font-medium text-green-800">Courses Completed</p>
                          <p className="text-sm text-green-600">{intelligentResult.requirements?.completed_units || 0} courses</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                        <span className="text-green-500 text-xl">✓</span>
                        <div>
                          <p className="font-medium text-green-800">Academic Standing</p>
                          <p className="text-sm text-green-600">Year {intelligentResult.extracted_data?.year || 'N/A'}, Semester {intelligentResult.extracted_data?.semester || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                        <span className="text-green-500 text-xl">✓</span>
                        <div>
                          <p className="font-medium text-green-800">No Issues</p>
                          <p className="text-sm text-green-600">All requirements satisfied</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h5 className="font-semibold text-blue-800 mb-2">🎉 Next Steps</h5>
                      <p className="text-blue-700 text-sm">
                        Congratulations! You can now proceed with your industrial attachment application. 
                        Print this verification or take a screenshot for your records.
                      </p>
                    </div>
                  </div>
                )}

                {/* Summary Information */}
                <details className="bg-gray-50 border rounded-lg p-4">
                  <summary className="cursor-pointer text-lg font-semibold text-gray-700 hover:text-gray-900">
                    📄 Document Summary
                  </summary>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium text-gray-700">Student Name:</span>
                        <p className="text-gray-900">{intelligentResult.extracted_data?.student_name || 'Not found'}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Program:</span>
                        <p className="text-gray-900">{intelligentResult.extracted_data?.program || 'Not found'}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium text-gray-700">Academic Level:</span>
                        <p className="text-gray-900">Year {intelligentResult.extracted_data?.year || 'N/A'}, Semester {intelligentResult.extracted_data?.semester || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Courses Completed:</span>
                        <p className="text-gray-900">{intelligentResult.requirements?.completed_units || 0} courses</p>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            )}
          </form>
        </TabsContent>
        <TabsContent value="fee">
          <form onSubmit={handleSubmit} className="space-y-4">

            <Input 
              type="file" 
              accept="application/pdf,image/*" 
              onChange={handleFileChange}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
            />
            
            {file && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-green-800 font-medium">Selected: {file.name}</span>
                  <span className="text-green-600 text-sm">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
              </div>
            )}

            <Button type="submit" disabled={loading || !file} className="w-full">
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Processing Document...</span>
                </div>
              ) : (
                '💳 Verify Fee Statement'
              )}
            </Button>
            
            {loading && <Progress className="w-full" />}
            {error && <div className="text-red-600 font-semibold mt-2 p-3 bg-red-50 rounded">{error}</div>}
            
            {feeResult && (
              <div className="mt-6 space-y-4">
                <div className={`border-2 rounded-lg p-4 ${
                  feeResult.balance_cleared 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-orange-500 bg-orange-50'
                }`}>
                  <div className="flex items-center space-x-3">
                    <span className={`text-2xl ${feeResult.balance_cleared ? 'text-green-600' : 'text-orange-600'}`}>
                      {feeResult.balance_cleared ? '✅' : '⚠️'}
                    </span>
                    <div>
                      <h3 className={`text-xl font-bold ${
                        feeResult.balance_cleared ? 'text-green-800' : 'text-orange-800'
                      }`}>
                        {feeResult.balance_cleared ? 'BALANCE CLEARED' : 'OUTSTANDING BALANCE'}
                      </h3>
                      <p className={`text-sm ${
                        feeResult.balance_cleared ? 'text-green-700' : 'text-orange-700'
                      }`}>
                        Balance: {feeResult.balance_display || (feeResult.balance !== null ? `KSH ${feeResult.balance}` : 'N/A')}
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </form>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
