"use client";

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';

// Dynamically import MapPickerComponent with SSR disabled
const MapPicker = dynamic(() => import('./components/MapPickerComponent'), {
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

  // Farmer Context Form
  const [landSize, setLandSize] = useState('1');
  const [landUnit, setLandUnit] = useState('Acre');
  const [irrigation, setIrrigation] = useState<string[]>(['Rain-fed (Monsoon only)']);
  const [budget, setBudget] = useState('Medium (Standard Commercial)');
  const [goal, setGoal] = useState('Maximize Profit (Cash Crops)');
  const [market, setMarket] = useState('Nearby APMC Mandi');
  const [equipment, setEquipment] = useState('Tractor (Rented/Owned)');

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
          width: '380px', borderTop: '4px solid var(--accent-color)'
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
              onFocus={() => { if(searchResults.length > 0) setShowDropdown(true); }}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              style={{ 
                flex: 1, padding: '12px 15px', borderRadius: '6px', border: '1px solid var(--panel-border)', 
                background: 'rgba(0,0,0,0.3)', color: 'white', fontFamily: 'var(--font-main)'
              }} 
            />
            <button type="submit" className="btn-glow" disabled={searching} style={{ padding: '12px 20px' }}>
              {searching ? '...' : 'Locate'}
            </button>
          </form>

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
          borderLeft: '4px solid var(--accent-secondary)'
        }}>
          <div style={{ padding: '20px', background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid var(--panel-border)' }}>
            <h2 style={{ fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Farm Health Overview</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '5px 0 0 0' }}>
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
              <div className="data-grid">
                <div className="data-card" style={{ gridColumn: 'span 2' }}>
                  <span className="label">General Climate</span>
                  <span className="value">{getTempStatus(envData.mean_t2m)}</span>
                  <span className="helper-text">Avg: {formatNum(envData.mean_t2m)}°C (High: {formatNum(envData.mean_t2m_max)}°C, Low: {formatNum(envData.mean_t2m_min)}°C)</span>
                </div>
                
                <div className="data-card">
                  <span className="label">Rainfall</span>
                  <span className="value" style={{ color: getRainfallStatus(envData.mean_rainfall).color }}>
                    {getRainfallStatus(envData.mean_rainfall).text}
                  </span>
                  <span className="helper-text">{formatNum(envData.mean_rainfall)} mm avg</span>
                </div>

                <div className="data-card">
                  <span className="label">Groundwater</span>
                  <span className="value" style={{ color: getGroundwaterStatus(envData.mean_groundwater_level).color }}>
                    {getGroundwaterStatus(envData.mean_groundwater_level).text}
                  </span>
                  <span className="helper-text">{formatNum(envData.mean_groundwater_level)} m deep</span>
                </div>
              </div>
            </div>

            {/* Soil Health */}
            <div className="data-section">
              <h3 className="section-title">Soil Quality & Health</h3>
              <div className="data-grid">
                <div className="data-card">
                  <span className="label">Soil Acidity (pH)</span>
                  <span className="value" style={{ color: getPhStatus(envData.soil_phaq).color }}>
                    {getPhStatus(envData.soil_phaq).text}
                  </span>
                  <span className="helper-text">pH {formatNum(envData.soil_phaq)}</span>
                </div>

                <div className="data-card">
                  <span className="label">Soil Fertility (Carbon)</span>
                  <span className="value" style={{ color: getCarbonStatus(envData.soil_orgc).color }}>
                    {getCarbonStatus(envData.soil_orgc).text}
                  </span>
                  <span className="helper-text">Level: {formatNum(envData.soil_orgc)}</span>
                </div>

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

            <hr style={{ border: 'none', borderTop: '1px solid var(--panel-border)', margin: '20px 0' }} />

            {/* Farmer Context Form */}
            <div className="data-section">
              <h3 className="section-title">Farmer Profile & Context</h3>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
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
                          background: irrigation.includes(method) ? 'var(--accent-color)' : 'rgba(0,0,0,0.4)',
                          border: `1px solid ${irrigation.includes(method) ? 'var(--accent-color)' : 'var(--panel-border)'}`,
                          color: 'white', cursor: 'pointer', transition: 'all 0.2s'
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
                      background: 'rgba(0,0,0,0.5)', color: 'white', fontFamily: 'var(--font-main)'
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
                  border: '1px solid #eab308', color: '#fef08a', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.3s',
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
                <div className="markdown-content" style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                  <ReactMarkdown>{recommendation}</ReactMarkdown>
                </div>
                <button 
                  onClick={() => window.print()}
                  style={{
                    marginTop: '25px', background: 'var(--panel-border)', border: 'none',
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
      
      {/* Inline styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
        
        .data-section { margin-bottom: 25px; }
        .section-title { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary); margin-bottom: 15px; border-bottom: 1px solid var(--panel-border); padding-bottom: 5px; }
        
        .data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .data-card { background: rgba(0,0,0,0.25); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.03); }
        .data-card .label { display: block; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase; }
        .data-card .value { display: block; font-size: 1.05rem; font-weight: 600; line-height: 1.3; }
        .data-card .helper-text { display: block; font-size: 0.75rem; color: var(--text-secondary); margin-top: 6px; }
        
        .form-label { display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 5px; }
        .form-input { width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--panel-border); background: rgba(0,0,0,0.5); color: white; fontFamily: var(--font-main); }
        .form-input option { background: var(--panel-bg); color: white; }

        .text-accent-blue { color: var(--accent-secondary); }
        .text-accent-green { color: var(--accent-color); }

        .markdown-content h1, .markdown-content h2, .markdown-content h3 { margin-top: 20px; margin-bottom: 10px; color: var(--accent-color); font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.5px; }
        .markdown-content p { margin-bottom: 12px; }
        .markdown-content ul { margin-left: 20px; margin-bottom: 15px; }
        .markdown-content li { margin-bottom: 6px; }
        .markdown-content strong { color: #fff; }
      `}} />
    </main>
  );
}
