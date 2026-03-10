import './index.css';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileText, Activity, TrendingUp, Download, MessageCircle, 
  AlertTriangle, CheckCircle, ChevronRight, Copy, RefreshCw, Info, Eye
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function App() {
  const [activeTab, setActiveTab] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [fileName, setFileName] = useState("");
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false);

  // Dynamically load PDF.js for text extraction
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
    script.async = true;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
      setPdfJsLoaded(true);
    };
    document.body.appendChild(script);

    return () => {
      if (document.body && document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    customerName: '',
    quoteDate: '',
    monthlySavings: '',
    systemPrice: '',
    existingPf: '0.80',
    avgMonthlyKwh: '50000'
  });

  // Metrics State
  const [metrics, setMetrics] = useState({
    monthsElapsed: 0,
    daysElapsed: 0,
    totalLoss: 0,
    dailyLoss: 0,
    isFree: false,
    savedUnits: 0
  });

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const parseExtractedDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.trim().split(/[-./]/);
    if (parts.length === 3) {
      let [day, month, year] = parts;
      if (year.length === 2) year = '20' + year;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return '';
  };

  const cleanNumber = (numStr) => {
    if (!numStr) return '';
    const cleaned = numStr.split('/')[0].replace(/[^\d.]/g, '');
    return Math.floor(parseFloat(cleaned)).toString();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);

    if (file.type === 'application/pdf' && pdfJsLoaded) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + ' ';
        }

        const nameMatch = fullText.match(/Cons\.\s*Name\s*[:\-]\s*([a-zA-Z0-9\s.,&()\/]+?)(?=\s\s|Cons\. No|Date|$)/i);
        const dateMatch = fullText.match(/Date\s*[\n\r]*\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i);
        const savingsMatch = fullText.match(/In\s*Amount\s*Rs\.\s*[:\-]?\s*([\d,.]+)/i);
        const priceMatch = fullText.match(/System\s*Price\s*Rs\.\s*[:\-]?\s*([\d,.]+)/i);
        const pfMatch = fullText.match(/Min\.\s*Existing\s*PF\s*[:\-]?\s*([\d.]+)/i);

        const extractedData = {
          customerName: nameMatch ? nameMatch[1].trim() : '',
          quoteDate: dateMatch ? parseExtractedDate(dateMatch[1]) : '',
          monthlySavings: savingsMatch ? cleanNumber(savingsMatch[1]) : '',
          systemPrice: priceMatch ? cleanNumber(priceMatch[1]) : '',
          existingPf: pfMatch ? pfMatch[1].trim() : '0.80',
          avgMonthlyKwh: '50000'
        };

        setFormData(extractedData);
        showNotification(`Successfully extracted data from PDF!`);
      } catch (error) {
        console.error("PDF Parsing Error:", error);
        showNotification("Failed to read PDF text.");
      } finally {
        setIsProcessing(false);
      }
    } else {
      setTimeout(() => {
        setIsProcessing(false);
        showNotification(`File loaded. PDF required for auto-extract.`);
      }, 1000);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  useEffect(() => {
    if (!formData.quoteDate || !formData.monthlySavings) return;

    const today = new Date();
    const qDate = new Date(formData.quoteDate);
    const diffTime = Math.abs(today - qDate);
    const daysElapsed = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const monthsElapsed = daysElapsed / 30.44;

    const savings = parseFloat(formData.monthlySavings) || 0;
    const price = parseFloat(formData.systemPrice) || 0;
    const totalLoss = monthsElapsed * savings;

    const estimatedSavedUnits = savings / 10.03;

    setMetrics({
      daysElapsed,
      monthsElapsed: monthsElapsed.toFixed(1),
      totalLoss: Math.round(totalLoss),
      dailyLoss: Math.round(savings / 30.44),
      isFree: totalLoss >= price && price > 0,
      price,
      savings,
      savedUnits: Math.round(estimatedSavedUnits)
    });
  }, [formData]);

  const generateChartData = () => {
    const months = Math.max(Math.ceil(parseFloat(metrics.monthsElapsed) || 0) + 2, 6);
    const labels = Array.from({ length: months + 1 }, (_, i) => `Month ${i}`);
    const lossData = labels.map((_, i) => Math.round(i * (parseFloat(formData.monthlySavings) || 0)));
    const priceData = labels.map(() => parseFloat(formData.systemPrice) || 0);

    return {
      labels,
      datasets: [
        {
          label: 'Loss to DISCOM (₹)',
          data: lossData,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.1,
          borderWidth: 3,
        },
        {
          label: 'System Price',
          data: priceData,
          borderColor: '#3b82f6',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
        }
      ]
    };
  };

  const downloadReport = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans print:bg-white">
      
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 text-white px-6 py-3 rounded-lg shadow-xl flex items-center space-x-2 animate-bounce print:hidden">
          <CheckCircle size={18} className="text-green-400" />
          <span>{notification}</span>
        </div>
      )}

      <header className="bg-slate-900 text-white py-4 px-8 shadow-md print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Activity className="text-red-500" size={28} />
            <h1 className="text-xl font-bold tracking-tight">JK Correctron <span className="text-red-500">Loss Analysis</span></h1>
          </div>
          <button onClick={() => window.location.reload()} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <RefreshCw size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 flex flex-col md:flex-row gap-8">
        
        <div className="w-full md:w-1/4 space-y-2 print:hidden">
          {[
            { id: 1, icon: Upload, label: '1. OCR Data Input' },
            { id: 2, icon: Activity, label: '2. Delay Engine' },
            { id: 3, icon: TrendingUp, label: '3. Crossover Graph' },
            { id: 4, icon: Eye, label: '4. Impact Report Preview' },
            { id: 5, icon: MessageCircle, label: '5. Action Automation' },
          ].map((step) => (
            <button
              key={step.id}
              onClick={() => setActiveTab(step.id)}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center space-x-3 transition-colors mb-2 ${
                activeTab === step.id 
                  ? 'bg-red-50 text-red-700 font-semibold border border-red-200' 
                  : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              <step.icon size={18} className={activeTab === step.id ? 'text-red-600' : 'text-slate-400'} />
              <span>{step.label}</span>
            </button>
          ))}
        </div>

        <div className="w-full md:w-3/4">
          
          {activeTab === 1 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
              <h2 className="text-2xl font-bold mb-6 flex items-center">
                <Upload className="mr-3 text-red-500" /> Data Input
              </h2>
              
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center bg-slate-50 hover:bg-slate-100 transition-colors relative">
                <input type="file" accept=".pdf,image/*" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <Upload size={40} className="mx-auto text-slate-400 mb-4" />
                <p className="text-slate-600 font-medium">
                  {isProcessing ? "Processing Quick Quote..." : fileName ? `Loaded: ${fileName}` : "Click to Upload Quick Quote PDF"}
                </p>
              </div>
              
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Customer Name</label>
                  <input type="text" name="customerName" value={formData.customerName} onChange={handleInputChange} className="w-full p-2 border rounded mt-1" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Quote Date</label>
                  <input type="date" name="quoteDate" value={formData.quoteDate} onChange={handleInputChange} className="w-full p-2 border rounded mt-1" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Monthly Savings (₹)</label>
                  <input type="number" name="monthlySavings" value={formData.monthlySavings} onChange={handleInputChange} className="w-full p-2 border rounded mt-1" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">System Price (₹)</label>
                  <input type="number" name="systemPrice" value={formData.systemPrice} onChange={handleInputChange} className="w-full p-2 border rounded mt-1" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Existing Power Factor</label>
                  <input type="text" name="existingPf" value={formData.existingPf} onChange={handleInputChange} className="w-full p-2 border rounded mt-1" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 2 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
               <h2 className="text-2xl font-bold mb-6 flex items-center"><Activity className="mr-3 text-red-500" /> Loss Analysis Dashboard</h2>
               {metrics.isFree && (
                 <div className="bg-red-600 text-white p-4 rounded-lg mb-8 text-center font-bold animate-pulse shadow-lg text-lg">
                   ⚠️ CRITICAL: TOTAL LOSSES HAVE EXCEEDED THE SYSTEM COST
                 </div>
               )}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="p-6 bg-red-50 rounded-xl border border-red-200 shadow-sm">
                    <span className="text-red-800 font-bold text-sm tracking-wider">TOTAL MONEY LOST</span>
                    <h3 className="text-4xl font-black text-red-600 mt-2">₹{metrics.totalLoss.toLocaleString('en-IN')}</h3>
                  </div>
                  <div className="p-6 bg-orange-50 rounded-xl border border-orange-200 shadow-sm">
                    <span className="text-orange-800 font-bold text-sm tracking-wider">DAILY LOSSES</span>
                    <h3 className="text-4xl font-black text-orange-600 mt-2">₹{metrics.dailyLoss.toLocaleString('en-IN')}</h3>
                    <span className="text-orange-700 text-xs">per day</span>
                  </div>
                  <div className="p-6 bg-blue-50 rounded-xl border border-blue-200 shadow-sm">
                    <span className="text-blue-800 font-bold text-sm tracking-wider">DELAY DURATION</span>
                    <h3 className="text-4xl font-black text-blue-600 mt-2">{metrics.monthsElapsed}</h3>
                    <span className="text-blue-700 text-xs">months elapsed</span>
                  </div>
               </div>
               <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                 <span className="text-slate-600 font-bold text-sm tracking-wider">ESTIMATED UNITS WASTED (KVAH PENALTY)</span>
                 <div className="flex items-center mt-2">
                   <h3 className="text-3xl font-bold text-slate-800 mr-3">{metrics.savedUnits.toLocaleString('en-IN')}</h3>
                   <span className="text-slate-500 font-medium">Units Billed Extra Every Month</span>
                 </div>
               </div>
            </div>
          )}

          {activeTab === 3 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 h-[500px]">
              <Line 
                data={generateChartData()} 
                options={{ 
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      ticks: {
                        callback: function(value) {
                          return '₹' + value.toLocaleString('en-IN');
                        }
                      }
                    }
                  },
                  plugins: {
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          let label = context.dataset.label || '';
                          if (label) label += ': ';
                          if (context.parsed.y !== null) label += '₹' + context.parsed.y.toLocaleString('en-IN');
                          return label;
                        }
                      }
                    }
                  }
                }} 
              />
            </div>
          )}

          {activeTab === 4 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center print:hidden">
                <h2 className="text-xl font-bold">Report Preview</h2>
                <div className="flex gap-2">
                   <button onClick={downloadReport} className="bg-red-600 text-white px-4 py-2 rounded flex items-center hover:bg-red-700 transition-colors">
                    <Download size={18} className="mr-2" /> Save PDF / Print
                  </button>
                </div>
              </div>

              {/* A4 Report Wrapper */}
              <div className="flex justify-center bg-slate-200 p-4 min-h-screen print:p-0 print:bg-white">
                <div 
                  className="bg-white shadow-2xl print:shadow-none print:border-0 relative overflow-hidden" 
                  style={{ 
                    width: '210mm', 
                    height: '297mm', 
                    padding: '15mm',
                    boxSizing: 'border-box'
                  }}
                  id="report-area"
                >
                  {/* Watermark/Header Decoration */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-600 transform rotate-45 translate-x-16 -translate-y-16 print:bg-red-600 opacity-10"></div>

                  {/* Header */}
                  <div className="flex justify-between border-b-2 border-red-600 pb-3 mb-6 relative z-10">
                    <div>
                      <h1 className="text-2xl font-black text-slate-900 leading-tight">JK CORRECTRON</h1>
                      <p className="text-red-600 font-bold text-xs">SMART APFC SYSTEMS & ENERGY AUDITS</p>
                    </div>
                    <div className="text-right text-[10px] text-slate-500 uppercase tracking-widest">
                      <p className="font-bold text-slate-800">LOSS OF DELAY REPORT</p>
                      <p>REF: JK/LOD/{new Date().getFullYear()}/{Math.floor(Math.random() * 900) + 100}</p>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="mb-6">
                    <p className="text-xs text-slate-500 italic">Prepared for:</p>
                    <h2 className="text-lg font-bold text-slate-900 border-l-4 border-slate-900 pl-3 py-1 bg-slate-50 uppercase tracking-tight">
                      {formData.customerName || "VALUED CUSTOMER"}
                    </h2>
                    <div className="flex justify-between mt-2 text-[10px] text-slate-500 font-medium">
                      <span>Proposal Date: {formData.quoteDate}</span>
                      <span>Analysis Date: {new Date().toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Financial Loss Summary */}
                  <div className="bg-red-600 text-white p-5 rounded-sm mb-6 shadow-md relative overflow-hidden">
                    <div className="relative z-10 flex items-center justify-between">
                      <div className="w-2/3">
                        <h3 className="text-xs font-bold uppercase tracking-widest opacity-90 mb-1">Cumulative Financial Leakage</h3>
                        <p className="text-4xl font-black tracking-tighter">₹{metrics.totalLoss.toLocaleString('en-IN')}</p>
                        <p className="text-[10px] mt-2 opacity-80 leading-relaxed">
                          This amount has been permanently lost to the DISCOM due to billing in kVAh instead of kWh since your initial quotation.
                        </p>
                      </div>
                      <div className="text-right border-l border-white/20 pl-4">
                        <p className="text-[10px] font-bold opacity-80 uppercase">Daily Burn Rate</p>
                        <p className="text-xl font-bold">₹{metrics.dailyLoss.toLocaleString('en-IN')}</p>
                        <p className="text-[9px] mt-1 opacity-70">per day</p>
                      </div>
                    </div>
                    {/* SVG decoration */}
                    <Activity className="absolute right-[-10px] bottom-[-10px] opacity-10 w-24 h-24" />
                  </div>

                  {/* Split Section: Audit & Graph */}
                  <div className="grid grid-cols-2 gap-6 mb-6 items-start">
                    {/* Technical Audit */}
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-800 mb-3 border-b-2 border-slate-200 pb-1 flex items-center">
                        <Activity size={14} className="mr-2 text-red-600" /> TECHNICAL AUDIT SUMMARY
                      </h4>
                      <div className="space-y-2 text-[11px]">
                        <div className="flex justify-between border-b border-slate-100 pb-1">
                          <span className="text-slate-500">Existing Power Factor:</span>
                          <span className="font-bold text-red-600">{formData.existingPf}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-1">
                          <span className="text-slate-500">Current Billing Unit:</span>
                          <span className="font-bold">kVAh</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-1">
                          <span className="text-slate-500">Wasted Energy / Month:</span>
                          <span className="font-bold">{metrics.savedUnits.toLocaleString('en-IN')} Units</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-1">
                          <span className="text-slate-500">Monthly Financial Saving:</span>
                          <span className="font-bold text-green-600">₹{Number(formData.monthlySavings).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between pt-1">
                          <span className="text-slate-500">Elapsed Delay:</span>
                          <span className="font-bold">{metrics.monthsElapsed} Months</span>
                        </div>
                      </div>
                    </div>

                    {/* Inline SVG Crossover Graph for PDF compatibility */}
                    <div className="bg-slate-50 p-3 border border-slate-100 rounded">
                      <h4 className="text-[10px] font-bold text-slate-700 mb-2 uppercase text-center tracking-wider">Projected Loss Trajectory</h4>
                      <svg viewBox="0 0 200 100" className="w-full h-auto">
                        {/* Axes */}
                        <line x1="20" y1="80" x2="190" y2="80" stroke="#94a3b8" strokeWidth="1" />
                        <line x1="20" y1="10" x2="20" y2="80" stroke="#94a3b8" strokeWidth="1" />
                        
                        {/* System Cost Line (Static Horizontal) */}
                        <line x1="20" y1="40" x2="190" y2="40" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3,2" />
                        <text x="140" y="36" fontSize="5" fill="#3b82f6" fontWeight="bold">SYSTEM COST</text>
                        
                        {/* Cumulative Loss Line (Slope) */}
                        <path d="M 20 80 Q 100 60 190 10" fill="none" stroke="#ef4444" strokeWidth="2.5" />
                        <text x="140" y="15" fontSize="5" fill="#ef4444" fontWeight="bold">ACCUMULATED LOSS</text>
                        
                        {/* Intersection Point Indicator */}
                        <circle cx="105" cy="40" r="3" fill="#ef4444" />
                        <text x="80" y="52" fontSize="6" fill="#1e293b" fontWeight="bold">FREE POINT</text>
                        
                        {/* Labels */}
                        <text x="175" y="88" fontSize="4" fill="#64748b">TIME →</text>
                      </svg>
                      <p className="text-[8px] text-center text-slate-400 mt-2 font-medium italic uppercase">Real-time Crossover visualization</p>
                    </div>
                  </div>

                  {/* Impact Comparison Table */}
                  <div className="mb-6">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-wider">
                          <th className="p-2 text-left border border-slate-700">Audit Parameter</th>
                          <th className="p-2 text-center border border-slate-700">Status (Delayed)</th>
                          <th className="p-2 text-center border border-slate-700">JK Correctron (Solution)</th>
                        </tr>
                      </thead>
                      <tbody className="text-[10px]">
                        <tr>
                          <td className="border p-2 font-bold text-slate-700 bg-slate-50">Power Factor Efficient</td>
                          <td className="border p-2 text-center text-red-600 font-bold">{formData.existingPf}</td>
                          <td className="border p-2 text-center text-green-600 font-bold bg-green-50">0.999 Lag/Unity</td>
                        </tr>
                        <tr>
                          <td className="border p-2 font-bold text-slate-700 bg-slate-50">Tariff Unit Type</td>
                          <td className="border p-2 text-center">kVAh (Penalty Based)</td>
                          <td className="border p-2 text-center font-bold">kWh (Optimized)</td>
                        </tr>
                        <tr>
                          <td className="border p-2 font-bold text-slate-700 bg-slate-50">Reactive Power Penalty</td>
                          <td className="border p-2 text-center text-red-600">Charged to Customer</td>
                          <td className="border p-2 text-center text-green-700 font-bold bg-green-50">Zero / Recovered</td>
                        </tr>
                        <tr>
                          <td className="border p-2 font-bold text-slate-700 bg-slate-50">Voltage Stability</td>
                          <td className="border p-2 text-center">Fluctuating</td>
                          <td className="border p-2 text-center font-bold">Maintained Stability</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Summary & Call to Action */}
                  <div className="border-t-2 border-slate-100 pt-5 relative">
                    <div className="flex items-start gap-4">
                       <div className="bg-slate-900 text-white p-3 rounded flex-shrink-0">
                          <AlertTriangle size={24} className="text-yellow-400" />
                       </div>
                       <div>
                         <h5 className="text-[11px] font-bold text-slate-900 mb-1">FINAL RECOMMENDATION:</h5>
                         <p className="text-[10px] text-slate-600 leading-normal">
                           Your system payback period was originally calculated at {Math.max(1, Math.round(metrics.price / metrics.savings))} months. By delaying the decision for {metrics.monthsElapsed} months, you have already spent 
                           <span className="font-bold text-red-600"> {Math.round((metrics.totalLoss / metrics.price) * 100)}% </span> 
                           of the system cost on electricity penalties. 
                           <span className="font-bold text-slate-800"> We recommend immediate installation to prevent further irrecoverable losses.</span>
                         </p>
                       </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="absolute bottom-[15mm] left-[15mm] right-[15mm] border-t border-slate-100 pt-3 flex justify-between items-end text-[9px] text-slate-400">
                    <div>
                      <p className="font-bold text-slate-700 uppercase">JK Correctron</p>
                      <p>Automatic Power Factor Corrector</p>
                    </div>
                    <div className="text-right">
                      <p>Verified Energy Audit Report</p>
                      <p className="font-mono">{new Date().toISOString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 5 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
              <h2 className="text-2xl font-bold mb-6">WhatsApp Follow-up</h2>
              <div className="mb-8">
                <h3 className="font-bold text-slate-700 mb-2">Hindi Message</h3>
                <div className="bg-slate-100 p-4 rounded mb-3 font-mono text-sm whitespace-pre-wrap">
                  {`नमस्ते ${formData.customerName}, आपकी ${formData.quoteDate} की कोटेशन के बाद से अब तक आपकी कंपनी को ₹${metrics.totalLoss.toLocaleString('en-IN')} का सीधा नुकसान हुआ है। देरी की वजह से आपका नुकसान हर दिन ₹${metrics.dailyLoss.toLocaleString('en-IN')} बढ़ रहा है। क्या हम आज काम शुरू करें?`}
                </div>
                <button 
                  onClick={() => {
                    const text = `नमस्ते ${formData.customerName}, आपकी ${formData.quoteDate} की कोटेशन के बाद से अब तक आपकी कंपनी को ₹${metrics.totalLoss.toLocaleString('en-IN')} का सीधा नुकसान हुआ है। देरी की वजह से आपका नुकसान हर दिन ₹${metrics.dailyLoss.toLocaleString('en-IN')} बढ़ रहा है। क्या हम आज काम शुरू करें?`;
                    navigator.clipboard.writeText(text);
                    showNotification("Hindi message copied!");
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center transition-colors"
                >
                  <Copy size={18} className="mr-2" /> Copy Hindi Message
                </button>
              </div>

              <div>
                <h3 className="font-bold text-slate-700 mb-2">English Message</h3>
                <div className="bg-slate-100 p-4 rounded mb-3 font-mono text-sm whitespace-pre-wrap">
                  {`Hello ${formData.customerName}, since our quotation on ${formData.quoteDate}, your company has incurred a direct loss of ₹${metrics.totalLoss.toLocaleString('en-IN')}. Due to the delay, your losses are increasing by ₹${metrics.dailyLoss.toLocaleString('en-IN')} every day. Shall we start the work today?`}
                </div>
                <button 
                  onClick={() => {
                    const text = `Hello ${formData.customerName}, since our quotation on ${formData.quoteDate}, your company has incurred a direct loss of ₹${metrics.totalLoss.toLocaleString('en-IN')}. Due to the delay, your losses are increasing by ₹${metrics.dailyLoss.toLocaleString('en-IN')} every day. Shall we start the work today?`;
                    navigator.clipboard.writeText(text);
                    showNotification("English message copied!");
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center transition-colors"
                >
                  <Copy size={18} className="mr-2" /> Copy English Message
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      
      {/* Specific styles for print */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            background-color: white !important;
          }
          header, .print\\:hidden, nav {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
            width: 100% !important;
          }
          .md\\:w-3\\/4 {
            width: 100% !important;
          }
          #report-area {
            box-shadow: none !important;
            border: none !important;
            margin: 0 auto !important;
            float: none !important;
            page-break-after: always;
          }
        }
      `}</style>
    </div>
  );
}