<script lang="ts">
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>Abolish Lawns — Factsheet</title>
	<meta name="description" content="The empirical and principled case for lawn abolition. Every claim sourced. For planners, policymakers, and anyone who needs to win an argument." />
</svelte:head>

<main>

	<header class="masthead">
		<div class="kicker">
			<span class="label">Factsheet</span>
			<span class="label label--muted">Updated 2025</span>
		</div>
		<hr class="rule rule--acid" />
		<h1 class="page-title">The Case<br />Against<br />Lawns</h1>
		<hr class="rule" />
		<p class="deck">
			This document presents the empirical and principled case for abolishing
			the American residential lawn. It is designed for use by planners,
			policymakers, advocates, and anyone who needs to win an argument.
			Numbers are sourced. Where data is contested, we say so.
			The argument does not rest solely on the numbers.
		</p>
		<nav class="toc">
			<span class="toc__label">Contents</span>
			<a href="#scale">Scale</a>
			<a href="#ecology">Ecology</a>
			<a href="#enforcement">Enforcement</a>
			<a href="#commons">The commons argument</a>
			<a href="#waterbills">Water bills</a>
			<a href="#datacenters">Lawns vs. data centers</a>
			<a href="#alternatives">Alternatives</a>
			<a href="#sources">Sources</a>
		</nav>
	</header>

	<!-- ══ SCALE ══════════════════════════════════════════════════════════════ -->
	<section class="section" id="scale">
		<div class="section__header">
			<span class="section__number">01</span>
			<h2 class="section__title">Scale</h2>
		</div>
		<hr class="rule rule--thin" />

		<div class="fact-block">
			<div class="fact">
				<div class="fact__figure">~40M</div>
				<div class="fact__claim">acres of turf grass in the continental United States</div>
				<div class="fact__source">Milesi et al. (2005), NASA/UCSB — satellite-derived estimate: 163,812 km² ± 35,850 km². Covers all managed turf including parks, roadsides, and golf courses; residential lawns are the largest component.</div>
			</div>
			<div class="fact">
				<div class="fact__figure">3×</div>
				<div class="fact__claim">larger than any single irrigated food crop</div>
				<div class="fact__source">Milesi et al. (2005). Turf grass exceeds irrigated corn by a factor of three. The comparison is to <em>irrigated</em> crops; total cropland for major commodities like corn and soybeans is larger, but those crops are largely rain-fed.</div>
			</div>
			<div class="fact">
				<div class="fact__figure">$153B</div>
				<div class="fact__claim">annual US landscaping services industry revenue (2024)</div>
				<div class="fact__source">IBIS World via National Association of Landscape Professionals (2025). Covers all commercial and residential landscaping. Lawn care services specifically represent approximately $60–65B of this total. The industry has grown at 6.5% annually since 2020.</div>
			</div>
			<div class="fact">
				<div class="fact__figure">9B</div>
				<div class="fact__claim">gallons of water used for residential landscape irrigation daily</div>
				<div class="fact__source">U.S. EPA WaterSense Program. Landscape irrigation accounts for nearly one-third of all residential water use nationwide. In arid western regions, outdoor use reaches 60% of total household consumption. Up to 50% of this water is wasted through evaporation, wind, and runoff from inefficient systems.</div>
			</div>
			<div class="fact">
				<div class="fact__figure">78M</div>
				<div class="fact__claim">Americans living in community associations (HOAs, condominiums, co-ops)</div>
				<div class="fact__source">Foundation for Community Association Research, Fact Book 2025. This is 358,000 associations. HOAs — which are the primary vehicle for residential lawn enforcement — account for 58–63% of the total, suggesting approximately 45–49 million Americans live specifically under HOA lawn governance.</div>
			</div>
		</div>

		<div class="prose">
			<p>
				These numbers describe infrastructure, not preference. The American
				lawn is the largest irrigated land use in the country — larger than
				any food crop — sustained by a $153 billion services industry, consuming
				nearly a tenth of the nation's residential water supply. It did not
				get this large because people chose it freely. It got this large because
				the legal, financial, and social infrastructure made it the default,
				and deviation from the default costly.
			</p>
		</div>
	</section>

	<!-- ══ ECOLOGY ════════════════════════════════════════════════════════════ -->
	<section class="section" id="ecology">
		<div class="section__header">
			<span class="section__number">02</span>
			<h2 class="section__title">Ecological costs</h2>
		</div>
		<hr class="rule rule--thin" />

		<div class="fact-block">
			<div class="fact">
				<div class="fact__figure">3–9×</div>
				<div class="fact__claim">more pesticide applied per acre on lawns than on agricultural crops</div>
				<div class="fact__source">Beyond Pesticides factsheet, citing Pimentel et al. (1991) CRC Press Handbook: suburban lawns receive 3.2–9.8 lbs of pesticide per acre vs. 2.7 lbs/acre on agricultural land on average. Oklahoma State University Extension independently confirms "two or three times as much nitrogen as a typical field crop." Friends of the Earth (2021) cites up to 10× more intensive application. The precise multiplier varies by region and lawn type; the direction is consistent across sources.</div>
			</div>
			<div class="fact">
				<div class="fact__figure">90M</div>
				<div class="fact__claim">pounds of pesticide applied to US lawns annually</div>
				<div class="fact__source">Beyond Pesticides (2005), citing EPA Pesticides Industry Sales and Usage data. This figure has not been updated recently; current usage may be higher given industry growth.</div>
			</div>
			<div class="fact">
				<div class="fact__figure">50%</div>
				<div class="fact__claim">of lawn irrigation water is wasted</div>
				<div class="fact__source">U.S. EPA WaterSense Program. Lost to evaporation, wind drift, and runoff caused by inefficient irrigation methods and improper scheduling. This is not marginal waste — half the water applied to American lawns does not reach plant roots.</div>
			</div>
		</div>

		<div class="prose">
			<p>
				The ecological damage of the lawn is not a side effect. It is built
				into what the lawn is. A lawn is, by definition, a monoculture —
				a single species managed to exclude everything else. Maintaining that
				monoculture against the ecological pressure to diversify requires
				herbicide, pesticide, and synthetic fertilizer applied at rates that
				exceed agricultural norms. The runoff from this chemical load enters
				storm drains, streams, and groundwater.
			</p>
			<p>
				Turf grass supports almost no insect life. Insects require host plants,
				and the overwhelming majority of insect species cannot use non-native
				grass as a host. A lawn is, in ecological terms, a biological desert
				with a green surface. It produces no food, sequesters minimal carbon
				(less than the emissions from its maintenance equipment), and supports
				no wildlife corridor function.
			</p>
			<p>
				The lawn also contributes directly to urban heat islands and stormwater
				flooding. Compacted turf soil has significantly lower infiltration
				rates than diverse ground cover; runoff from suburban lawn areas
				increases peak flood flows in adjacent waterways.
			</p>
		</div>
	</section>

	<!-- ══ ENFORCEMENT ════════════════════════════════════════════════════════ -->
	<section class="section" id="enforcement">
		<div class="section__header">
			<span class="section__number">03</span>
			<h2 class="section__title">The enforcement architecture</h2>
		</div>
		<hr class="rule rule--thin" />

		<div class="prose">
			<p>
				The lawn persists not because people love it but because the system
				makes deviation costly. This is not metaphor — it is legal architecture.
				There are four interlocking enforcement mechanisms.
			</p>
		</div>

		<div class="enforcement-table">
			<div class="etable__row etable__header">
				<div>Mechanism</div>
				<div>Legal basis</div>
				<div>Enforcement</div>
				<div>Scope</div>
			</div>
			<div class="etable__row">
				<div class="etable__mech">Municipal weed ordinances</div>
				<div>City/county code; classifies vegetation above 8–12" as "noxious weed" or "public health menace"</div>
				<div>Fines, municipal mowing at owner's expense, property liens</div>
				<div>Prevalent in hundreds of US municipalities; exact count not systematically documented</div>
			</div>
			<div class="etable__row">
				<div class="etable__mech">HOA covenants</div>
				<div>Private contract, recorded with deed, binding on all subsequent owners</div>
				<div>Fines, liens, foreclosure in extreme cases</div>
				<div>~45–49M Americans in HOA-governed single-family housing (CAI 2025)</div>
			</div>
			<div class="etable__row">
				<div class="etable__mech">Subdivision plats and CC&Rs</div>
				<div>Recorded land use restrictions, run with the land indefinitely</div>
				<div>Civil enforcement by neighbors or HOA</div>
				<div>Millions of postwar-era plats still in force; many include landscaping standards</div>
			</div>
			<div class="etable__row">
				<div class="etable__mech">Zoning codes</div>
				<div>Municipal land use law; may specify front-yard treatment, prohibit "agricultural" uses in residential zones</div>
				<div>Code enforcement, denial of permits for non-conforming alterations</div>
				<div>Varies by jurisdiction; front-yard food gardens prohibited by zoning in many municipalities</div>
			</div>
		</div>

		<div class="prose">
			<p>
				The cost of challenging any single mechanism is high. The cost of
				simultaneously defying all four is prohibitive for most homeowners.
				This is not an accident. The system was designed to be self-reinforcing:
				social conformity pressure backstops legal enforcement; legal enforcement
				backstops social pressure. The result is near-universal compliance
				regardless of individual preference.
			</p>
			<p>
				The question of whether people "want" their lawns cannot be answered
				honestly within a system that makes the alternative illegal and socially
				costly. Removing the mandate would reveal what people actually prefer —
				and the evidence from jurisdictions that have relaxed lawn ordinances
				suggests most homeowners, given genuine choice, choose something else.
			</p>
		</div>
	</section>

	<!-- ══ THE COMMONS ARGUMENT ═══════════════════════════════════════════════ -->
	<section class="section section--accent" id="commons">
		<div class="section__header">
			<span class="section__number">04</span>
			<h2 class="section__title">The principled argument: enclosure</h2>
		</div>
		<hr class="rule rule--thin" />

		<blockquote class="pullquote">
			<p>The environmental case against the lawn is compelling.
			It is not sufficient. The deeper problem is structural:
			the lawn is an enclosure of the commons, not merely
			a bad use of land.</p>
		</blockquote>

		<div class="prose">
			<p>
				The commons, as a concept, refers to resources governed collectively
				for shared benefit. Enclosure refers to the process by which commons
				are captured — converted from collective use into private or
				pseudo-private control, with the benefits extracted and the costs
				externalized onto those who no longer have access.
			</p>
			<p>
				The American front lawn is an enclosure in a precise sense.
				Olmsted's original design vision — continuous, unfenced, collectively
				maintained green space linking households into shared landscape —
				was a genuine commons proposal. What was built instead is a
				simulacrum: the spatial structure of a commons (unfenced, continuous,
				collective in appearance) combined with the governance structure of
				private property (maintained at individual expense, governed by
				private contract, enforced by legal apparatus that punishes dissent).
			</p>
			<p>
				The lawn looks like shared space. It functions as individually mandated
				private maintenance, performed for the benefit of no one who lives on it.
				The beneficiary is the appearance of a particular class identity —
				and, more materially, the chemical and maintenance industries whose
				revenue depends on the mandate.
			</p>
			<p>
				This is why the environmental case, while correct, is not the
				full argument. Reducing pesticide application on lawns would make
				the enclosure less toxic. It would not make it less of an enclosure.
				The land would still be governed by a maintenance ideology that
				forecloses collective use. Wildflower lawns and native plantings,
				promoted by many environmental groups as the alternative, leave
				the structure of private enforcement intact. They ask only that
				the aesthetic requirements of that enforcement be liberalized.
			</p>
			<p>
				The genuine alternative is collective governance of the land itself:
				food forests with shared harvest rights, pollinator corridors
				maintained under neighborhood compacts, community gardens replacing
				private turf, stormwater infrastructure designed and managed at
				the block level. These are not individual consumer choices. They
				require institutional change — reformed ordinances, revised HOA
				law, updated zoning — because they are proposals about how land
				is governed, not merely how it looks.
			</p>
			<p>
				The demand to abolish the lawn is, at its core, a demand to
				re-open the question of what residential land is for. It is a
				commons restoration argument: that land currently enclosed by
				a maintenance mandate should instead be available for collective
				decision about its use, governed by the people who live on it
				for the benefit of the people who live near it.
			</p>
		</div>

		<div class="theory-box">
			<h3 class="theory-box__head">Further reading on commons and enclosure</h3>
			<ul class="theory-list">
				<li>Elinor Ostrom, <em>Governing the Commons</em> (1990) — the foundational work on collective resource governance. Demolishes the "tragedy of the commons" framing.</li>
				<li>Peter Linebaugh, <em>The Magna Carta Manifesto</em> (2008) — the history of enclosure as political violence.</li>
				<li>David Bollier, <em>Think Like a Commoner</em> (2014) — accessible introduction to commons theory and contemporary applications.</li>
				<li>Power Explained — <a href="https://power-explained.jason-edelman.org">power-explained.jason-edelman.org</a> — the commons framework applied to contemporary power analysis. The conceptual vocabulary underlying this site.</li>
			</ul>
		</div>
	</section>

	<!-- ══ WATER BILLS ════════════════════════════════════════════════════════ -->
	<section class="section" id="waterbills">
		<div class="section__header">
			<span class="section__number">05</span>
			<h2 class="section__title">The water bill</h2>
		</div>
		<hr class="rule rule--thin" />

		<div class="fact-block">
			<div class="fact">
				<div class="fact__figure">50–70%</div>
				<div class="fact__claim">of a summer residential water bill goes to lawn irrigation</div>
				<div class="fact__source">EPA WaterSense; Bluefield Research. In arid western regions, outdoor water use reaches 60–70% of total household consumption during summer months.</div>
			</div>
			<div class="fact">
				<div class="fact__figure">+24%</div>
				<div class="fact__claim">increase in US water and sewer rates over five years (2019–2024)</div>
				<div class="fact__source">Bluefield Research, US Municipal Water and Wastewater Rates Survey (2024). Faster than general inflation over the same period. Rate increases are projected to continue as infrastructure ages and climate pressures intensify.</div>
			</div>
			<div class="fact">
				<div class="fact__figure">$765</div>
				<div class="fact__claim">per quarter — one New Jersey homeowner's summer water bill, attributed to lawn irrigation</div>
				<div class="fact__source">Forum testimony, aroundtheyard.com: "$765.44 for the quarter... $56.70 per month per thousand square feet of lawn." Illustrative of real household cost; individual bills vary widely by region, lot size, and water pricing structure.</div>
			</div>
		</div>

		<div class="prose">
			<p>
				The hidden mechanism in most water bills is the sewer charge.
				Most utilities calculate sewer fees based on total water consumed —
				including water used for outdoor irrigation that soaks into the ground
				or evaporates and never enters a drain. Homeowners pay sewage treatment
				rates on water that the sewage system never touches.
			</p>
			<p>
				Some utilities offer irrigation meters or seasonal sewer adjustments
				to address this. Most do not. The result: the lawn raises your water
				bill twice — once for the water, once for sewer fees on water
				that went into the sky.
			</p>
			<p>
				The single most documented water-saving intervention available to
				homeowners is lawn removal. One California homeowner reported summer
				water usage falling to 10–15% of prior levels after lawn removal,
				with rebates covering approximately half the conversion cost.
				(Bogleheads.org forum; consistent with EPA and academic literature
				on outdoor water use reduction from native plant conversion.)
			</p>
		</div>
	</section>

	<!-- ══ LAWNS VS DATA CENTERS ══════════════════════════════════════════════ -->
	<section class="section" id="datacenters">
		<div class="section__header">
			<span class="section__number">06</span>
			<h2 class="section__title">Lawns vs. data centers</h2>
		</div>
		<hr class="rule rule--thin" />

		<div class="prose">
			<p>
				Public concern about AI and data center water use is legitimate and growing.
				It is also, at the national scale, significantly misdirected.
				The comparison below is not an argument that data center water use
				doesn't matter — it does, especially locally. It is an argument
				about where individual leverage exists.
			</p>
		</div>

		<div class="fact-block">
			<div class="fact">
				<div class="fact__figure">~2.9T</div>
				<div class="fact__claim">gallons per year — US residential and commercial lawn irrigation</div>
				<div class="fact__source">EPA WaterSense (9B gallons/day × seasonal adjustment); Heath Scott (2026), Substack. Consistent with Milesi et al. (2005) acreage × per-acre irrigation estimates.</div>
			</div>
			<div class="fact">
				<div class="fact__figure">~17B</div>
				<div class="fact__claim">gallons per year — all US data centers, direct cooling water consumption (2023)</div>
				<div class="fact__source">Shehabi et al. (2024), Lawrence Berkeley National Laboratory. Direct cooling water only. Indirect consumption via electricity generation adds ~211B gallons (methodology contested — see Construction Physics, 2025).</div>
			</div>
			<div class="fact">
				<div class="fact__figure">~170×</div>
				<div class="fact__claim">more water from US lawns than all US data centers combined (direct)</div>
				<div class="fact__source">Calculated: 2,900B ÷ 17B = ~170. US-to-US comparison, direct water consumption only. If indirect electricity water is included for data centers (~211B gallons), ratio narrows to ~14×. If compared to global AI data centers (~260B gallons), ratio is ~11×. All ratios favor the same conclusion.</div>
			</div>
		</div>

		<div class="prose">
			<p>
				The data center water problem is real in specific contexts.
				A single Meta data center in Newton County, Georgia uses 500,000 gallons
				per day — 10% of the entire county's water consumption.
				Northern Virginia data centers consumed approximately 2 billion gallons
				in 2023, a 63% increase from 2019, straining local utilities.
				These are not abstract national statistics for the communities affected.
				(Lincoln Institute of Land Policy, 2026; EESI, 2024.)
			</p>
			<p>
				The national comparison nonetheless stands: at aggregate scale,
				lawns consume vastly more water than data centers, with no productive
				output, under legal compulsion, on land that is privately owned
				and could be used differently. The correct framework applies the
				same commons critique to both: extraction of shared water resources
				for private or corporate benefit, with costs externalized onto
				communities. Both deserve the same analysis. The lawn is the one
				most people have direct leverage over.
			</p>
		</div>

		<div class="theory-box">
			<h3 class="theory-box__head">On using this comparison honestly</h3>
			<ul class="theory-list">
				<li>Always specify US-to-US when citing the 170× ratio. The "11×" figure compares US lawns to <em>global</em> AI data centers — a different scope.</li>
				<li>The indirect water figure for data centers (211B gallons) is methodologically contested. Use the direct figure (17B) for defensible comparisons.</li>
				<li>Local data center water impacts are real and should not be dismissed. The national ratio does not negate concentrated local harm.</li>
				<li>Hyperscalers (Google, Amazon, Meta, Microsoft) claim 100% renewable electricity, which affects the indirect calculation. See Shehabi et al. (2024) and Potter (2025) for methodology.</li>
			</ul>
		</div>
	</section>

	<!-- ══ ALTERNATIVES ═══════════════════════════════════════════════════════ -->
	<section class="section" id="alternatives">
		<div class="section__header">
			<span class="section__number">07</span>
			<h2 class="section__title">What replaces the lawn</h2>
		</div>
		<hr class="rule rule--thin" />

		<div class="prose">
			<p>
				The argument against the lawn is not an argument against green space,
				outdoor life, or neighborhood aesthetics. It is an argument against
				<em>this specific form</em> of green space, enforced by <em>this
				specific legal architecture</em>, at <em>this specific ecological cost</em>.
				The question of what replaces it is a design and governance question,
				not an aesthetic one.
			</p>
		</div>

		<div class="alt-grid">
			<div class="alt-item">
				<h3 class="alt-item__head">Native meadow and prairie</h3>
				<p>Regionally appropriate native grasses and forbs, mowed once annually. Dramatically lower water and chemical inputs than turf. Supports native insect populations. Requires regulatory permission in most jurisdictions — this is the political obstacle, not the horticultural challenge.</p>
				<span class="alt-item__tag">Individual action possible; legal reform needed</span>
			</div>
			<div class="alt-item">
				<h3 class="alt-item__head">Front-yard food production</h3>
				<p>Prohibited by zoning in many municipalities and by HOA covenant in most planned communities. Several states (Florida, California, Illinois, others) have preempted HOA restrictions on vegetable gardens — this is the model. Productive, high ecological value, directly serves the household.</p>
				<span class="alt-item__tag">Requires ordinance reform and HOA preemption</span>
			</div>
			<div class="alt-item">
				<h3 class="alt-item__head">Food forests and community orchards</h3>
				<p>Multi-story productive plantings (canopy, understory, ground layer) on formerly private lawn or publicly owned verge. Requires collective governance structures — who harvests, who maintains, who decides. This is a commons institution, not a landscape feature.</p>
				<span class="alt-item__tag">Requires collective governance structures</span>
			</div>
			<div class="alt-item">
				<h3 class="alt-item__head">Bioswales and stormwater infrastructure</h3>
				<p>Designed infiltration landscapes replacing impervious or compacted turf. High public benefit — reduces peak flood flows, recharges groundwater, reduces municipal stormwater costs. In coastal and flood-prone cities, this is the single highest-value lawn conversion available.</p>
				<span class="alt-item__tag">High public benefit; often eligible for public subsidy</span>
			</div>
			<div class="alt-item">
				<h3 class="alt-item__head">Pollinator corridors</h3>
				<p>Coordinated native planting across multiple adjacent properties — the block as the unit of ecological function, not the individual parcel. Requires neighbor agreement and basic coordination infrastructure. Several cities have supported corridor programs with grant funding and technical assistance.</p>
				<span class="alt-item__tag">Block-scale coordination; public program eligible</span>
			</div>
			<div class="alt-item">
				<h3 class="alt-item__head">Nothing</h3>
				<p>Letting the land return to local successional ecology — whatever would grow there without active management. This is the most ecologically correct answer for most of the country, and the most legally fraught. The fact that "doing nothing" is illegal is the clearest possible demonstration that the lawn mandate is not about ecology.</p>
				<span class="alt-item__tag">Requires repeal of weed ordinances</span>
			</div>
		</div>
	</section>

	<!-- ══ SOURCES ════════════════════════════════════════════════════════════ -->
	<section class="section" id="sources">
		<div class="section__header">
			<span class="section__number">08</span>
			<h2 class="section__title">Key sources</h2>
		</div>
		<hr class="rule rule--thin" />

		<div class="source-list">
			<div class="source-item">
				<span class="source-item__type">Peer-reviewed</span>
				<div>
					<p class="source-item__ref">Milesi, C. et al. (2005). "Mapping and Modeling the Biogeochemical Cycling of Turf Grasses in the United States." <em>Environmental Management</em> 36(3): 426–438.</p>
					<p class="source-item__note">Primary source for all acreage estimates. NASA-funded satellite analysis. DOI: 10.1007/s00267-004-0316-2</p>
				</div>
			</div>
			<div class="source-item">
				<span class="source-item__type">Government</span>
				<div>
					<p class="source-item__ref">U.S. EPA WaterSense Program. "Outdoors" and "Statistics and Facts." epa.gov/watersense</p>
					<p class="source-item__note">Source for the 9 billion gallons/day figure and the 50% waste estimate.</p>
				</div>
			</div>
			<div class="source-item">
				<span class="source-item__type">Government</span>
				<div>
					<p class="source-item__ref">Shehabi, A. et al. (2024). <em>United States Data Center Energy Usage Report.</em> Lawrence Berkeley National Laboratory, LBNL-2001643.</p>
					<p class="source-item__note">Primary source for US data center water consumption: 17 billion gallons direct, 211 billion gallons indirect (2023). The indirect figure is methodologically contested — see Potter (2025). Projects doubling or quadrupling by 2028.</p>
				</div>
			</div>
			<div class="source-item">
				<span class="source-item__type">Government</span>
				<div>
					<p class="source-item__ref">Oklahoma State University Extension (2017). "Pesticides in Residential Areas — Protecting the Environment." Fact Sheet.</p>
					<p class="source-item__note">Extension service source for pesticide intensity comparison.</p>
				</div>
			</div>
			<div class="source-item">
				<span class="source-item__type">Government</span>
				<div>
					<p class="source-item__ref">MOST Policy Initiative (2025). "Data Center Water Use." mostpolicyinitiative.org/science-note/data-center-water-use/</p>
					<p class="source-item__note">Most current policy synthesis. Confirms 17.4B gallons direct consumption 2023. Projects 38–73B gallons by 2028.</p>
				</div>
			</div>
			<div class="source-item">
				<span class="source-item__type">Industry</span>
				<div>
					<p class="source-item__ref">Bluefield Research (2024). US Municipal Water and Wastewater Rates Survey. bluefieldresearch.com</p>
					<p class="source-item__note">Source for the 24% water rate increase over five years (2019–2024).</p>
				</div>
			</div>
			<div class="source-item">
				<span class="source-item__type">Industry</span>
				<div>
					<p class="source-item__ref">Foundation for Community Association Research. <em>Community Association Fact Book 2025.</em> foundation.caionline.org</p>
					<p class="source-item__note">Source for the 78 million Americans figure. CAI is the HOA industry's trade association — this data serves their interests but uses American Community Survey methodology.</p>
				</div>
			</div>
			<div class="source-item">
				<span class="source-item__type">Industry</span>
				<div>
					<p class="source-item__ref">National Association of Landscape Professionals / IBIS World (2025). Landscape Industry Statistics. landscapeprofessionals.org</p>
					<p class="source-item__note">Source for $153–188B market size figure. NALP figure; IBIS World is a commercial research firm.</p>
				</div>
			</div>
			<div class="source-item">
				<span class="source-item__type">Policy</span>
				<div>
					<p class="source-item__ref">Lincoln Institute of Land Policy (2026). "Data Drain: The Land and Water Impacts of the AI Boom." <em>Land Lines Magazine.</em> lincolninst.edu</p>
					<p class="source-item__note">Documents lawns vs. data centers comparison and Newton County, GA case study (Meta data center = 10% of county water). Source of Zine No. 03 quote on "well-documented addiction to green grass."</p>
				</div>
			</div>
			<div class="source-item">
				<span class="source-item__type">Advocacy</span>
				<div>
					<p class="source-item__ref">Beyond Pesticides (2005). "Lawn Pesticide Facts and Figures." beyondpesticides.org</p>
					<p class="source-item__note">Source for 90M pounds/year pesticide figure and the 3.2–9.8 lbs/acre vs. 2.7 lbs/acre comparison. Advocacy organization; underlying data from EPA and CRC Press handbook. Use with explicit attribution.</p>
				</div>
			</div>
			<div class="source-item">
				<span class="source-item__type">Primary</span>
				<div>
					<p class="source-item__ref">Pollan, M. (1989). "Why Mow? The Case Against Lawns." <em>New York Times Magazine,</em> May 28. Reprinted in <em>Second Nature</em> (Grove Press, 1991).</p>
					<p class="source-item__note">Historical and ideological context; Olmsted history; Buffalo scholar case (unverified from independent primary source — attributed to Pollan 1989 only).</p>
				</div>
			</div>
			<div class="source-item">
				<span class="source-item__type">Analysis</span>
				<div>
					<p class="source-item__ref">Potter, B. (2025). "I Was Wrong About Data Center Water Consumption." <em>Construction Physics</em> (Substack). construction-physics.com</p>
					<p class="source-item__note">Important methodology correction on the Lawrence Berkeley Lab indirect water figures. Use when citing indirect data center water consumption — the 211B figure is more contested than the 17B direct figure.</p>
				</div>
			</div>
		</div>

		<p class="sources-note">
			Full bibliography with methodology notes, confidence assessments, and
			research gaps: <a href="{base}/bibliography">Bibliography →</a>
		</p>
	</section>

	<div class="back">
		<a href="{base}/">← Return to manifesto</a>
		<a href="{base}/bibliography">Full bibliography →</a>
	</div>

</main>

<style>
main {
	max-width: 1100px;
	margin: 0 auto;
	padding: 0 var(--space-6);
}

/* ── Masthead ─── */
.masthead { padding: var(--space-12) 0 var(--space-8); }

.kicker { display: flex; gap: var(--space-4); margin-bottom: var(--space-4); }

.label {
	font-family: var(--font-display);
	font-size: var(--text-sm);
	font-weight: 600;
	letter-spacing: .12em;
	text-transform: uppercase;
	color: var(--text-secondary);
}

.label--muted { color: var(--text-tertiary); }

.page-title {
	font-family: var(--font-display);
	font-size: clamp(3rem, 8vw, 7rem);
	font-weight: 900;
	line-height: .9;
	letter-spacing: -.02em;
	text-transform: uppercase;
	color: var(--ink);
	margin: var(--space-6) 0;
}

.deck {
	font-size: var(--text-lg);
	line-height: 1.6;
	max-width: 68ch;
	margin-top: var(--space-6);
	color: var(--text-primary);
}

.toc {
	display: flex;
	align-items: center;
	gap: var(--space-4);
	flex-wrap: wrap;
	margin-top: var(--space-8);
	padding-top: var(--space-4);
	border-top: 1px solid var(--border);
}

.toc__label {
	font-family: var(--font-display);
	font-size: var(--text-xs);
	font-weight: 600;
	letter-spacing: .1em;
	text-transform: uppercase;
	color: var(--text-tertiary);
}

.toc a {
	font-family: var(--font-display);
	font-size: var(--text-sm);
	font-weight: 600;
	letter-spacing: .04em;
	text-transform: uppercase;
	text-decoration: none;
	color: var(--text-secondary);
	border-bottom: 1px solid var(--border);
	padding-bottom: 1px;
	transition: color .15s, border-color .15s;
}

.toc a:hover { color: var(--acid-dim); border-color: var(--acid-dim); }

/* ── Sections ─── */
.section { padding: var(--space-12) 0; border-top: 1px solid var(--border); }

.section--accent {
	background: var(--bg-raised);
	margin: 0 calc(-1 * var(--space-6));
	padding: var(--space-12) var(--space-6);
	border-top: none;
	border-bottom: 1px solid var(--border);
}

.section__header {
	display: flex;
	align-items: baseline;
	gap: var(--space-4);
	margin-bottom: var(--space-4);
}

.section__number {
	font-family: var(--font-display);
	font-size: var(--text-sm);
	font-weight: 600;
	letter-spacing: .1em;
	color: var(--acid-dim);
	text-transform: uppercase;
}

h2.section__title {
	font-family: var(--font-display);
	font-size: clamp(1.5rem, 3vw, 2.25rem);
	font-weight: 700;
	text-transform: uppercase;
	color: var(--ink);
}

/* ── Facts ─── */
.fact-block {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
	border: 1px solid var(--border);
	margin: var(--space-8) 0;
}

.fact {
	padding: var(--space-6);
	border-right: 1px solid var(--border);
	border-bottom: 1px solid var(--border);
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}

.fact:nth-child(2n) { border-right: none; }

.fact__figure {
	font-family: var(--font-display);
	font-size: clamp(2.5rem, 5vw, 4rem);
	font-weight: 900;
	line-height: 1;
	color: var(--acid-dim);
	font-variant-numeric: tabular-nums;
}

.fact__claim {
	font-family: var(--font-display);
	font-size: var(--text-lg);
	font-weight: 700;
	text-transform: uppercase;
	color: var(--ink);
	line-height: 1.1;
}

.fact__source {
	font-size: var(--text-xs);
	color: var(--text-tertiary);
	line-height: 1.55;
	border-top: 1px solid var(--border);
	padding-top: var(--space-3);
	margin-top: auto;
}

/* ── Prose ─── */
.prose {
	margin-top: var(--space-8);
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
}

.prose p { color: var(--text-primary); max-width: 65ch; }

/* ── Enforcement table ─── */
.enforcement-table {
	margin: var(--space-8) 0;
	border: 1px solid var(--border);
}

.etable__row {
	display: grid;
	grid-template-columns: 1.5fr 2fr 1.5fr 2fr;
	border-bottom: 1px solid var(--border);
}

.etable__row:last-child { border-bottom: none; }

.etable__header {
	background: var(--bg-raised);
}

.etable__header > div {
	padding: var(--space-3) var(--space-4);
	font-family: var(--font-display);
	font-size: var(--text-xs);
	font-weight: 600;
	letter-spacing: .1em;
	text-transform: uppercase;
	color: var(--text-secondary);
	border-right: 1px solid var(--border);
}

.etable__header > div:last-child { border-right: none; }

.etable__row > div {
	padding: var(--space-4);
	font-size: var(--text-sm);
	color: var(--text-secondary);
	border-right: 1px solid var(--border);
	line-height: 1.55;
}

.etable__row > div:last-child { border-right: none; }

.etable__mech {
	font-family: var(--font-display);
	font-weight: 700;
	text-transform: uppercase;
	font-size: var(--text-sm) !important;
	color: var(--ink) !important;
}

/* ── Theory box ─── */
.theory-box {
	border: 1px solid var(--border);
	padding: var(--space-6);
	margin-top: var(--space-8);
}

.theory-box__head {
	font-family: var(--font-display);
	font-size: var(--text-base);
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: .04em;
	color: var(--ink);
	margin-bottom: var(--space-4);
}

.theory-list {
	list-style: none;
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}

.theory-list li {
	font-size: var(--text-sm);
	color: var(--text-secondary);
	line-height: 1.6;
	padding-left: var(--space-4);
	border-left: 2px solid var(--acid);
}

/* ── Alternatives grid ─── */
.alt-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
	border: 1px solid var(--border);
	margin-top: var(--space-8);
}

.alt-item {
	padding: var(--space-6);
	border-right: 1px solid var(--border);
	border-bottom: 1px solid var(--border);
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}

.alt-item:nth-child(3n) { border-right: none; }
.alt-item:nth-last-child(-n+3) { border-bottom: none; }

.alt-item__head {
	font-family: var(--font-display);
	font-size: var(--text-base);
	font-weight: 700;
	text-transform: uppercase;
	color: var(--ink);
}

.alt-item p {
	font-size: var(--text-sm);
	color: var(--text-secondary);
	line-height: 1.6;
	flex: 1;
}

.alt-item__tag {
	font-family: var(--font-display);
	font-size: var(--text-xs);
	font-weight: 600;
	letter-spacing: .08em;
	text-transform: uppercase;
	color: var(--acid-dim);
	border-top: 1px solid var(--border);
	padding-top: var(--space-3);
	margin-top: auto;
}

/* ── Pullquote ─── */
.pullquote {
	border-left: 3px solid var(--acid);
	padding: var(--space-4) var(--space-6);
	margin: var(--space-8) 0;
}

.pullquote p {
	font-family: var(--font-display);
	font-size: var(--text-xl);
	font-weight: 600;
	line-height: 1.3;
	color: var(--ink);
	max-width: 55ch;
}

/* ── Sources ─── */
.source-list {
	margin-top: var(--space-8);
	display: flex;
	flex-direction: column;
}

.source-item {
	display: grid;
	grid-template-columns: 120px 1fr;
	gap: var(--space-6);
	padding: var(--space-5) 0;
	border-bottom: 1px solid var(--border);
	align-items: start;
}

.source-item:last-child { border-bottom: none; }

.source-item__type {
	font-family: var(--font-display);
	font-size: var(--text-xs);
	font-weight: 600;
	letter-spacing: .1em;
	text-transform: uppercase;
	color: var(--text-tertiary);
	padding-top: 2px;
}

.source-item__ref {
	font-size: var(--text-sm);
	color: var(--text-primary);
	line-height: 1.55;
	max-width: none;
}

.source-item__note {
	font-size: var(--text-xs);
	color: var(--text-tertiary);
	line-height: 1.55;
	margin-top: var(--space-2);
	max-width: none;
}

.sources-note {
	margin-top: var(--space-8);
	font-size: var(--text-sm);
	color: var(--text-secondary);
	border-top: 1px solid var(--border);
	padding-top: var(--space-6);
}

/* ── Back nav ─── */
.back {
	padding: var(--space-8) 0 var(--space-12);
	display: flex;
	gap: var(--space-8);
	font-family: var(--font-display);
	font-weight: 600;
	font-size: var(--text-sm);
	letter-spacing: .06em;
	text-transform: uppercase;
}

/* ── Responsive ─── */
@media (max-width: 768px) {
	.fact-block { grid-template-columns: 1fr; }
	.fact { border-right: none; }
	.fact:nth-child(2n) { border-right: none; }

	.etable__row {
		grid-template-columns: 1fr;
	}

	.etable__row > div { border-right: none; border-bottom: 1px solid var(--border); }
	.etable__row > div:last-child { border-bottom: none; }

	.alt-grid { grid-template-columns: 1fr; }
	.alt-item { border-right: none; }
	.alt-item:nth-last-child(-n+3) { border-bottom: 1px solid var(--border); }
	.alt-item:last-child { border-bottom: none; }

	.source-item { grid-template-columns: 1fr; gap: var(--space-2); }

	.back { flex-direction: column; gap: var(--space-4); }
}

/* ── Print ─── */
@media print {
	.toc { display: none; }
	.section { page-break-inside: avoid; }
	.fact-block { border: 1pt solid black; }
	.enforcement-table { border: 1pt solid black; }
	.page-title { font-size: 36pt; }
}
</style>
