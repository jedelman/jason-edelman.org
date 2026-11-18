/**
 * Abolish Lawns — Bibliography
 *
 * Each entry has:
 *   id:        unique slug
 *   authors:   array of "Last, First" strings
 *   year:      publication year
 *   title:     full title
 *   source:    journal/publisher/outlet
 *   url:       canonical URL (prefer DOI or primary source)
 *   accessed:  date accessed (ISO)
 *   type:      "peer-reviewed" | "government" | "advocacy" | "industry" | "news" | "primary"
 *   claims:    array of claim IDs this reference supports
 *   notes:     caveats, limitations, or methodology notes
 *   status:    "verified" | "needs-update" | "watch" — our confidence in the claim
 */

export interface Reference {
	id: string;
	authors: string[];
	year: number;
	title: string;
	source: string;
	url: string;
	accessed: string;
	type: 'peer-reviewed' | 'government' | 'advocacy' | 'industry' | 'news' | 'primary';
	claims: string[];
	notes?: string;
	status: 'verified' | 'needs-update' | 'watch';
}

export const references: Reference[] = [

	// ── ACREAGE ───────────────────────────────────────────────────────────────

	{
		id: 'milesi-2005',
		authors: ['Milesi, Cristina', 'Running, Steven W.', 'Elvidge, Christopher D.', 'Feddema, Johannes J.', 'Nemani, Ramakrishna R.'],
		year: 2005,
		title: 'Mapping and Modeling the Biogeochemical Cycling of Turf Grasses in the United States',
		source: 'Environmental Management, 36(3): 426–438',
		url: 'https://doi.org/10.1007/s00267-004-0316-2',
		accessed: '2026-04-28',
		type: 'peer-reviewed',
		claims: ['acreage', 'irrigated-crop'],
		notes: 'Satellite-derived estimate: ~163,812 km² (±35,850 km²) = ~40.5 million acres. This is the primary peer-reviewed source for the "larger than any irrigated crop" claim. The estimate is for all turf grass including golf courses, parks, roadsides — not just residential lawns. Total including non-irrigated may be higher.',
		status: 'verified',
	},

	{
		id: 'cdc-turfgrass-2003',
		authors: ['Milesi, Cristina', 'Elvidge, Christopher D.', 'Dietz, James B.', 'Tuttle, Benjamin T.', 'Nemani, Ramakrishna R.', 'Running, Steven W.'],
		year: 2003,
		title: 'A strategy for mapping and modeling the ecological effects of US lawns',
		source: 'Journal of Turfgrass and Sports Surface Science, 81: 10–19',
		url: 'https://legacy.geog.ucsb.edu/the-lawn-is-the-largest-irrigated-crop-in-the-usa/',
		accessed: '2026-04-28',
		type: 'peer-reviewed',
		claims: ['acreage', 'irrigated-crop'],
		notes: 'Earlier version of the Milesi et al. analysis; same research group. UCSB hosted summary confirms "three times larger than any irrigated crop."',
		status: 'verified',
	},

	// ── WATER USE ─────────────────────────────────────────────────────────────

	{
		id: 'epa-watersense-outdoor',
		authors: ['U.S. Environmental Protection Agency'],
		year: 2023,
		title: 'Outdoors — WaterSense',
		source: 'U.S. EPA WaterSense Program',
		url: 'https://www.epa.gov/watersense/outdoors',
		accessed: '2026-04-28',
		type: 'government',
		claims: ['water-use'],
		notes: 'EPA states residential outdoor water use = "nearly 8 billion gallons per day, mainly for landscape irrigation." An earlier EPA WaterSense page cited "nearly 9 billion gallons per day." The current figure is ~8B gpd for all residential outdoor use; lawn irrigation is a subset of this. The manifesto\'s "3 billion gallons" figure appears to be outdated or mis-sourced — the actual EPA figure is substantially higher. NEEDS CORRECTION.',
		status: 'needs-update',
	},

	{
		id: 'epa-watersense-stats',
		authors: ['U.S. Environmental Protection Agency'],
		year: 2024,
		title: 'Statistics and Facts — WaterSense',
		source: 'U.S. EPA WaterSense Program',
		url: 'https://www.epa.gov/watersense/statistics-and-facts',
		accessed: '2026-04-28',
		type: 'government',
		claims: ['water-use', 'water-waste'],
		notes: 'States landscape irrigation accounts for "nearly one-third of all residential water use, totaling nearly 9 billion gallons per day." Also notes up to 50% of irrigation water is wasted due to inefficiency.',
		status: 'verified',
	},

	// ── PESTICIDES ────────────────────────────────────────────────────────────

	{
		id: 'beyond-pesticides-factsheet',
		authors: ['Beyond Pesticides'],
		year: 2005,
		title: 'Lawn Pesticide Facts and Figures',
		source: 'Beyond Pesticides Factsheet',
		url: 'https://www.beyondpesticides.org/assets/media/documents/lawn/factsheets/LAWNFACTS&FIGURES_8_05.pdf',
		accessed: '2026-04-28',
		type: 'advocacy',
		claims: ['pesticide-per-acre'],
		notes: 'States: "Suburban lawns and gardens receive more pesticide applications per acre (3.2–9.8 lbs) than agriculture (2.7 lbs per acre on average)." Primary source cited is a 1991 CRC Press handbook on agricultural pesticide use — a secondary citation through an advocacy organization. The underlying data is from peer-reviewed/government sources but this is not itself peer-reviewed. Use with explicit sourcing. The 90 million pounds/year figure is also cited here.',
		status: 'watch',
	},

	{
		id: 'okstate-residential-pesticides',
		authors: ['Oklahoma State University Extension'],
		year: 2017,
		title: 'Pesticides in Residential Areas — Protecting the Environment',
		source: 'Oklahoma State University Extension Fact Sheet',
		url: 'https://extension.okstate.edu/fact-sheets/pesticides-in-residential-areas-protecting-the-environment.html',
		accessed: '2026-04-28',
		type: 'government',
		claims: ['pesticide-per-acre'],
		notes: 'States: "Some lawns receive 10 or more pesticide applications per season, and two or three times as much nitrogen as a typical field crop." Extension service source — more credible than advocacy org for the per-acre comparison.',
		status: 'verified',
	},

	{
		id: 'foe-jardineros-2021',
		authors: ['Friends of the Earth'],
		year: 2021,
		title: 'The Human Cost of a Perfect Lawn',
		source: 'Friends of the Earth',
		url: 'https://foe.org/blog/human-cost-perfect-lawn/',
		accessed: '2026-04-28',
		type: 'advocacy',
		claims: ['pesticide-per-acre', 'worker-exposure'],
		notes: 'States lawn pesticide use "can be up to 10 times more intensive per acre than farms." Also documents disproportionate exposure of Latinx immigrant lawn care workers. Advocacy source; useful for labor angle.',
		status: 'watch',
	},

	// ── INDUSTRY SIZE / SPEND ─────────────────────────────────────────────────

	{
		id: 'nalp-industry-stats-2025',
		authors: ['National Association of Landscape Professionals'],
		year: 2025,
		title: 'Landscape Industry Statistics',
		source: 'NALP / IBIS World',
		url: 'https://www.landscapeprofessionals.org/LP/LP/Media/landscape-industry-statistics.aspx',
		accessed: '2026-04-28',
		type: 'industry',
		claims: ['industry-spend'],
		notes: 'IBIS World estimates landscaping services market size at $188.8B in 2025. This covers all landscaping services (commercial, residential, design, construction) not just lawn maintenance. The manifesto\'s "$40B" figure is significantly outdated — it appears to originate from early-2000s EPA/Lawn Institute data. The current figure for lawn care services specifically (narrower than total landscaping) is approximately $60-65B. NEEDS CORRECTION in manifesto.',
		status: 'needs-update',
	},

	// ── HOA GOVERNANCE ────────────────────────────────────────────────────────

	{
		id: 'cai-factbook-2025',
		authors: ['Foundation for Community Association Research'],
		year: 2025,
		title: 'Community Association Fact Book 2025',
		source: 'Community Associations Institute',
		url: 'https://foundation.caionline.org/publications/factbook/statistical-review/',
		accessed: '2026-04-28',
		type: 'industry',
		claims: ['hoa-residents'],
		notes: 'Most current figure: 78.1 million residents in community associations (HOAs, condominiums, cooperatives). The manifesto uses 74 million — accurate for 2021-2022 but now understated. Update to 78 million with 2025 citation. Note: this includes condominiums and co-ops, not just HOAs with lawn requirements — lawn enforcement is HOA-specific. HOAs account for ~58-63% of the total, suggesting ~45-49M people specifically in HOA-governed single-family communities.',
		status: 'needs-update',
	},

	{
		id: 'cai-statistical-review-2022',
		authors: ['Foundation for Community Association Research'],
		year: 2022,
		title: '2021-2022 U.S. National and State Statistical Review for Community Association Data',
		source: 'Community Associations Institute',
		url: 'https://www.caionline.org/new-report-highlights-key-statistics-and-trends-for-u-s-community-association-housing-market/',
		accessed: '2026-04-28',
		type: 'industry',
		claims: ['hoa-residents'],
		notes: '74.2 million Americans in community associations as of 2021. 358,000 total associations. Based on American Community Survey and American Housing Survey data.',
		status: 'verified',
	},

	// ── HISTORY / OLMSTED ─────────────────────────────────────────────────────

	{
		id: 'pollan-why-mow-1989',
		authors: ['Pollan, Michael'],
		year: 1989,
		title: 'Why Mow? The Case Against Lawns',
		source: 'New York Times Magazine, May 28, 1989. Reprinted in Second Nature: A Gardener\'s Education (Grove Press, 1991)',
		url: 'https://web.stanford.edu/~jonahw/AOE-SM06/WhyMow.html',
		accessed: '2026-04-28',
		type: 'primary',
		claims: ['history', 'olmsted', 'buffalo-scholar', 'social-enforcement'],
		notes: 'Primary source for the Olmsted history, the Buffalo Thoreau scholar anecdote, and the ideological history of the American lawn. The Buffalo scholar/$25,000 figure comes from this essay — Pollan wrote it in 1989 and describes it as current at that time. Needs independent verification for currency; this is a 35-year-old anecdote. Also source for: Scott\'s "it is unchristian" quote; the Gatsby/Nick lawn anecdote; the characterization of lawn as "sacrament."',
		status: 'watch',
	},

	{
		id: 'scott-1870',
		authors: ['Scott, Frank J.'],
		year: 1870,
		title: 'The Art of Beautifying Suburban Home Grounds of Small Extent',
		source: 'D. Appleton and Company, New York',
		url: 'https://archive.org/details/artofbeautifying00scot',
		accessed: '2026-04-28',
		type: 'primary',
		claims: ['history', 'olmsted'],
		notes: 'Primary historical source. Available via Internet Archive. Olmsted\'s Riverside commission (1868) is the key design precedent; Scott\'s 1870 book popularized Olmsted\'s ideas for the middle class. The "unchristian to hedge" quote from Scott is cited via Pollan — should be verified against the original text.',
		status: 'watch',
	},

	// ── TO-DO: RESEARCH NEEDED ────────────────────────────────────────────────

	{
		id: 'todo-weed-ordinances',
		authors: [],
		year: 2024,
		title: 'PLACEHOLDER: Municipal weed ordinance prevalence — needs primary source',
		source: 'TBD',
		url: '',
		accessed: '',
		type: 'government',
		claims: ['weed-ordinances'],
		notes: 'The manifesto states "hundreds of American municipalities" have weed ordinances. Pollan and others assert this but no single study counts them. Need: a legal database search (Municode, American Legal Publishing) or a law review article surveying ordinance prevalence. This claim is qualitatively defensible but currently unsourced.',
		status: 'needs-update',
	},

	{
		id: 'todo-buffalo-scholar',
		authors: [],
		year: 2024,
		title: 'PLACEHOLDER: Buffalo Thoreau scholar — verification needed',
		source: 'TBD',
		url: '',
		accessed: '',
		type: 'news',
		claims: ['buffalo-scholar', 'weed-ordinances'],
		notes: 'Pollan describes this case in 1989 as ongoing. Need newspaper archive search (Buffalo News) to verify the case existed and the $25,000 figure. The case is plausible and cited by multiple sources (all citing Pollan). If cannot verify from primary sources, should be attributed explicitly to Pollan 1989 rather than stated as fact.',
		status: 'needs-update',
	},

	{
		id: 'todo-lawn-satisfaction',
		authors: [],
		year: 2024,
		title: 'PLACEHOLDER: Survey data on lawn maintenance as chore vs. pleasure',
		source: 'TBD',
		url: '',
		accessed: '',
		type: 'peer-reviewed',
		claims: ['chore-preference'],
		notes: 'The manifesto states "survey after survey finds homeowners describe lawn maintenance as a chore." This is an important claim for the realism objection. Need: a specific citation. Candidates: American Time Use Survey (BLS), National Gardening Association surveys, or academic social science literature on lawn care attitudes.',
		status: 'needs-update',
	},

	// ── ZINE 01 SOURCES: CULTURAL / QUOTES ───────────────────────────────────

	{
		id: 'july-no-one-belongs-2007',
		authors: ['July, Miranda'],
		year: 2007,
		title: 'No One Belongs Here More Than You',
		source: 'Scribner',
		url: 'https://www.simonandschuster.com/books/No-One-Belongs-Here-More-Than-You/Miranda-July/9780743299992',
		accessed: '2026-04-28',
		type: 'primary',
		claims: ['social-enforcement', 'lawn-attitudes'],
		notes: 'Source of quote used in Zine No. 01: "We don\'t really believe in mowing the lawn; we do it only to avoid unnecessary engagement with the neighbors." Captures the social coercion mechanism with literary precision. Fiction, not social science, but illustrative.',
		status: 'verified',
	},

	{
		id: 'hatch-magazine-sisyphus',
		authors: ['Anonymous commenter'],
		year: 2023,
		title: 'Reader comment on lawn maintenance',
		source: 'Hatch Magazine (hatchmag.com)',
		url: 'https://www.hatchmag.com',
		accessed: '2026-04-28',
		type: 'primary',
		claims: ['lawn-attitudes', 'chore-preference'],
		notes: 'Source of quote used in Zine No. 01: "I hate mowing the lawn. Hate it. My body goes on autopilot while my brain tries to figure a way out of ever doing this again. I am Sisyphus." Forum comment; not independently verified as of access date. Used as illustrative testimony of common sentiment.',
		status: 'watch',
	},

	{
		id: 'lawn-forum-spirits',
		authors: ['Anonymous commenter'],
		year: 2023,
		title: 'Thread: Monthly water bill / lawn maintenance attitudes',
		source: 'The Lawn Forum (thelawnforum.com)',
		url: 'https://www.thelawnforum.com',
		accessed: '2026-04-28',
		type: 'primary',
		claims: ['lawn-attitudes', 'social-enforcement'],
		notes: 'Source of quote used in Zine No. 01: "Their spirits were probably broken ten years ago." — referring to neighbors who had stopped maintaining their lawn to standard. Forum comment; robots.txt blocks direct access. Used as illustrative testimony.',
		status: 'watch',
	},

	// ── ZINE 02 SOURCES: WATER BILLS ─────────────────────────────────────────

	{
		id: 'bluefield-water-rates-2024',
		authors: ['Bluefield Research'],
		year: 2024,
		title: 'US Municipal Water and Wastewater Rates Survey',
		source: 'Bluefield Research',
		url: 'https://www.bluefieldresearch.com',
		accessed: '2026-04-28',
		type: 'industry',
		claims: ['water-bill-rates', 'water-affordability'],
		notes: 'Source for the claim that US water and sewer rates rose approximately 24% over five years (2019–2024), faster than general inflation. Bluefield Research is a market research firm specializing in water industry analysis. Their rate surveys are widely cited in municipal water utility reporting and policy contexts. The 24% figure is for combined water + sewer rates nationally; individual markets vary significantly.',
		status: 'verified',
	},

	{
		id: 'aroundtheyard-water-bill',
		authors: ['Anonymous commenter'],
		year: 2023,
		title: 'Thread: Summer water bills from lawn irrigation',
		source: 'Around the Yard Forum (aroundtheyard.com)',
		url: 'https://www.aroundtheyard.com',
		accessed: '2026-04-28',
		type: 'primary',
		claims: ['water-bill-quotes', 'water-bill-rates'],
		notes: 'Source of quote used in Zine No. 02: "My bill just came in. I knew it was going to be astronomical. $765.44 for the quarter — about $255 a month. That\'s $56.70 per month per thousand square feet of lawn." — homeowner in New Jersey. Forum comment; used as illustrative real-world testimony of household water bill impact. Not independently verified.',
		status: 'watch',
	},

	{
		id: 'lawnforum-sewer-irrigation',
		authors: ['Anonymous commenter'],
		year: 2023,
		title: 'Thread: Sewer charges on irrigation water',
		source: 'The Lawn Forum (thelawnforum.com)',
		url: 'https://www.thelawnforum.com',
		accessed: '2026-04-28',
		type: 'primary',
		claims: ['water-bill-quotes', 'water-sewer-charge'],
		notes: 'Source of quote used in Zine No. 02: "Mine is $175–$200 during the growing season. It wouldn\'t be more than $75 but the sewer formula uses total gallons — so I\'m paying sewer prices on irrigation water." Illustrates the structural mechanism of sewer billing based on total water consumption. The underlying mechanism (billing sewer on all water withdrawn, including irrigation that doesn\'t enter the drain system) is confirmed by utility billing practice documentation.',
		status: 'watch',
	},

	{
		id: 'bogleheads-lawn-removal',
		authors: ['Anonymous commenter'],
		year: 2022,
		title: 'Thread: Water savings from lawn removal',
		source: 'Bogleheads.org personal finance forum',
		url: 'https://www.bogleheads.org',
		accessed: '2026-04-28',
		type: 'primary',
		claims: ['water-bill-quotes', 'lawn-conversion'],
		notes: 'Source of quote used in Zine No. 02: "We eliminated our lawn. Summer water usage is literally 10–15% of what it was. The combined rebates paid for half the cost to change." — California homeowner. Used as real-world evidence of water savings from lawn removal. Consistent with EPA and academic literature on outdoor water use reduction from native plant conversion.',
		status: 'watch',
	},

	{
		id: 'epa-watersense-sewer',
		authors: ['U.S. Environmental Protection Agency'],
		year: 2024,
		title: 'Sewer billing and outdoor water use',
		source: 'U.S. EPA WaterSense Program',
		url: 'https://www.epa.gov/watersense',
		accessed: '2026-04-28',
		type: 'government',
		claims: ['water-sewer-charge', 'water-waste'],
		notes: 'Many utilities bill sewer fees based on total water consumption including outdoor irrigation. WaterSense materials acknowledge this creates a disincentive for outdoor water efficiency since customers pay sewer rates on water that never enters the sewer system. Some utilities offer irrigation meters or seasonal sewer rate adjustments to address this.',
		status: 'verified',
	},

	// ── ZINE 03 SOURCES: DATA CENTERS VS LAWNS ───────────────────────────────

	{
		id: 'shehabi-lbl-2024',
		authors: ['Shehabi, Arman', 'Smith, Sarah J.', 'Hubbard, Jonathan', 'Newkirk, Joanie', 'Lei, Norman', 'Wehner, Michael F.', 'Masanet, Eric', 'Koomey, Jonathan', 'Nordman, Bruce'],
		year: 2024,
		title: 'United States Data Center Energy Usage Report',
		source: 'Lawrence Berkeley National Laboratory, LBNL-2001643',
		url: 'https://eta.lbl.gov/publications/united-states-data-center-energy',
		accessed: '2026-04-28',
		type: 'government',
		claims: ['data-center-water', 'data-center-energy'],
		notes: 'The primary peer-reviewed government source for US data center water consumption. Estimates 17 billion gallons direct water consumption in 2023, and 211 billion gallons indirect (through electricity generation). Projects doubling or quadrupling by 2028. This is the source for the 170x ratio claim (2.9 trillion lawn gallons ÷ 17 billion data center gallons). The indirect figure is more contested — see construction-physics.com for methodology critique.',
		status: 'verified',
	},

	{
		id: 'most-policy-datacenter-water',
		authors: ['MOST Policy Initiative'],
		year: 2025,
		title: 'Data Center Water Use — Science Note',
		source: 'MOST Policy Initiative',
		url: 'https://mostpolicyinitiative.org/science-note/data-center-water-use/',
		accessed: '2026-04-28',
		type: 'government',
		claims: ['data-center-water'],
		notes: 'Synthesizes Lawrence Berkeley Lab and EPA data. Confirms 17.4 billion gallons direct consumption in 2023 (EPA 2025 / Shehabi et al. 2024). Projects 38–73 billion gallons by 2028. Clear methodology explanation of direct vs. indirect water consumption distinction. Most recent comprehensive policy synthesis available.',
		status: 'verified',
	},

	{
		id: 'eesi-datacenter-water',
		authors: ['Environmental and Energy Study Institute'],
		year: 2024,
		title: 'Data Centers and Water Consumption',
		source: 'EESI Article',
		url: 'https://www.eesi.org/articles/view/data-centers-and-water-consumption',
		accessed: '2026-04-28',
		type: 'advocacy',
		claims: ['data-center-water', 'data-center-local'],
		notes: 'Comprehensive overview including local impact data. Key figures: Northern Virginia data centers consumed ~2 billion gallons in 2023 (63% increase from 2019); single large data centers can consume up to 5 million gallons/day. States 449 million gallons/day for all US data centers (2021 estimate, older than LBL 2024). Also notes: "each 100-word AI prompt is estimated to use roughly one bottle of water (519 mL)" — University of California Riverside estimate.',
		status: 'verified',
	},

	{
		id: 'lincoln-institute-data-lawns',
		authors: ['Lincoln Institute of Land Policy'],
		year: 2026,
		title: 'Data Drain: The Land and Water Impacts of the AI Boom',
		source: 'Lincoln Institute of Land Policy — Land Lines Magazine',
		url: 'https://www.lincolninst.edu/publications/land-lines-magazine/articles/land-water-impacts-data-centers/',
		accessed: '2026-04-28',
		type: 'advocacy',
		claims: ['data-center-water', 'lawn-water-annual', 'data-center-local'],
		notes: 'Explicitly addresses the lawns-vs-data-centers comparison. States: "Americans use more water each year to irrigate golf courses (more than 500 billion gallons) and lawns (over 2 trillion gallons) than AI data centers use." Quotes water experts saying "the solution lies in water conservation and consumer education, not comparing one wasteful use to another." Also documents Newton County, GA: Meta data center uses 500,000 gallons/day = 10% of entire county\'s consumption. Source of quote used in Zine No. 03.',
		status: 'verified',
	},

	{
		id: 'undark-datacenter-water-2025',
		authors: ['Undark Magazine'],
		year: 2025,
		title: 'How Much Water Do AI Data Centers Really Use?',
		source: 'Undark Magazine',
		url: 'https://undark.org/2025/12/16/ai-data-centers-water/',
		accessed: '2026-04-28',
		type: 'news',
		claims: ['data-center-water', 'data-center-local'],
		notes: 'Good contextualizing piece on the data center water debate. Compares data centers to golf courses: Google\'s global footprint equals ~43 golf courses. Notes Arizona has 370+ golf courses and expanding data center presence. Useful for the "consistent framework" argument — the same commons critique applies to both.',
		status: 'verified',
	},

	{
		id: 'heathscott-water-comparison-2026',
		authors: ['Heath Scott, Joshua'],
		year: 2026,
		title: 'You Don\'t Actually Care About the Water',
		source: 'Substack (joshuaheathscott.substack.com)',
		url: 'https://joshuaheathscott.substack.com/p/you-dont-actually-care-about-the',
		accessed: '2026-04-28',
		type: 'news',
		claims: ['lawn-water-annual', 'data-center-water'],
		notes: 'Source of the key comparison figures used in Zine No. 03: "US lawn irrigation sucks down about 2.9 trillion gallons a year. Eleven times more than global AI. For grass." The 2.9 trillion gallons figure for US lawn irrigation is consistent with EPA and academic sources (9B gallons/day × 365 ≈ 3.3T gallons; the 2.9T figure may use a seasonal estimate). The "11× global AI" ratio uses global AI data center consumption vs US lawns — a different comparison than the 170× ratio (US lawns vs US data centers direct only). Both are valid depending on scope. Substack; not peer-reviewed, but the underlying data is sourced.',
		status: 'watch',
	},

	{
		id: 'brookings-datacenter-water-2025',
		authors: ['Brookings Institution'],
		year: 2025,
		title: 'AI, Data Centers, and Water',
		source: 'Brookings Institution',
		url: 'https://www.brookings.edu/articles/ai-data-centers-and-water/',
		accessed: '2026-04-28',
		type: 'advocacy',
		claims: ['data-center-water', 'data-center-local'],
		notes: 'Brookings overview of data center water policy. Key figure: typical data center uses 300,000 gallons/day (1,000 household equivalent); large ones up to 5 million gallons/day (50,000 people equivalent). Projections show cooling water use may increase by 870% as facilities expand. Useful for policy framing of data center water governance.',
		status: 'verified',
	},

	{
		id: 'uiuc-datacenter-water',
		authors: ['University of Illinois Urbana-Champaign, Dept. of Civil & Environmental Engineering'],
		year: 2024,
		title: 'AI\'s Challenging Waters',
		source: 'CEE Illinois',
		url: 'https://cee.illinois.edu/news/AIs-Challenging-Waters',
		accessed: '2026-04-28',
		type: 'government',
		claims: ['data-center-water', 'data-center-energy'],
		notes: 'Academic overview from UIUC CEE. Useful per-user context: Google hyperscale data centers average ~550,000 gallons/day; smaller data centers average ~18,000 gallons/day. Notes that 20% of US data centers draw from moderately to highly stressed watersheds. Data centers rank in top 10 water-consuming commercial industries in the US.',
		status: 'verified',
	},

	{
		id: 'construction-physics-datacenter-water-2025',
		authors: ['Potter, Brian'],
		year: 2025,
		title: 'I Was Wrong About Data Center Water Consumption',
		source: 'Construction Physics (Substack)',
		url: 'https://www.construction-physics.com/p/i-was-wrong-about-data-center-water',
		accessed: '2026-04-28',
		type: 'news',
		claims: ['data-center-water'],
		notes: 'Important methodology correction piece. Notes that the Lawrence Berkeley Lab "211 billion gallons indirect" figure is consumptive use (water lost to evaporation from power generation), not total withdrawal — a distinction that significantly changes the comparison. Also notes hyperscalers (Amazon, Google, Meta, Microsoft) report 100% renewable electricity via PPAs, which affects the indirect water calculation. Use when citing indirect water figures — the methodology is more contested than the direct cooling figure.',
		status: 'verified',
	},
];

// Claim ID registry — what each claim ID means
export const claimIndex: Record<string, string> = {
	// Lawn ecology and scale
	'acreage':           'Total US lawn acreage estimate',
	'irrigated-crop':    'Lawns exceed any single irrigated food crop',
	'water-use':         'Daily water used for lawn/landscape irrigation',
	'water-waste':       'Percentage of irrigation water wasted',
	'lawn-water-annual': 'Annual US lawn water consumption total',
	'pesticide-per-acre':'Lawn pesticide application rate vs. agriculture',
	'worker-exposure':   'Pesticide exposure of lawn care workers',
	'industry-spend':    'Total annual US lawn/landscape industry spend',
	// Enforcement and governance
	'hoa-residents':     'Number of Americans living under HOA governance',
	'weed-ordinances':   'Prevalence of municipal weed ordinances',
	'buffalo-scholar':   'Buffalo Thoreau scholar weed ordinance case',
	'social-enforcement':'Social enforcement of lawn conformity',
	'lawn-conversion':   'Water savings and outcomes from lawn removal',
	// Attitudes and culture
	'lawn-attitudes':    'Documented attitudes toward lawn maintenance',
	'chore-preference':  'Homeowner attitudes: lawn as chore not pleasure',
	// History
	'history':           'Historical origins of the American lawn',
	'olmsted':           'Olmsted and the design of the suburban lawn',
	// Water bills
	'water-bill-rates':  'Rate of increase in US water and sewer bills',
	'water-affordability':'Water affordability for low-income households',
	'water-bill-quotes': 'Real homeowner testimony on water bill impact',
	'water-sewer-charge':'Sewer billing on irrigation water that never enters drains',
	// Data centers
	'data-center-water': 'US/global data center water consumption',
	'data-center-energy':'Data center energy consumption',
	'data-center-local': 'Local/community impact of data center water use',
};
