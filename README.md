# AgriGuide 🌾

**AgriGuide** is an AI-powered Agritech web application designed to help farmers and rural agricultural centers make informed, data-driven crop selection decisions based on their exact geographical location.

By analyzing critical agricultural factors such as soil fertility, groundwater availability, weather conditions, and climate patterns, the platform identifies the most suitable crops for cultivation. It bridges the gap between raw scientific data and actionable farming advice, empowering farmers to adopt smarter, more sustainable, and profitable farming practices.

---

## 🚀 Key Features

* **Interactive Geospatial Mapping**: Powered by Leaflet and OpenStreetMap, users can drop a pin anywhere on the map or use the autocomplete search bar to locate specific villages or farms.
* **Live Environmental Telemetry**: Automatically fetches hyper-local data for:
  * **Climatology**: Rainfall, Mean/Max/Min Temperatures.
  * **Hydrology**: Groundwater levels, Well depths, and Aquifer types.
  * **Soil Chemistry**: pH levels, Organic Carbon, and Sand/Silt/Clay composition.
* **Advanced Farmer Profiling**: A contextual form to capture the farmer's ground reality, including:
  * Land Size & Unit (Acres, Hectares, Bighas, etc.)
  * Irrigation Methods (Rain-fed, Canal, Drip, etc.)
  * Investment Capacity & Equipment Access.
  * Farming Goals & Market Access.
* **AI-Powered Multi-Lingual Reports**: Powered by the Gemini 2.5 Flash API, the platform generates three types of dynamic reports natively in multiple Indian languages (English, Hindi, Tamil, Telugu, Marathi, Bengali):
  1. **👨‍🌾 Action Plan**: A jargon-free, highly practical step-by-step guide for local farmers.
  2. **🔬 Technical Report**: A dense, data-driven agronomic analysis for government officials or scientists.
  3. **🏛️ Govt Schemes & Subsidies**: A tailored list of State and Central policies the farmer is eligible for, complete with application steps.

---

## 🛠️ Tech Stack

* **Frontend Framework**: [Next.js](https://nextjs.org/) (React)
* **Styling**: Custom CSS with Glassmorphism UI
* **Map Engine**: [React Leaflet](https://react-leaflet.js.org/) & OpenStreetMap (Nominatim API)
* **AI Engine**: [Google Gemini 2.5 Flash API](https://aistudio.google.com/)
* **Geospatial Data**: Open-Meteo & custom environmental APIs

---

## 💻 Running Locally

### 1. Clone the repository
```bash
git clone https://github.com/sid-vj/AgriGuide.git
cd AgriGuide
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Copy `.env.local.example` file to `.env.local`. Add your Gemini API key and Mongo DB URI:
```bash
cp .env.local.example .env.local
```

```env
GEMINI_API_KEY=your_gemini_api_key_here
MONGODB_URI=your_mongo_db_uri_here
WEATHER_API_KEY=7be53a0eab0e47eea97190927261306

```

### 4. Start the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## 🌍 Philosophy

Raw data (like "pH 8.5" or "2.8mm rainfall") often means nothing to a rural farmer. AgriGuide exists to translate cold scientific telemetry into warm, accessible, and economically viable advice. By combining geospatial intelligence with generative AI, AgriGuide serves as a digital Agricultural Extension Officer for the modern Indian farmer.
