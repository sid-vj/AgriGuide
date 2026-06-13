import Link from 'next/link';

export default function LandingPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)', color: 'var(--text-primary)', fontFamily: 'var(--font-main)' }}>
      
      {/* 100vh Hero Section */}
      <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
        
        {/* Navbar Overlay */}
        <header style={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 10, padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '45px', height: '45px', background: 'var(--accent-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', color: '#fff', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>🌾</div>
            <h1 style={{ fontSize: '1.8rem', margin: 0, textTransform: 'uppercase', letterSpacing: '2px', color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>AgriGuide</h1>
          </div>
          <Link href="/map" className="btn-glow" style={{ padding: '12px 28px', textDecoration: 'none', borderRadius: '30px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Enter App
          </Link>
        </header>

        {/* Fullscreen Hero Image (with text) */}
        <img 
          src="/images/hero-1.png" 
          alt="AgriGuide Platform" 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />

        {/* Scroll Indicator */}
        <div style={{ position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.9, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
          <span style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', fontWeight: 600 }}>Scroll to Discover</span>
          <div style={{ fontSize: '2rem', animation: 'bounce 2s infinite' }}>↓</div>
        </div>
      </div>

      {/* Main Content - Features */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 20px' }}>
        
        <div style={{ textAlign: 'center', maxWidth: '800px', marginBottom: '60px' }}>
          <h2 style={{ fontSize: '2.8rem', margin: '0 0 20px 0', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-primary)' }}>
            Data-Driven Farming
          </h2>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
            Empower your agricultural decisions with live environmental telemetry, precision soil analysis, and AI-driven crop recommendations. We combine modern satellite data with government intelligence to maximize your yield.
          </p>
        </div>

        {/* Features Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px', width: '100%', maxWidth: '1200px' }}>
          
          <div className="glass-panel feature-card" style={{ padding: '40px 30px', textAlign: 'center', transition: 'all 0.3s' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '20px' }}>🌍</div>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '15px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Precision Mapping</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.6' }}>Drop a pin anywhere in India to instantly retrieve live climatology and hydrology metrics tailored to your field.</p>
          </div>
          
          <div className="glass-panel feature-card" style={{ padding: '40px 30px', textAlign: 'center', transition: 'all 0.3s' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '20px' }}>🔬</div>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '15px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Govt Soil Telemetry</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.6' }}>Integrates directly with the DAC WMS server for highly accurate NPK (Nitrogen, Phosphorus, Potassium) analysis.</p>
          </div>
          
          <div className="glass-panel feature-card" style={{ padding: '40px 30px', textAlign: 'center', transition: 'all 0.3s' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '20px' }}>🏛️</div>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '15px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>AI Policy Matching</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.6' }}>Generates localized crop action plans and automatically filters applicable State and Central subsidies for you.</p>
          </div>

        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-15px); }
          60% { transform: translateY(-7px); }
        }
        .feature-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 15px 40px var(--accent-glow) !important;
          border-color: var(--accent-color) !important;
        }
      `}} />
    </main>
  );
}
