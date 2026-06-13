"use client";

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';

// Dynamically import MapPickerComponent with SSR disabled
const MapPicker = dynamic(() => import('../components/MapPickerComponent'), {
  ssr: false,
});

const formatNum = (num: any, decimals = 1) => {
  if (num === null || num === undefined || isNaN(num)) return 'N/A';
  return Number(num).toFixed(decimals);
};

// Farmer-friendly interpretation helpers
const getPhStatus = (ph: number) => {
  if (ph < 5.5) return { text: "Highly Acidic", color: "#ef4444" };
  if (ph < 6.5) return { text: "Slightly Acidic", color: "#eab308" };
  if (ph <= 7.5) return { text: "Optimal for most crops", color: "#10b981" };
  if (ph <= 8.5) return { text: "Slightly Alkaline", color: "#eab308" };
  return { text: "Highly Alkaline (Needs Treatment)", color: "#ef4444" };
};

const getRainfallStatus = (rain: number) => {
  if (rain < 1) return { text: "Very Dry Area", color: "#ef4444" };
  if (rain < 3) return { text: "Low Rainfall", color: "#eab308" };
  if (rain < 7) return { text: "Moderate Rainfall", color: "#10b981" };
  return { text: "Heavy Rainfall Area", color: "#3b82f6" };
};

const getGroundwaterStatus = (level: number) => {
  if (level < 5) return { text: "Easily Accessible Water", color: "#3b82f6" };
  if (level < 15) return { text: "Moderate Depth", color: "#10b981" };
  return { text: "Deep Water (Requires borewell)", color: "#eab308" };
};

const getSoilType = (sand: number, silt: number, clay: number) => {
  if (clay > 40) return "Heavy Clay (Retains water well, but hard to till and poor drainage)";
  if (sand > 50) return "Sandy Soil (Drains quickly, requires frequent watering)";
  if (silt > 50) return "Silty Soil (Fertile, but prone to waterlogging)";
  return "Loamy Soil (Excellent balance for most crops)";
};

const getCarbonStatus = (orgc: number) => {
  if (orgc < 10) return { text: "Low Fertility (Needs Manure/Compost)", color: "#ef4444" };
  if (orgc < 20) return { text: "Moderate Fertility", color: "#eab308" };
  return { text: "Highly Fertile", color: "#10b981" };
};

const getTempStatus = (temp: number) => {
  if (temp < 20) return "Cool Climate";
  if (temp <= 30) return "Warm/Moderate Climate";
  return "Hot Climate (Heat-tolerant crops needed)";
};

const cleanMarkdownForSpeech = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/[*_~`#]/g, '') // remove formatting and headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // replace links with just text
    .replace(/^[\s]*[-+*]\s+/gm, '') // remove bullet points
    .replace(/\|/g, ' ') // remove table cells divider
    .replace(/\s+/g, ' ') // normalize whitespace
    .trim();
};

const getVoiceForLanguage = (langName: string): SpeechSynthesisVoice | null => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const langCodeMap: { [key: string]: string[] } = {
    'English': ['en-IN', 'en-US', 'en-GB', 'en'],
    'Hindi': ['hi-IN', 'hi'],
    'Tamil': ['ta-IN', 'ta'],
    'Telugu': ['te-IN', 'te'],
    'Marathi': ['mr-IN', 'mr'],
    'Bengali': ['bn-IN', 'bn']
  };
  const targets = langCodeMap[langName] || ['en-US'];

  for (const target of targets) {
    const found = voices.find(v => v.lang.toLowerCase() === target.toLowerCase() || v.lang.toLowerCase().startsWith(target.toLowerCase() + '-'));
    if (found) return found;
  }

  for (const target of targets) {
    const prefix = target.split('-')[0].toLowerCase();
    const found = voices.find(v => v.lang.toLowerCase().startsWith(prefix));
    if (found) return found;
  }

  return null;
};

const renderRecommendation = (text: string) => {
  if (!text) return null;

  // Normalize headers with space
  const normalizedText = text.replace(/^(#{1,4})\s*(.*)$/gm, '### $2');
  
  // Split by '### '
  const parts = normalizedText.split(/###\s+/);
  
  if (parts.length <= 1) {
    // If no h3 sections, try splitting by '## ' as fallback
    const h2Parts = normalizedText.split(/##\s+/);
    if (h2Parts.length > 1) {
      return renderSections(h2Parts);
    }
    return (
      <div className="markdown-content">
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
    );
  }

  return renderSections(parts);
};

const renderSections = (parts: string[]) => {
  const intro = parts[0].trim();
  const sections = parts.slice(1);

  // Emojis mapping for section titles
  const getSectionEmoji = (title: string, index: number) => {
    const t = title.toLowerCase();
    if (t.includes('assessment') || t.includes('summary')) return '📊';
    if (t.includes('crop') || t.includes('recommend')) return '🌱';
    if (t.includes('improvement') || t.includes('plan') || t.includes('step')) return '🛠️';
    if (t.includes('scheme') || t.includes('policy') || t.includes('govt')) return '🏛️';
    if (t.includes('soil') || t.includes('physicochemical')) return '🧪';
    if (t.includes('economic') || t.includes('viability')) return '💰';
    if (t.includes('agronomic') || t.includes('metrics')) return '🌾';
    if (t.includes('contact') || t.includes('local')) return '📞';
    return index % 3 === 0 ? '📊' : index % 3 === 1 ? '🌱' : '🛠️';
  };

  // Color scheme mapping
  const getSectionColors = (index: number) => {
    const colors = [
      { border: 'var(--accent-color)', text: 'var(--accent-color)' },       // Green
      { border: 'var(--accent-secondary)', text: 'var(--accent-secondary)' }, // Blue
      { border: '#eab308', text: '#eab308' }                                  // Yellow
    ];
    return colors[index % colors.length];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {intro && (
        <div className="markdown-content" style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
          <ReactMarkdown>{intro}</ReactMarkdown>
        </div>
      )}
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {sections.map((sec, idx) => {
          const lines = sec.split('\n');
          const title = lines[0].trim();
          const content = lines.slice(1).join('\n').trim();
          const { border, text } = getSectionColors(idx);
          const emoji = getSectionEmoji(title, idx);

          return (
            <div key={idx} className="flashcard animate-slide-in" style={{ borderTop: `4px solid ${border}` }}>
              <h3 className="flashcard-title" style={{ color: text, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.3rem' }}>{emoji}</span>
                {title}
              </h3>
              
              <div className="markdown-content" style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function Home() {
  const [selectedPos, setSelectedPos] = useState<[number, number] | null>(null);
  const [envData, setEnvData] = useState<any | null>(null);
  const [loadingStation, setLoadingStation] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [landWarning, setLandWarning] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // AI Settings
  const [language, setLanguage] = useState('English');
  const [activeReportType, setActiveReportType] = useState<string | null>(null);

  // Voice Readback states
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [isPausedVoice, setIsPausedVoice] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [hasVoiceSupport, setHasVoiceSupport] = useState(true);

  // Cancel speech synthesis when component unmounts or report changes
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // When recommendation changes or is closed, cancel any playing speech
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlayingVoice(false);
      setIsPausedVoice(false);
    }
  }, [recommendation]);

  const startSpeech = (textToSpeak: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setHasVoiceSupport(false);
      return;
    }

    // Stop any current speech before starting new
    window.speechSynthesis.cancel();

    const cleanedText = cleanMarkdownForSpeech(textToSpeak);
    const utterance = new SpeechSynthesisUtterance(cleanedText);

    const voice = getVoiceForLanguage(language);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.rate = speechRate;

    utterance.onend = () => {
      setIsPlayingVoice(false);
      setIsPausedVoice(false);
    };

    utterance.onerror = (e) => {
      // Ignore normal cancel/interrupted events to prevent Next.js error overlays in development
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn("SpeechSynthesis error:", e);
      }
      setIsPlayingVoice(false);
      setIsPausedVoice(false);
    };

    setIsPlayingVoice(true);
    setIsPausedVoice(false);
    window.speechSynthesis.speak(utterance);
  };

  const pauseSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.pause();
      setIsPausedVoice(true);
    }
  };

  const resumeSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.resume();
      setIsPausedVoice(false);
    }
  };

  const stopSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlayingVoice(false);
      setIsPausedVoice(false);
    }
  };

  const handleRateChange = (newRate: number) => {
    setSpeechRate(newRate);
    if (isPlayingVoice && recommendation) {
      setTimeout(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const cleanedText = cleanMarkdownForSpeech(recommendation);
          const utterance = new SpeechSynthesisUtterance(cleanedText);
          const voice = getVoiceForLanguage(language);
          if (voice) utterance.voice = voice;
          utterance.rate = newRate;
          utterance.onend = () => {
            setIsPlayingVoice(false);
            setIsPausedVoice(false);
          };
          utterance.onerror = () => {
            setIsPlayingVoice(false);
            setIsPausedVoice(false);
          };
          window.speechSynthesis.speak(utterance);
        }
      }, 50);
    }
  };

  // Farmer Context Form
  const [landSize, setLandSize] = useState('1');
  const [landUnit, setLandUnit] = useState('Acre');
  const [irrigation, setIrrigation] = useState<string[]>(['Rain-fed (Monsoon only)']);
  const [budget, setBudget] = useState('Medium (Standard Commercial)');
  const [goal, setGoal] = useState('Maximize Profit (Cash Crops)');
  const [market, setMarket] = useState('Nearby APMC Mandi');
  const [equipment, setEquipment] = useState('Tractor (Rented/Owned)');

  // CRM States
  const [farmerName, setFarmerName] = useState('');
  const [farmerPhone, setFarmerPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedFarmers, setSavedFarmers] = useState<any[]>([]);
  const [showCRM, setShowCRM] = useState(false);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [isNotifying, setIsNotifying] = useState(false);

  const fetchFarmers = async () => {
    try {
      const res = await fetch('/api/farmers');
      if (res.ok) setSavedFarmers(await res.json());
    } catch (e) { }
  };

  const fetchSmsLogs = async () => {
    try {
      const res = await fetch('/api/notify');
      if (res.ok) setSmsLogs(await res.json());
    } catch (e) { }
  };

  useEffect(() => {
    fetchFarmers();
    fetchSmsLogs();
  }, []);

  const handleSaveFarmer = async () => {
    if (!farmerName || !farmerPhone || !selectedPos) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/farmers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: farmerName,
          phone: farmerPhone,
          lat: selectedPos[0],
          lon: selectedPos[1],
          landSize, landUnit, irrigation, budget, goal, market, equipment
        })
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        fetchFarmers();
      }
    } catch (e) { }
    setIsSaving(false);
  };

  const triggerNotifications = async () => {
    setIsNotifying(true);
    try {
      await fetch('/api/notify', { method: 'POST', body: JSON.stringify({ type: 'auto' }) });
      fetchSmsLogs();
    } catch (e) { }
    setIsNotifying(false);
  };

  const loadFarmerProfile = (f: any) => {
    setFarmerName(f.name);
    setFarmerPhone(f.phone);
    setLandSize(f.landSize);
    setLandUnit(f.landUnit);
    setIrrigation(f.irrigation);
    setBudget(f.budget);
    setGoal(f.goal);
    setMarket(f.market);
    setEquipment(f.equipment);
    handleLocationSelect(f.lat, f.lon);
  };

  const handleLocationSelect = async (lat: number, lon: number) => {
    setSelectedPos([lat, lon]);
    setEnvData(null);
    setRecommendation(null);
    setActiveReportType(null);
    setErrorMsg(null);
    setLandWarning(null);
    setLoadingStation(true);
    setShowDropdown(false);

    try {
      // 1. Reverse Geocoding to validate agricultural land
      let isOcean = false;
      try {
        const revRes = await fetch(`/api/station/proxy?lat=${lat}&lon=${lon}`);
        // We will just directly call nominatim
        const nominatimRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
        const revData = await nominatimRes.json();

        if (revData.error === "Unable to geocode") {
          isOcean = true;
          setErrorMsg("⚠️ This location appears to be in the ocean or an unmapped region. Please select a valid landmass.");
          setLoadingStation(false);
          return; // Hard stop for oceans
        }

        const cls = revData.class;
        const type = revData.type;

        const nonAgriClasses = ['building', 'commercial', 'residential', 'shop', 'office', 'amenity', 'leisure', 'highway'];
        if (nonAgriClasses.includes(cls) || type === 'city' || type === 'town') {
          setLandWarning("⚠️ This location appears to be non-agricultural or urban. AI crop recommendations may be less accurate for city centers.");
        }
      } catch (e) {
        console.warn("Reverse geocoding failed", e);
      }

      if (isOcean) return;

      // 2. Fetch Environmental Data
      const res = await fetch(`/api/station?lat=${lat}&lon=${lon}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to fetch data.');
        setLoadingStation(false);
        return;
      }

      if (!data.available) {
        setErrorMsg(data.message);
      } else {
        setEnvData(data.data);
      }
    } catch (err) {
      setErrorMsg('Network error.');
    } finally {
      setLoadingStation(false);
    }
  };

  const fetchSearchResults = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
      const data = await res.json();
      setSearchResults(data || []);
      setShowDropdown(true);
    } catch (err) {
      console.error("Error fetching suggestions", err);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (val.trim().length > 2) {
      searchTimeoutRef.current = setTimeout(() => {
        fetchSearchResults(val);
      }, 500);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchResults.length > 0) {
      const first = searchResults[0];
      handleSuggestionClick(first);
    } else if (searchQuery.trim()) {
      await fetchSearchResults(searchQuery);
    }
  };

  const handleSuggestionClick = (result: any) => {
    setSearchQuery(result.display_name);
    setShowDropdown(false);
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    handleLocationSelect(lat, lon);
  };

  const handleGenerateInsights = async (reportType: 'action_plan' | 'technical_report' | 'policies') => {
    if (!envData) return;
    setLoadingAi(true);
    setRecommendation(null);
    setActiveReportType(reportType);

    const currentMonth = new Date().toLocaleString('default', { month: 'long' });

    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environmentalData: envData,
          language,
          reportType,
          locationName: searchQuery || 'Selected Coordinates',
          currentMonth,
          farmerContext: {
            landSize,
            landUnit,
            irrigation: irrigation.join(', '),
            budget,
            goal,
            market,
            equipment
          }
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRecommendation(`Error: ${data.error}`);
      } else {
        setRecommendation(data.recommendation);
      }
    } catch (err) {
      setRecommendation('Network error while fetching AI recommendations.');
    } finally {
      setLoadingAi(false);
    }
  };

  const toggleIrrigation = (method: string) => {
    if (irrigation.includes(method)) {
      setIrrigation(irrigation.filter(i => i !== method));
    } else {
      setIrrigation([...irrigation, method]);
    }
  };

  return (
    <main style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Background Map */}
      <MapPicker onLocationSelect={handleLocationSelect} selectedPos={selectedPos} />

      {/* Header Overlay */}
      <div
        className="glass-panel"
        style={{
          position: 'absolute', top: '20px', left: '20px', zIndex: 10, padding: '20px',
          width: '380px', borderTop: '4px solid var(--accent-color)',
          background: 'rgba(253, 251, 247, 0.94)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(212, 175, 55, 0.25)',
          borderTopColor: 'var(--accent-color)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
          <div style={{ width: '40px', height: '40px', background: 'var(--accent-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', color: '#fff' }}>
            🌾
          </div>
          <div>
            <h1 style={{ fontSize: '1.2rem', margin: 0, letterSpacing: '1px', textTransform: 'uppercase' }}>Farmer Assistance</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>Smart Crop Selection Platform</p>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="Search for a village or farm location..."
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              style={{
                flex: 1, padding: '12px 15px', borderRadius: '6px', border: '1px solid var(--panel-border)',
                background: 'var(--bg-color)', color: 'var(--text-primary)', fontFamily: 'var(--font-main)'
              }}
            />
            <button type="submit" className="btn-glow" disabled={searching} style={{ padding: '12px 20px' }}>
              {searching ? '...' : 'Locate'}
            </button>
          </form>

          {/* CRM Quick Actions */}
          <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
            <select
              onChange={(e) => {
                const f = savedFarmers.find(x => x.id === e.target.value);
                if (f) loadFarmerProfile(f);
              }}
              style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid var(--panel-border)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
            >
              <option value="">-- Load Saved Farmer Profile --</option>
              {savedFarmers.map(f => (
                <option key={f.id} value={f.id}>{f.name} ({f.phone})</option>
              ))}
            </select>
            <button onClick={() => setShowCRM(true)} style={{ padding: '8px 12px', borderRadius: '4px', background: 'var(--accent-secondary)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              📡 SMS Hub
            </button>
          </div>

          {/* Autocomplete Dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: '90px', marginTop: '5px',
              background: 'var(--panel-bg)', backdropFilter: 'blur(16px)',
              border: '1px solid var(--panel-border)', borderRadius: '6px',
              maxHeight: '250px', overflowY: 'auto', zIndex: 20,
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }}>
              {searchResults.map((result, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSuggestionClick(result)}
                  style={{
                    padding: '12px 15px', borderBottom: idx < searchResults.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {result.display_name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Error / Warning Toast */}
      {errorMsg && (
        <div className="glass-panel animate-slide-in" style={{
          position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, padding: '15px 25px', border: '1px solid #ef4444'
        }}>
          <p style={{ color: '#ef4444', margin: 0, fontWeight: 500 }}>{errorMsg}</p>
        </div>
      )}

      {/* Loading Indicator */}
      {loadingStation && (
        <div className="glass-panel" style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 10, padding: '20px', display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <div className="spinner" style={{
            width: '20px', height: '20px', border: '3px solid var(--panel-border)',
            borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite'
          }}></div>
          <span>Analyzing field conditions...</span>
        </div>
      )}

      {/* Side Panel for Results */}
      {envData && (
        <div className="glass-panel animate-slide-in" style={{
          position: 'absolute', top: '20px', right: '20px', bottom: '20px', width: '520px',
          zIndex: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          borderLeft: '4px solid var(--accent-secondary)',
          background: 'rgba(253, 251, 247, 0.94)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(212, 175, 55, 0.25)'
        }}>
          <div style={{ 
            padding: '20px 24px', 
            background: 'linear-gradient(135deg, #2c3e50 0%, #1a252f 100%)', 
            borderBottom: '2px solid var(--accent-color)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ fontSize: '1.25rem', textTransform: 'uppercase', letterSpacing: '1px', margin: 0, color: 'var(--accent-color)', fontWeight: 700 }}>Farm Health Overview</h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem', margin: '6px 0 0 0', fontWeight: 500 }}>
              Lat: {formatNum(envData.latitude, 3)} | Lon: {formatNum(envData.longitude, 3)}
            </p>
          </div>

          <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>

            {/* Soft Warning for non-agri land */}
            {landWarning && (
              <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '15px', borderRadius: '6px', marginBottom: '20px', color: '#eab308', fontSize: '0.85rem' }}>
                {landWarning}
              </div>
            )}

            {/* Weather & Water */}
            <div className="data-section">
              <h3 className="section-title">Weather & Water Availability</h3>

              {envData.current_temp !== undefined && (
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', padding: '15px', marginBottom: '15px' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--accent-secondary)', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span>☁️</span> <span style={{ fontWeight: 600 }}>Live Real-Time Weather</span>
                  </p>
                  <div className="data-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                    <div className="data-card" style={{ background: 'var(--panel-bg)', padding: '10px' }}>
                      <span className="label" style={{ fontSize: '0.65rem' }}>Temp</span>
                      <span className="value" style={{ color: 'var(--accent-color)', fontSize: '0.9rem' }}>{envData.current_temp}°C</span>
                    </div>
                    <div className="data-card" style={{ background: 'var(--panel-bg)', padding: '10px' }}>
                      <span className="label" style={{ fontSize: '0.65rem' }}>Humidity</span>
                      <span className="value" style={{ color: 'var(--accent-color)', fontSize: '0.9rem' }}>{envData.current_humidity}%</span>
                    </div>
                    <div className="data-card" style={{ background: 'var(--panel-bg)', padding: '10px' }}>
                      <span className="label" style={{ fontSize: '0.65rem' }}>Precipitation</span>
                      <span className="value" style={{ color: 'var(--accent-secondary)', fontSize: '0.9rem' }}>{envData.current_precip}mm</span>
                    </div>
                    <div className="data-card" style={{ background: 'var(--panel-bg)', padding: '10px' }}>
                      <span className="label" style={{ fontSize: '0.65rem' }}>Wind</span>
                      <span className="value" style={{ color: 'var(--accent-secondary)', fontSize: '0.9rem' }}>{envData.current_wind}km/h</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="data-grid">
                <div className="data-card" style={{ gridColumn: 'span 2', padding: '16px' }}>
                  <span className="label" style={{ marginBottom: '8px' }}>General Climate</span>
                  <span className="value" style={{ fontSize: '1.15rem', color: 'var(--text-primary)', marginBottom: '12px', display: 'block' }}>
                    {getTempStatus(envData.mean_t2m)}
                  </span>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '10px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                      <span className="label" style={{ fontSize: '0.65rem', marginBottom: '2px' }}>Average</span>
                      <span className="value" style={{ fontSize: '1rem', color: 'var(--accent-color)' }}>
                        {formatNum(envData.mean_t2m)}°C
                      </span>
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                      <span className="label" style={{ fontSize: '0.65rem', color: '#f87171', marginBottom: '2px' }}>Max High</span>
                      <span className="value" style={{ fontSize: '1rem', color: '#ef4444' }}>
                        {formatNum(envData.mean_t2m_max)}°C
                      </span>
                    </div>
                    <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                      <span className="label" style={{ fontSize: '0.65rem', color: '#60a5fa', marginBottom: '2px' }}>Min Low</span>
                      <span className="value" style={{ fontSize: '1rem', color: '#3b82f6' }}>
                        {formatNum(envData.mean_t2m_min)}°C
                      </span>
                    </div>
                  </div>
                </div>

                {(() => {
                  const status = getRainfallStatus(envData.mean_rainfall);
                  return (
                    <div className="data-card" style={{ 
                      background: `${status.color}12`, 
                      borderColor: `${status.color}35`,
                    }}>
                      <span className="label" style={{ color: `${status.color}b0` }}>Rainfall</span>
                      <span className="value" style={{ color: status.color }}>
                        {status.text}
                      </span>
                      <span className="helper-text" style={{ color: `${status.color}90` }}>
                        {formatNum(envData.mean_rainfall)} mm avg
                      </span>
                    </div>
                  );
                })()}

                {(() => {
                  const status = getGroundwaterStatus(envData.mean_groundwater_level);
                  return (
                    <div className="data-card" style={{ 
                      background: `${status.color}12`, 
                      borderColor: `${status.color}35`,
                    }}>
                      <span className="label" style={{ color: `${status.color}b0` }}>Groundwater</span>
                      <span className="value" style={{ color: status.color }}>
                        {status.text}
                      </span>
                      <span className="helper-text" style={{ color: `${status.color}90` }}>
                        {formatNum(envData.mean_groundwater_level)} m deep
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Soil Health */}
            <div className="data-section">
              <h3 className="section-title">Soil Quality & Health</h3>
              <div className="data-grid">
                {(() => {
                  const status = getPhStatus(envData.soil_phaq);
                  return (
                    <div className="data-card" style={{ 
                      background: `${status.color}12`, 
                      borderColor: `${status.color}35`,
                    }}>
                      <span className="label" style={{ color: `${status.color}b0` }}>Soil Acidity (pH)</span>
                      <span className="value" style={{ color: status.color }}>
                        {status.text}
                      </span>
                      <span className="helper-text" style={{ color: `${status.color}90` }}>
                        pH {formatNum(envData.soil_phaq)}
                      </span>
                    </div>
                  );
                })()}

                {(() => {
                  const status = getCarbonStatus(envData.soil_orgc);
                  return (
                    <div className="data-card" style={{ 
                      background: `${status.color}12`, 
                      borderColor: `${status.color}35`,
                    }}>
                      <span className="label" style={{ color: `${status.color}b0` }}>Soil Fertility (Carbon)</span>
                      <span className="value" style={{ color: status.color }}>
                        {status.text}
                      </span>
                      <span className="helper-text" style={{ color: `${status.color}90` }}>
                        Level: {formatNum(envData.soil_orgc)}
                      </span>
                    </div>
                  );
                })()}

                <div className="data-card" style={{ gridColumn: 'span 2' }}>
                  <span className="label">Soil Type</span>
                  <span className="value text-accent-green">
                    {getSoilType(envData.soil_sand_pct, envData.soil_silt_pct, envData.soil_clay_pct)}
                  </span>

                  <div style={{ marginTop: '10px' }}>
                    <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${envData.soil_sand_pct}%`, background: '#eab308' }} title="Sand"></div>
                      <div style={{ width: `${envData.soil_silt_pct}%`, background: '#8b5cf6' }} title="Silt"></div>
                      <div style={{ width: `${envData.soil_clay_pct}%`, background: '#ef4444' }} title="Clay"></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '4px', color: 'var(--text-secondary)' }}>
                      <span>Sand {formatNum(envData.soil_sand_pct)}%</span>
                      <span>Silt {formatNum(envData.soil_silt_pct)}%</span>
                      <span>Clay {formatNum(envData.soil_clay_pct)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Government WMS Soil Data (if available) */}
            {envData.n_avail !== undefined && (
              <div className="data-section">
                <h3 className="section-title">Government Soil Health Card (SHC)</h3>
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', padding: '15px' }}>
                  <p style={{ fontSize: '0.8rem', color: '#93c5fd', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span>🏛️</span> <span>Live data from DAC WMS Server</span>
                  </p>
                  <div className="data-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                    <div className="data-card" style={{ background: 'var(--panel-bg)', padding: '10px' }}>
                      <span className="label" style={{ fontSize: '0.65rem' }}>Nitrogen (N)</span>
                      <span className="value" style={{ color: '#3b82f6', fontSize: '0.9rem' }}>{formatNum(envData.n_avail)}</span>
                      <span className="helper-text" style={{ fontSize: '0.65rem' }}>kg/ha</span>
                    </div>
                    <div className="data-card" style={{ background: 'var(--panel-bg)', padding: '10px' }}>
                      <span className="label" style={{ fontSize: '0.65rem' }}>Phosphorus (P)</span>
                      <span className="value" style={{ color: '#3b82f6', fontSize: '0.9rem' }}>{formatNum(envData.p_avail)}</span>
                      <span className="helper-text" style={{ fontSize: '0.65rem' }}>kg/ha</span>
                    </div>
                    <div className="data-card" style={{ background: 'var(--panel-bg)', padding: '10px' }}>
                      <span className="label" style={{ fontSize: '0.65rem' }}>Potassium (K)</span>
                      <span className="value" style={{ color: '#3b82f6', fontSize: '0.9rem' }}>{formatNum(envData.k_avail)}</span>
                      <span className="helper-text" style={{ fontSize: '0.65rem' }}>kg/ha</span>
                    </div>
                    <div className="data-card" style={{ background: 'var(--panel-bg)', padding: '10px' }}>
                      <span className="label" style={{ fontSize: '0.65rem' }}>Electric Cond.</span>
                      <span className="value" style={{ color: '#3b82f6', fontSize: '0.9rem' }}>{formatNum(envData.ec_govt)}</span>
                      <span className="helper-text" style={{ fontSize: '0.65rem' }}>dS/m</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid var(--panel-border)', margin: '20px 0' }} />

            {/* Farmer Context Form */}
            <div className="data-section">
              <h3 className="section-title">Farmer Profile & Context</h3>
              <div style={{ background: 'var(--panel-bg)', padding: '15px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">Land Size</label>
                    <input type="number" min="0.1" step="0.1" value={landSize} onChange={e => setLandSize(e.target.value)} className="form-input" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">Unit</label>
                    <select value={landUnit} onChange={e => setLandUnit(e.target.value)} className="form-input">
                      <option>Acre</option>
                      <option>Hectare</option>
                      <option>Bigha</option>
                      <option>Cent</option>
                      <option>Sq Feet</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label className="form-label" style={{ marginBottom: '8px' }}>Irrigation Methods (Select all that apply)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {['Rain-fed', 'Borewell / Tube well', 'Canal / River Water', 'Farm Pond / Tank', 'Drip / Sprinkler'].map(method => (
                      <button
                        key={method}
                        onClick={(e) => { e.preventDefault(); toggleIrrigation(method); }}
                        style={{
                          padding: '6px 12px', fontSize: '0.75rem', borderRadius: '15px',
                          background: irrigation.includes(method) ? 'var(--accent-color)' : 'var(--bg-color)',
                          border: `1px solid ${irrigation.includes(method) ? 'var(--accent-color)' : 'var(--panel-border)'}`,
                          color: irrigation.includes(method) ? 'white' : 'var(--text-primary)', cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                  <div>
                    <label className="form-label">Primary Goal</label>
                    <select value={goal} onChange={e => setGoal(e.target.value)} className="form-input">
                      <option>Maximize Profit (Cash Crops)</option>
                      <option>Subsistence & Food Security</option>
                      <option>Risk Minimization (Drought resistant)</option>
                      <option>Soil Restoration</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Market Access</label>
                    <select value={market} onChange={e => setMarket(e.target.value)} className="form-input">
                      <option>Local Village Market</option>
                      <option>Nearby APMC Mandi</option>
                      <option>Direct to Corporate/Export</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="form-label">Investment Capacity</label>
                    <select value={budget} onChange={e => setBudget(e.target.value)} className="form-input">
                      <option>Low (Subsistence Farming)</option>
                      <option>Medium (Standard Commercial)</option>
                      <option>High (Tech-driven / Mechanized)</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Equipment Access</label>
                    <select value={equipment} onChange={e => setEquipment(e.target.value)} className="form-input">
                      <option>Manual Labor / Bullocks</option>
                      <option>Tractor (Rented/Owned)</option>
                      <option>Fully Mechanized</option>
                    </select>
                  </div>
                </div>

                {/* CRM Save Profile */}
                <div style={{ marginTop: '15px', padding: '15px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>💾 Save Profile to CRM</h4>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <input type="text" placeholder="Farmer Name" value={farmerName} onChange={e => setFarmerName(e.target.value)} className="form-input" style={{ flex: 1 }} />
                    <input type="tel" placeholder="Phone Number" value={farmerPhone} onChange={e => setFarmerPhone(e.target.value)} className="form-input" style={{ flex: 1 }} />
                  </div>
                  <button
                    onClick={handleSaveFarmer}
                    disabled={isSaving || !farmerName || !farmerPhone}
                    style={{ width: '100%', padding: '10px', background: saveSuccess ? '#10b981' : 'var(--accent-secondary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', transition: '0.3s' }}
                  >
                    {isSaving ? 'Saving...' : saveSuccess ? '✓ Saved Successfully' : 'Save Farmer Profile'}
                  </button>
                </div>

              </div>
            </div>

            {/* AI Generation Tools */}
            {!recommendation && !loadingAi && (
              <div style={{ marginTop: '20px' }}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>REPORT LANGUAGE</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{
                      width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--panel-border)',
                      background: 'var(--bg-color)', color: 'var(--text-primary)', fontFamily: 'var(--font-main)'
                    }}
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi (हिंदी)</option>
                    <option value="Tamil">Tamil (தமிழ்)</option>
                    <option value="Telugu">Telugu (తెలుగు)</option>
                    <option value="Marathi">Marathi (मराठी)</option>
                    <option value="Bengali">Bengali (বাংলা)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <button className="btn-glow" onClick={() => handleGenerateInsights('action_plan')} style={{ flex: 1, padding: '12px 10px', fontSize: '0.9rem' }}>
                    👨‍🌾 Generate Action Plan
                  </button>
                  <button onClick={() => handleGenerateInsights('technical_report')} style={{
                    flex: 1, padding: '12px 10px', fontSize: '0.9rem', background: 'transparent',
                    border: '1px solid var(--accent-secondary)', color: 'var(--accent-secondary)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.3s'
                  }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    🔬 Technical Report
                  </button>
                </div>
                <button onClick={() => handleGenerateInsights('policies')} style={{
                  width: '100%', padding: '12px 10px', fontSize: '0.9rem', background: 'rgba(234, 179, 8, 0.15)',
                  border: '1px solid #eab308', color: '#854d0e', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.3s',
                  textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600
                }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(234, 179, 8, 0.25)'} onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(234, 179, 8, 0.15)'}>
                  🏛️ Govt Schemes & Subsidies
                </button>
              </div>
            )}

            {loadingAi && (
              <div style={{ textAlign: 'center', padding: '30px' }}>
                <div className="spinner" style={{
                  width: '30px', height: '30px', border: '3px solid var(--panel-border)',
                  borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 15px'
                }}></div>
                <p className="text-gradient" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Generating {activeReportType === 'action_plan' ? 'Action Plan' : activeReportType === 'policies' ? 'Govt Schemes Report' : 'Technical Report'}...
                </p>
              </div>
            )}

            {recommendation && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '20px',
                borderRadius: '8px',
                marginTop: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid rgba(16,185,129,0.3)', paddingBottom: '10px' }}>
                  <div>
                    <span style={{ background: 'var(--accent-color)', color: 'white', padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', marginRight: '10px', textTransform: 'uppercase' }}>
                      {activeReportType === 'action_plan' ? 'Action Plan' : activeReportType === 'policies' ? 'Govt Schemes' : 'Technical Report'}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--accent-color)', fontWeight: 600 }}>Gemini AI</span>
                  </div>
                  <button onClick={() => setRecommendation(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                </div>

                {/* Voice Readback Widget */}
                <div style={{
                  background: 'rgba(212, 175, 55, 0.1)',
                  border: '1px solid rgba(212, 175, 55, 0.25)',
                  borderRadius: '10px',
                  padding: '12px 15px',
                  marginBottom: '15px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem', animation: isPlayingVoice && !isPausedVoice ? 'pulse 1.5s infinite' : 'none' }}>
                        {isPlayingVoice && !isPausedVoice ? '🔊' : '🔈'}
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {isPlayingVoice && !isPausedVoice ? 'Reading Aloud...' : isPausedVoice ? 'Reading Paused' : 'Read Report Aloud'}
                      </span>
                    </div>

                    {/* Animated sound wave bars when speaking */}
                    {isPlayingVoice && !isPausedVoice && (
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '14px' }}>
                        <div className="bar animate-bar-1" style={{ width: '3px', height: '14px', background: 'var(--accent-color)' }}></div>
                        <div className="bar animate-bar-2" style={{ width: '3px', height: '8px', background: 'var(--accent-color)' }}></div>
                        <div className="bar animate-bar-3" style={{ width: '3px', height: '12px', background: 'var(--accent-color)' }}></div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Control Buttons */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {!isPlayingVoice ? (
                        <button
                          onClick={() => startSpeech(recommendation || '')}
                          style={{
                            background: 'var(--accent-color)', color: 'white', border: 'none',
                            padding: '8px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          ▶️ Listen ({language})
                        </button>
                      ) : (
                        <>
                          {isPausedVoice ? (
                            <button
                              onClick={resumeSpeech}
                              style={{
                                background: 'var(--accent-color)', color: 'white', border: 'none',
                                padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                            >
                              ▶️ Resume
                            </button>
                          ) : (
                            <button
                              onClick={pauseSpeech}
                              style={{
                                background: 'var(--accent-secondary)', color: 'white', border: 'none',
                                padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                            >
                              ⏸️ Pause
                            </button>
                          )}
                          <button
                            onClick={stopSpeech}
                            style={{
                              background: '#ef4444', color: 'white', border: 'none',
                              padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold',
                              cursor: 'pointer'
                            }}
                          >
                            ⏹️ Stop
                          </button>
                        </>
                      )}
                    </div>

                    {/* Speed/Rate Control */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Speed:</span>
                      <select
                        value={speechRate}
                        onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                        style={{
                          padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--panel-border)',
                          background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="0.7">0.7x (Very Slow)</option>
                        <option value="0.85">0.85x (Slow)</option>
                        <option value="1.0">1.0x (Normal)</option>
                        <option value="1.15">1.15x (Fast)</option>
                        <option value="1.3">1.3x (Very Fast)</option>
                      </select>
                    </div>
                  </div>

                  {!hasVoiceSupport && (
                    <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '2px' }}>
                      ⚠️ Speech synthesis is not supported or blocked in this browser.
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '15px' }}>
                  {renderRecommendation(recommendation)}
                </div>
                <button
                  onClick={() => window.print()}
                  style={{
                    marginTop: '25px', background: 'var(--accent-color)', border: 'none',
                    color: 'white', padding: '12px 16px', borderRadius: '6px', cursor: 'pointer', width: '100%',
                    textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600
                  }}
                >
                  Download / Print
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {showCRM && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '600px', maxWidth: '90%', maxHeight: '80vh', overflowY: 'auto', padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>📡 SMS Notification Gateway</h2>
              <button onClick={() => setShowCRM(false)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>&times;</button>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Run the automated notification job to check real-time weather against all saved farmer profiles. If critical weather is detected at their specific farm, an SMS alert will be dispatched automatically.
            </p>

            <button onClick={triggerNotifications} disabled={isNotifying} className="btn-glow" style={{ padding: '12px 24px', width: '100%', marginBottom: '20px', background: isNotifying ? 'gray' : 'var(--accent-secondary)' }}>
              {isNotifying ? 'Scanning Networks & Weather Data...' : 'Run Automated Weather Checks & Dispatch SMS'}
            </button>

            <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--panel-border)', paddingBottom: '10px', marginBottom: '15px' }}>Recent Outbound SMS Logs</h3>

            {smsLogs.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>No messages sent recently.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {smsLogs.slice().reverse().map((log: any) => (
                  <div key={log.id} style={{ background: 'var(--panel-bg)', padding: '15px', borderRadius: '8px', borderLeft: '4px solid var(--accent-secondary)', border: '1px solid var(--panel-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-primary)' }}>To: {log.farmerName} ({log.phone})</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{log.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inline styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
        
        @keyframes bounce-bar-1 {
          0% { height: 4px; }
          100% { height: 14px; }
        }
        @keyframes bounce-bar-2 {
          0% { height: 3px; }
          100% { height: 9px; }
        }
        @keyframes bounce-bar-3 {
          0% { height: 5px; }
          100% { height: 12px; }
        }
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
        
        .animate-bar-1 { animation: bounce-bar-1 0.6s ease-in-out infinite alternate; }
        .animate-bar-2 { animation: bounce-bar-2 0.4s ease-in-out infinite alternate 0.15s; }
        .animate-bar-3 { animation: bounce-bar-3 0.5s ease-in-out infinite alternate 0.05s; }
        
        .data-section { margin-bottom: 25px; }
        .section-title { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary); margin-bottom: 15px; border-bottom: 1px solid var(--panel-border); padding-bottom: 5px; }
        
        .data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .data-card { background: var(--panel-bg); padding: 12px; border-radius: 8px; border: 1px solid var(--panel-border); }
        .data-card .label { display: block; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase; }
        .data-card .value { display: block; font-size: 1.05rem; font-weight: 600; line-height: 1.3; color: var(--text-primary); }
        .data-card .helper-text { display: block; font-size: 0.75rem; color: var(--text-secondary); margin-top: 6px; }
        
        .form-label { display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 5px; font-weight: 500; }
        .form-input { width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--panel-border); background: var(--bg-color); color: var(--text-primary); fontFamily: var(--font-main); }
        .form-input option { background: var(--panel-bg); color: var(--text-primary); }

        .text-accent-blue { color: var(--accent-secondary); }
        .text-accent-green { color: var(--accent-color); }

        .markdown-content h1, .markdown-content h2, .markdown-content h3 { margin-top: 20px; margin-bottom: 10px; color: var(--accent-color); font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.5px; }
        .markdown-content p { margin-bottom: 12px; color: var(--text-primary); }
        .markdown-content ul { margin-left: 20px; margin-bottom: 15px; color: var(--text-primary); }
        .markdown-content li { margin-bottom: 6px; }
        .markdown-content strong { color: var(--text-primary); font-weight: 700; }

        .flashcard {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--panel-border);
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.15);
          position: relative;
          overflow: hidden;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          margin-bottom: 15px;
        }
        .flashcard:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
          background: rgba(255, 255, 255, 0.04);
        }
        .flashcard-title {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
      `}} />
    </main>
  );
}
