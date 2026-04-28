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
];

// Claim ID registry — what each claim ID means
export const claimIndex: Record<string, string> = {
	'acreage': 'Total US lawn acreage estimate',
	'irrigated-crop': 'Lawns exceed any single irrigated food crop',
	'water-use': 'Daily water used for lawn/landscape irrigation',
	'water-waste': 'Percentage of irrigation water wasted',
	'pesticide-per-acre': 'Lawn pesticide application rate vs. agriculture',
	'worker-exposure': 'Pesticide exposure of lawn care workers',
	'industry-spend': 'Total annual US lawn/landscape industry spend',
	'hoa-residents': 'Number of Americans living under HOA governance',
	'history': 'Historical origins of the American lawn',
	'olmsted': 'Olmsted and the design of the suburban lawn',
	'buffalo-scholar': 'Buffalo Thoreau scholar weed ordinance case',
	'social-enforcement': 'Social enforcement of lawn conformity',
	'weed-ordinances': 'Prevalence of municipal weed ordinances',
	'chore-preference': 'Homeowner attitudes toward lawn maintenance',
};
