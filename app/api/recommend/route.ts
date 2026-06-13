import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      environmentalData, 
      language = 'English', 
      reportType = 'action_plan',
      locationName = 'Unknown Location',
      currentMonth = 'Unknown Month',
      farmerContext
    } = body;

    if (!environmentalData) {
      return NextResponse.json({ error: 'Environmental data is required.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Mock mode if no API key is provided
      console.warn("GEMINI_API_KEY is not set. Returning mock response.");
      return NextResponse.json({
        recommendation: `> **Warning:** GEMINI_API_KEY is missing. Mock response loaded.\n\nThis is a mock ${reportType === 'technical_report' ? 'Technical Report' : 'Action Plan'} in ${language}. Please configure your API key for real data.`
      });
    }

    // Unpack farmer context if available
    const fcText = farmerContext 
      ? `Farmer Profile Context:
- Land Size: ${farmerContext.landSize} ${farmerContext.landUnit}
- Irrigation Method(s): ${farmerContext.irrigation}
- Primary Goal: ${farmerContext.goal}
- Market Access: ${farmerContext.market}
- Equipment Access: ${farmerContext.equipment}
- Investment Capacity: ${farmerContext.budget}
`
      : 'Farmer Profile Context: Not Provided.';

    // Base prompt structures based on reportType
    let promptInstruction = '';
    
    if (reportType === 'policies') {
      promptInstruction = `
You are an expert Government Agricultural Extension Officer operating in ${locationName}.
The current month is ${currentMonth}.
Generate a highly specific guide on "Government Schemes, Subsidies, and Aids" available to this specific farmer.

CRITICAL CONTEXT:
You MUST heavily filter the schemes based on the Farmer Profile Context and the Geopolitics of ${locationName}.
- State vs Central: Include universally applicable Central schemes (e.g. PM-Kisan) BUT you must prioritize State-specific schemes for the state ${locationName} is in.
- Land Size Limit: Check their land size. If it is large (e.g. over 5 Acres/2 Hectares), do NOT recommend schemes exclusively meant for "Small and Marginal Farmers".
- Equipment & Irrigation: If they selected Drip/Sprinkler, specifically outline how to claim PMKSY subsidies. If they selected Tractor, outline SMAM mechanization subsidies.
- Environmental Adaptation: You MUST look at the Environmental Data provided below. If Soil pH is highly acidic/alkaline, recommend the Soil Health Card Scheme or soil reclamation subsidies. If Groundwater is dangerously deep, recommend watershed development or rainwater harvesting subsidies.

Structure the report as follows:
1. **Eligibility Summary**: 2 sentences explaining what their specific profile qualifies them for.
2. **Top Central & State Schemes**: List 3-4 exact schemes they are eligible for. For EACH scheme provide:
   - **Benefit**: Exactly what financial or physical aid they get.
   - **How to Avail**: Exact steps (e.g., "Visit nearest CSC center", "Apply on PM-Kisan portal", "Contact Block Agriculture Officer").
3. **Local Contact Points**: General advice on the nearest government point of contact (e.g. Krishi Vigyan Kendra).
      `;
    } else if (reportType === 'action_plan') {
      promptInstruction = `
You are an expert agricultural advisor talking directly to a local farmer or rural assistant in ${locationName}.
The current month is ${currentMonth}.
Generate a highly practical "Action Plan" for the UPCOMING growing season.

CRITICAL CONTEXT & ECONOMICS:
You MUST heavily weigh the Farmer Profile Context. 
- Goal: If their goal is "Subsistence", prioritize food security crops. If "Maximize Profit", prioritize high-yield cash crops suitable for their Market Access.
- Market: If they only have "Local Village Market" access, do not recommend obscure export-oriented exotics.
- Equipment: If they only have "Manual Labor", do not recommend crops that require heavy mechanized harvesting.
- If their budget is Low/Subsistence, do NOT recommend highly mechanized or expensive commercial crops. 
- If their land size is very small (e.g. 0.5 Acre), prioritize high-value horticulture or intensive mixed-cropping to maximize income per square foot.
- Cross-reference environmental data with the geopolitical reality of ${locationName}. Do not hallucinate crops unsuitable for the region.

Structure the report as follows:
1. **Farm Assessment**: A brief, encouraging 2-sentence summary based on their exact land size, irrigation, equipment, and soil health.
2. **Top Seasonal Crop Recommendations**: 2-3 specific crops that fit their budget, market, equipment, water access, and upcoming season.
3. **Step-by-Step Improvement Plan**: 3 extremely practical things the farmer can do immediately to improve yield without breaking their budget.
      `;
    } else {
      promptInstruction = `
You are a senior agronomist generating a "Technical Report" regarding a plot in ${locationName}.
The current month is ${currentMonth}.
Generate a highly detailed, data-driven analysis for the upcoming agricultural cycle.

CRITICAL CONTEXT & ECONOMICS:
You MUST evaluate the commercial viability based on the Farmer Profile Context.
Analyze how the specific land size (${farmerContext?.landSize} ${farmerContext?.landUnit}), equipment (${farmerContext?.equipment}), and irrigation type (${farmerContext?.irrigation}) constrain or enable certain agronomic models given their investment capacity (${farmerContext?.budget}) and target market (${farmerContext?.market}).

Structure the report as follows:
1. **Physicochemical & Hydrological Assessment**: Deep dive into pH, carbon, granular composition, and water table relative to their irrigation method.
2. **Economic Viability Assessment**: How their land size, equipment, and market access impact economies of scale for cultivating specific regional crops.
3. **Agronomic Suitability Metrics**: Advanced recommendations for cash crops and necessary chemical/structural interventions.
      `;
    }

    // Construct the final prompt
    const prompt = `
${promptInstruction}

CRITICAL INSTRUCTION: You MUST write the ENTIRE response fluently in the following language: ${language}.

${fcText}

Environmental Data for ${locationName}:
- Mean Rainfall: ${Number(environmentalData.mean_rainfall).toFixed(3)} mm
- Mean Max Temp: ${Number(environmentalData.mean_t2m_max).toFixed(3)} °C
- Mean Min Temp: ${Number(environmentalData.mean_t2m_min).toFixed(3)} °C
- Groundwater Level: ${Number(environmentalData.mean_groundwater_level).toFixed(3)} m
- Well Depth: ${Number(environmentalData.well_depth).toFixed(3)} m
- Aquifer Type: ${environmentalData.well_aquifer_type}
- Soil pH: ${Number(environmentalData.soil_phaq).toFixed(3)}
- Soil Organic Carbon: ${Number(environmentalData.soil_orgc).toFixed(3)}
- Coarse Fragments Volumetric: ${Number(environmentalData.soil_cfvo_pct).toFixed(3)}%
- Soil Sand %: ${Number(environmentalData.soil_sand_pct).toFixed(3)}%
- Soil Clay %: ${Number(environmentalData.soil_clay_pct).toFixed(3)}%
- Soil Silt %: ${Number(environmentalData.soil_silt_pct).toFixed(3)}%

Ensure the formatting uses standard Markdown (bolding, lists, headers).
`;

    // Call Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", errorText);
      return NextResponse.json({ error: 'Failed to generate recommendation from AI.' }, { status: 500 });
    }

    const data = await response.json();
    const recommendation = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!recommendation) {
      return NextResponse.json({ error: 'Empty response from AI.' }, { status: 500 });
    }

    return NextResponse.json({ recommendation });

  } catch (error) {
    console.error("Error in /api/recommend:", error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
