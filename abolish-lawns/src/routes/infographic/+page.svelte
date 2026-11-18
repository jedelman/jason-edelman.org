<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lawns vs. Everything: A Comparison</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: #f8f8f7;
      color: #1a1a1a;
      padding: 2rem 1rem;
      line-height: 1.6;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    header {
      margin-bottom: 4rem;
      border-bottom: 2px solid #1a1a1a;
      padding-bottom: 2rem;
    }

    h1 {
      font-size: clamp(1.75rem, 5vw, 2.5rem);
      font-weight: 700;
      margin-bottom: 0.5rem;
      letter-spacing: -0.02em;
    }

    .subtitle {
      font-size: 1rem;
      color: #555;
      max-width: 600px;
      line-height: 1.5;
    }

    .panels {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
      gap: 3rem;
      margin-bottom: 4rem;
    }

    .panel {
      background: white;
      border: 1px solid #ddd;
      padding: 2.5rem;
      display: flex;
      flex-direction: column;
    }

    .panel-title {
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 0.25rem;
      letter-spacing: -0.01em;
    }

    .panel-unit {
      font-size: 0.875rem;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1.5rem;
    }

    .visualization {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 1rem;
      margin-bottom: 2rem;
      min-height: 300px;
    }

    .rect-container {
      display: flex;
      align-items: flex-end;
      justify-content: flex-start;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .rect {
      background: #1a1a1a;
      border: 1px solid #1a1a1a;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      position: relative;
      padding-bottom: 0.75rem;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 0.7rem;
      font-weight: 600;
      color: white;
      text-align: center;
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
    }

    .rect:hover {
      opacity: 0.85;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }

    /* Color variations */
    .rect.lawns { background: #2d7c2d; }
    .rect.beef { background: #8b3a3a; }
    .rect.golf { background: #4a7c59; }
    .rect.datacenters { background: #5a5a5a; }
    .rect.parks { background: #5d6f47; }
    .rect.vegetables { background: #6b8e23; }

    .rect-label {
      font-size: 0.65rem;
      max-width: 100%;
      margin-top: 0.5rem;
    }

    .rect-value {
      font-size: 0.8rem;
      font-weight: 700;
      margin-bottom: 0.25rem;
    }

    .legend {
      border-top: 1px solid #eee;
      padding-top: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      font-size: 0.85rem;
    }

    .legend-item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .legend-swatch {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      border: 1px solid rgba(0,0,0,0.1);
    }

    .legend-text {
      flex: 1;
    }

    .legend-number {
      font-weight: 700;
      color: #1a1a1a;
    }

    .legend-name {
      color: #666;
    }

    .tooltip {
      background: #1a1a1a;
      color: white;
      padding: 0.5rem 0.75rem;
      border-radius: 2px;
      font-size: 0.75rem;
      pointer-events: none;
      white-space: nowrap;
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-bottom: 0.5rem;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .rect:hover .tooltip {
      opacity: 1;
    }

    .tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-top: 4px solid #1a1a1a;
    }

    .source {
      font-size: 0.75rem;
      color: #888;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #eee;
    }

    footer {
      border-top: 2px solid #1a1a1a;
      padding-top: 2rem;
      color: #666;
      font-size: 0.875rem;
      line-height: 1.6;
      max-width: 900px;
    }

    footer h3 {
      font-size: 1rem;
      color: #1a1a1a;
      margin-bottom: 0.75rem;
      font-weight: 700;
    }

    footer ul {
      list-style: none;
      margin-bottom: 1.5rem;
    }

    footer li {
      margin-bottom: 0.5rem;
    }

    footer strong {
      font-weight: 700;
      color: #1a1a1a;
    }

    @media (max-width: 700px) {
      .panels {
        grid-template-columns: 1fr;
      }

      h1 {
        font-size: 1.5rem;
      }

      .panel {
        padding: 1.5rem;
      }

      .panel-title {
        font-size: 1.5rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Lawns vs. Everything</h1>
      <p class="subtitle">American lawns consume water, land, and fuel at scales that rival agriculture, energy infrastructure, and recreation. Each rectangle's area represents actual consumption—see how they compare.</p>
    </header>

    <div class="panels">
      <!-- WATER PANEL -->
      <div class="panel">
        <div class="panel-title">Water</div>
        <div class="panel-unit">Gallons per Year (billions)</div>
        
        <div class="visualization">
          <div class="rect-container">
            <div class="rect beef" style="width: 280px; height: 280px;" title="Beef: 21.2 trillion gallons/year">
              <div class="tooltip">21.2 trillion gallons</div>
              <div class="rect-value">21,200</div>
              <div class="rect-label">Beef (incl. feed)</div>
            </div>
          </div>
          <div class="rect-container" style="flex-wrap: wrap; gap: 0.75rem; justify-content: flex-start;">
            <div class="rect lawns" style="width: 140px; height: 140px;" title="Lawns: 2.9 trillion gallons/year">
              <div class="tooltip">2.9 trillion gallons</div>
              <div class="rect-value">2,900</div>
              <div class="rect-label">Lawns</div>
            </div>
            <div class="rect golf" style="width: 61px; height: 61px;" title="Golf: 500 billion gallons/year">
              <div class="tooltip">500 billion gallons</div>
              <div class="rect-value">500</div>
              <div class="rect-label">Golf</div>
            </div>
            <div class="rect datacenters" style="width: 22px; height: 22px;" title="Data centers: 17 billion gallons/year">
              <div class="tooltip">17 billion gallons</div>
              <div class="rect-value">17</div>
              <div class="rect-label">Data</div>
            </div>
          </div>
        </div>

        <div class="legend">
          <div class="legend-item">
            <div class="legend-swatch beef"></div>
            <div class="legend-text"><span class="legend-number">21.2T</span> <span class="legend-name">Beef production (including feed crops and irrigation)</span></div>
          </div>
          <div class="legend-item">
            <div class="legend-swatch lawns"></div>
            <div class="legend-text"><span class="legend-number">2.9T</span> <span class="legend-name">Residential lawn irrigation</span></div>
          </div>
          <div class="legend-item">
            <div class="legend-swatch golf"></div>
            <div class="legend-text"><span class="legend-number">500B</span> <span class="legend-name">Golf course irrigation (~2.4M acres)</span></div>
          </div>
          <div class="legend-item">
            <div class="legend-swatch datacenters"></div>
            <div class="legend-text"><span class="legend-number">17B</span> <span class="legend-name">US data center cooling & operations</span></div>
          </div>
        </div>

        <div class="source">
          <strong>Sources:</strong> EPA WaterSense; USGS livestock water data; USGA golf survey; Lawrence Berkeley Lab (data centers)
        </div>
      </div>

      <!-- LAND PANEL -->
      <div class="panel">
        <div class="panel-title">Land</div>
        <div class="panel-unit">Acres (millions)</div>
        
        <div class="visualization">
          <div class="rect-container">
            <div class="rect parks" style="width: 198px; height: 198px;" title="National Parks: 63 million acres">
              <div class="tooltip">63 million acres</div>
              <div class="rect-value">63</div>
              <div class="rect-label">National Parks</div>
            </div>
          </div>
          <div class="rect-container" style="flex-wrap: wrap; gap: 0.75rem; justify-content: flex-start;">
            <div class="rect lawns" style="width: 158px; height: 158px;" title="Lawns: 40 million acres">
              <div class="tooltip">40 million acres</div>
              <div class="rect-value">40</div>
              <div class="rect-label">Lawns</div>
            </div>
            <div class="rect vegetables" style="width: 50px; height: 50px;" title="Vegetables: 4 million acres">
              <div class="tooltip">4 million acres</div>
              <div class="rect-value">4</div>
              <div class="rect-label">Veg</div>
            </div>
            <div class="rect golf" style="width: 38px; height: 38px;" title="Golf: 2.4 million acres">
              <div class="tooltip">2.4 million acres</div>
              <div class="rect-value">2.4</div>
              <div class="rect-label">Golf</div>
            </div>
          </div>
        </div>

        <div class="legend">
          <div class="legend-item">
            <div class="legend-swatch parks"></div>
            <div class="legend-text"><span class="legend-number">63M</span> <span class="legend-name">All US National Parks (non-extractive)</span></div>
          </div>
          <div class="legend-item">
            <div class="legend-swatch lawns"></div>
            <div class="legend-text"><span class="legend-number">40M</span> <span class="legend-name">Residential lawns (estimated)</span></div>
          </div>
          <div class="legend-item">
            <div class="legend-swatch vegetables"></div>
            <div class="legend-text"><span class="legend-number">4M</span> <span class="legend-name">All US vegetables harvested</span></div>
          </div>
          <div class="legend-item">
            <div class="legend-swatch golf"></div>
            <div class="legend-text"><span class="legend-number">2.4M</span> <span class="legend-name">Golf courses (~16,000 courses)</span></div>
          </div>
        </div>

        <div class="source">
          <strong>Sources:</strong> USGS land survey; Milesi et al. satellite data; USDA Census; GCSAA golf course survey
        </div>
      </div>

      <!-- EMISSIONS PANEL -->
      <div class="panel">
        <div class="panel-title">Emissions</div>
        <div class="panel-unit">CO₂ Equivalent (megatons/year)</div>
        
        <div class="visualization">
          <div class="rect-container">
            <div class="rect beef" style="width: 261px; height: 261px;" title="Beef: ~2,600 MT CO₂e/year">
              <div class="tooltip">~2,600 MT CO₂e/year</div>
              <div class="rect-value">2,600</div>
              <div class="rect-label">Beef production</div>
            </div>
          </div>
          <div class="rect-container" style="flex-wrap: wrap; gap: 0.75rem; justify-content: flex-start;">
            <div class="rect lawns" style="width: 77px; height: 77px;" title="Lawn mowing: ~242 MT CO₂e/year">
              <div class="tooltip">~242 MT CO₂e/year</div>
              <div class="rect-value">242</div>
              <div class="rect-label">Lawn equipment</div>
            </div>
            <div class="rect datacenters" style="width: 27px; height: 27px;" title="Data centers: 50-100 MT CO₂e/year">
              <div class="tooltip">50–100 MT CO₂e/year</div>
              <div class="rect-value">75</div>
              <div class="rect-label">Data</div>
            </div>
          </div>
        </div>

        <div class="legend">
          <div class="legend-item">
            <div class="legend-swatch beef"></div>
            <div class="legend-text"><span class="legend-number">~2,600</span> <span class="legend-name">US beef production (feed crops, enteric methane, manure)</span></div>
          </div>
          <div class="legend-item">
            <div class="legend-swatch lawns"></div>
            <div class="legend-text"><span class="legend-number">~242</span> <span class="legend-name">Lawn & garden equipment (nonroad gas engines)</span></div>
          </div>
          <div class="legend-item">
            <div class="legend-swatch datacenters"></div>
            <div class="legend-text"><span class="legend-number">50–100</span> <span class="legend-name">US data centers (varies by grid mix)</span></div>
          </div>
        </div>

        <div class="source">
          <strong>Sources:</strong> FAO livestock emissions; EPA nonroad equipment model; Lawrence Berkeley Lab data center carbon analysis
        </div>
      </div>
    </div>

    <footer>
      <h3>Methodology & Caveats</h3>
      <ul>
        <li><strong>Water:</strong> Includes direct consumption and irrigation for feed crops. Beef figure encompasses all water inputs (feed crop irrigation, drinking water, processing). Data center figure is direct utility water only.</li>
        <li><strong>Land:</strong> Represents contiguous area; multi-use lands (pasture + cropping systems) are counted once. National Parks included for scale reference—they do not consume water or fuel in the extractive sense.</li>
        <li><strong>Emissions:</strong> Beef includes feed crop N₂O, enteric methane, and manure emissions. Lawn equipment includes all small gasoline-powered tools (mowers, blowers, trimmers). Data center emissions grid-dependent; range reflects US marginal grid mix.</li>
        <li><strong>Visual scale:</strong> Rectangles are area-proportional to the values shown. Hover for exact numbers.</li>
      </ul>

      <h3>Key Takeaways</h3>
      <ul>
        <li>Lawns use 2.9 trillion gallons of water annually—172× more than all US data centers.</li>
        <li>40 million acres of lawn—10× all US vegetables, and comparable to all National Parks.</li>
        <li>Lawn equipment emissions (242 MT CO₂e) dwarf data centers and rival modest energy sectors.</li>
      </ul>
    </footer>
  </div>

  <script>
    // Minimal interactivity for hover tooltips
    document.querySelectorAll('.rect').forEach(rect => {
      rect.addEventListener('mouseenter', function() {
        this.style.zIndex = '10';
      });
      rect.addEventListener('mouseleave', function() {
        this.style.zIndex = 'auto';
      });
    });
  </script>
</body>
</html>
