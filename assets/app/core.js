// PeptideGenius core runtime
// ===== extracted core runtime script =====
/* ════════════════════════════════════════════════════════════════════════════
   PEPTIDEGENIUS — MAIN APP SCRIPT
   ════════════════════════════════════════════════════════════════════════════

   TABLE OF CONTENTS  (search for "SECTION:" to jump)

     SECTION: Seed Data & Catalogs                 ~line 1777
     SECTION: Utility Helpers                      ~line 2007
     SECTION: Dose & Schedule Helpers              ~line 2110
     SECTION: Persistence (IndexedDB + I/E)        ~line 2154
     SECTION: UI Banners & DOM Helpers             ~line 2433
     SECTION: Calendar & Action Popup              ~line 2542
     SECTION: Stats, Stack & Dose Intervals        ~line 2721
     SECTION: Shot Log & Site Rotation             ~line 2889
     SECTION: Inventory                            ~line 3344
     SECTION: Price Comparison                     ~line 3607
     SECTION: Calculator, Titration & Protocols    ~line 3852
     SECTION: init()                               ~line 4562
     SECTION: Package Tracking                     ~line 4705
     SECTION: Price Importer Subsystem             ~line 5815
       └─ Nested inside init() — see banner for extraction notes

   The Price Importer subsystem (bottom ~1100 lines) is the clearest candidate
   if this file is ever split. It lives entirely inside init()'s scope, so its
   function names don't leak globally, and it talks to the rest of the app
   only through save() and renderPrices(). See its banner for full details.
   ════════════════════════════════════════════════════════════════════════════ */

/* ============================================================
   SECTION: Seed Data & Catalogs
   Default peptide palette, AM/PM stack defaults, peptide catalog,
   vendor lists, owner price data, day labels, state defaults.
   ============================================================ */
const PEP_PALETTE=[
  {bg:'#93C5FD',text:'#1E3A8A',border:'#2563EB'},  /* 0  Blue (richer)     */
  {bg:'#86EFAC',text:'#14532D',border:'#16A34A'},  /* 1  Emerald (richer)  */
  {bg:'#FDE68A',text:'#78350F',border:'#D97706'},  /* 2  Amber (richer)    */
  {bg:'#FDBA74',text:'#7C2D12',border:'#EA580C'},  /* 3  Orange (richer)   */
  {bg:'#FCA5A5',text:'#7F1D1D',border:'#DC2626'},  /* 4  Red (richer)      */
  {bg:'#67E8F9',text:'#164E63',border:'#0891B2'},  /* 5  Cyan (richer)     */
  {bg:'#C4B5FD',text:'#4C1D95',border:'#7C3AED'},  /* 6  Violet (richer)   */
  {bg:'#F9A8D4',text:'#831843',border:'#DB2777'},  /* 7  Pink/Rose (richer)*/
  {bg:'#CBD5E1',text:'#334155',border:'#64748B'},  /* 8  Slate (richer)    */
  {bg:'#5EEAD4',text:'#134E4A',border:'#0D9488'},  /* 9  Teal (richer)     */
  {bg:'#BEF264',text:'#365314',border:'#65A30D'},  /* 10 Lime (richer)     */
  {bg:'#A5B4FC',text:'#312E81',border:'#4F46E5'}   /* 11 Indigo (richer)   */
];
const AM_ST_DEF=[{n:'BPC-157',s:['BPC-157 250mcg','BPC-157 250mcg','BPC-157 250mcg','BPC-157 250mcg','BPC-157 250mcg','BPC-157 250mcg','BPC-157 250mcg']},{n:'Ipamorelin',s:['Ipamorelin 300mcg','','Ipamorelin 300mcg','','Ipamorelin 300mcg','','']}];
const PM_ST_DEF=[{n:'TB-500',s:['TB-500 2mg','','','TB-500 2mg','','','']},{n:'GHK-Cu',s:['GHK-Cu 2mg','GHK-Cu 2mg','GHK-Cu 2mg','GHK-Cu 2mg','GHK-Cu 2mg','GHK-Cu 2mg','GHK-Cu 2mg']}];
// ═══════════════════════════════════════════════════════════════════════════════
// PEPTIDE NORMALIZATION CATALOG
// ═══════════════════════════════════════════════════════════════════════════════
// Maps vendor-specific names and SKU codes to a canonical form so the same peptide
// from different vendors lines up in the same price-comparison row.
//
// Each entry: [canonical name, [name aliases], [SKU prefixes], category]
//   • canonical name — the standard form we display (e.g., "Retatrutide")
//   • name aliases   — matched when the raw name is exactly one of these OR starts
//                       with one followed by a digit ("Reta20" → Retatrutide)
//   • SKU prefixes   — matched when the SKU starts with one followed by a digit
//                       ("RT20" → Retatrutide; "IPA10" → Ipamorelin)
//   • category       — grouping hint (not used for matching yet, available for UI)
//
// Scoring prefers longer prefix matches so "IPA" wins over "IP" for "IPA10", etc.
// After a match, the returned form is "Canonical Name + dose" (e.g., "Retatrutide 20mg")
// so that size variants become their own rows instead of all colliding on one key.
const PEPTIDE_CATALOG=[
  // GLP-1s and weight-loss
  ['Retatrutide',     ['reta','retatrut','retatrudide'],                 ['rt'],                     'GLP-1'],
  ['Tirzepatide',     ['tirz','tirze','trize','trizepatide'],            ['tr','tirz'],              'GLP-1'],
  ['Semaglutide',     ['sema','semaglu'],                                ['sm'],                     'GLP-1'],
  ['Cagrilintide',    ['cagri','cagril','cagrilint'],                    ['cgl'],                    'GLP-1'],
  ['Mazdutide',       ['mazdu','mazdut'],                                ['maz','mdt'],              'GLP-1'],
  ['Survodutide',     ['survo','survod'],                                ['sur'],                    'GLP-1'],
  ['AOD9604',         ['aod','aod9604'],                                 ['aod'],                    'WeightLoss'],
  ['5-amino-1MQ',     ['5amino','amino1mq','5aminomq','5amino1mq'],      ['am','5am'],               'WeightLoss'],
  ['Adipotide',       ['adipo','fttp'],                                  ['ap'],                     'WeightLoss'],
  ['Tesofensine',     ['teso','tesofens'],                               [],                         'WeightLoss'],
  ['L-carnitine',     ['lcarn','lcarnitine','carnitine'],                ['lc'],                     'WeightLoss'],
  // Growth / GHS
  ['Ipamorelin',      ['ipa','ipam'],                                    ['ipa','ip'],               'GHS'],
  ['CJC-1295',        ['cjc','cjc1295','cjcnodac','cjcnondac'],          ['cnd','cjc'],              'GHS'],
  ['CJC-1295 DAC',    ['cjcdac','cjcwithdac'],                           ['cd'],                     'GHS'],
  ['Tesamorelin',     ['tesa','tesamor'],                                ['tsm'],                    'GHS'],
  ['Sermorelin',      ['serm','sermo','sermorel'],                       ['smo','sml'],              'GHS'],
  ['HGH',             ['hgh','somatropin'],                              [],                         'GHS'],
  ['HGH Fragment',    ['hghfrag','fragment','hghfragment176'],           ['fr'],                     'GHS'],
  ['MOTS-c',          ['mots','motsc'],                                  ['ms'],                     'GHS'],
  ['IGF-1 LR3',       ['igf','igf1','igf1lr3','igflr3'],                 ['if','igf'],               'GHS'],
  ['MK-677',          ['mk677','ibutamoren'],                            ['mk'],                     'GHS'],
  ['Hexarelin',       ['hex','hexarel'],                                 ['hx'],                     'GHS'],
  ['GHRP-2',          ['ghrp2'],                                         ['g2','g25','g210'],        'GHS'],
  ['GHRP-6',          ['ghrp6'],                                         ['g6','g65','g610'],        'GHS'],
  ['PEG MGF',         ['pegmgf','mgf'],                                  ['fmp'],                    'GHS'],
  // Healing / recovery
  ['BPC-157',         ['bpc','bpc157'],                                  ['bpc','bc','bcs'],         'Healing'],
  ['TB-500',          ['tb500','tb4','thymosinbeta4'],                   ['tb'],                     'Healing'],
  ['KPV',             ['kpv'],                                           ['kpv','kps','kp'],         'Healing'],
  ['LL-37',           ['ll37'],                                          ['ll','ll37'],              'Healing'],
  ['PNC-27',          ['pnc27','pnc'],                                   ['pnc'],                    'Healing'],
  // Beauty / skin
  ['GHK-Cu',          ['ghk','ghkcu'],                                   ['ghk','cu'],               'Beauty'],
  ['AHK-Cu',          ['ahk','ahkcu'],                                   ['ahk'],                    'Beauty'],
  ['Matrixyl',        ['matrixyl'],                                      ['mx'],                     'Beauty'],
  ['Snap-8',          ['snap','snap8','snap-8'],                         ['np'],                     'Beauty'],
  // Neuro / cognitive
  ['Selank',          ['sel','selank'],                                  ['sk'],                     'Neuro'],
  ['Semax',           ['semax'],                                         ['xa'],                     'Neuro'],
  ['Cerebrolysin',    ['cere','cerebrolysin','cerebro'],                 ['cbl'],                    'Neuro'],
  ['PE-22-28',        ['pe22','pe2228'],                                 ['pe'],                     'Neuro'],
  ['DSIP',            ['dsip','disp'],                                   ['ds'],                     'Neuro'],
  ['Epithalon',       ['epi','epithalon','epitalon'],                    ['et'],                     'Neuro'],
  ['Pinealon',        ['pin','pineal','pinealon'],                       ['pin'],                    'Neuro'],
  ['Cortagen',        ['cort','cortagen'],                               ['cort'],                   'Neuro'],
  // Hormones / sexual
  ['HCG',             ['hcg'],                                           ['g2k','g5k','g10k','gsk','gk'], 'Hormone'],
  ['HMG',             ['hmg'],                                           ['g75'],                    'Hormone'],
  ['Oxytocin',        ['oxytocin','oxy'],                                ['ot'],                     'Hormone'],
  ['PT-141',          ['pt141','bremelanotide'],                         ['p41','pt'],               'Sexual'],
  ['Kisspeptin-10',   ['kiss','kisspeptin'],                             ['ks'],                     'Hormone'],
  ['Teriparatide',    ['teripara','terip'],                              ['ter'],                    'Hormone'],
  // Immune / anti-ox
  ['Thymosin Alpha-1',['thymosin','ta1','thymalpha','thymosinalpha'],    ['ta','tas'],               'Immune'],
  ['Thymalin',        ['thymalin'],                                      ['ty'],                     'Immune'],
  ['VIP',             ['vip'],                                           ['vp'],                     'Immune'],
  ['Glutathione',     ['glut','glutathione','gsh'],                      ['gtt','gt'],               'AntiOx'],
  // Longevity / metabolic
  ['NAD+',            ['nad','nadh','nadplus'],                          ['nad','nj'],               'Longevity'],
  ['SS-31',           ['ss31','elamipretide'],                           ['2s'],                     'Longevity'],
  ['Humanin',         ['humanin'],                                       ['hu'],                     'Longevity'],
  ['AICAR',           ['aicar'],                                         ['ar'],                     'Metabolic'],
  // Pigment / muscle / misc
  ['Melanotan I',     ['mt1','melanotan1','melanotani'],                 ['mt1'],                    'Pigment'],
  ['Melanotan II',    ['mt2','melanotan2','melanotanii'],                ['mt2','ml'],               'Pigment'],
  ['ACE-031',         ['ace031','ace'],                                  ['ae'],                     'Muscle'],
  ['GDF-8',           ['gdf8','myostatin'],                              ['f81','gdf'],              'Muscle'],
  ['Dermorphin',      ['dermo','dermorphin'],                            ['dp'],                     'Pain'],
  ['ARA-290',         ['ara','ara290','cibinetide'],                     ['ra','ara'],               'Neuro'],
  // Khavinson (bioregulators)
  ['Vesugen',         ['vesugen'],                                       ['ve','vg'],                'Vascular'],
  ['Cardiogen',       ['cardiogen'],                                     ['card','ca'],              'Cardiac'],
  ['Livagen',         ['livagen'],                                       ['li'],                     'Liver'],
  ['Pancragen',       ['pancragen'],                                     ['pa'],                     'Pancreas'],
  ['Prostamax',       ['prostamax'],                                     ['max'],                    'Prostate'],
  ['Cartalax',        ['cartalax','cartaiax'],                           ['cart','lax'],             'Cartilage'],
  ['Chonluten',       ['chonluten'],                                     ['ch'],                     'Lung'],
  ['Crystagen',       ['crystagen'],                                     ['cry'],                    'Immune'],
  ['Ovagen',          ['ovagen'],                                        ['ov'],                     'Liver'],
  ['Vilon',           ['vilon'],                                         ['vi'],                     'Immune'],
  ['Testagen',        ['testagen'],                                      ['tg'],                     'Endocrine'],
  ['Adamax',          ['adamax'],                                        ['ada','adas'],             'Cognitive'],
  ['Vesugen',         ['vesugen'],                                       ['ve','vg'],                'Vascular'],
  // Other
  ['EPO',             ['epo','erythropoietin'],                          ['esk'],                    'Blood'],
  ['Botulinum Toxin', ['botox','botulinum','botulinumtoxin'],            ['xt'],                     'Toxin'],
  ['BAC Water',       ['bacwater','sterilewater','sterilewaterforinjection','bacstatic'], ['ba','pb'],'Solvent'],
  ['Acetic Acid',     ['aceticacid','acetic'],                           ['aa'],                     'Solvent']
];
function _normPepStr(s){return(s||'').toLowerCase().replace(/[\s\-_.,+]/g,'');}
// Return canonical form (+dose if provided) or null if no match in the catalog.
function normalizePeptideName(rawName,sku,dose){
  const inName=_normPepStr(rawName);
  const inSku=_normPepStr(sku);
  if(!inName&&!inSku)return null;
  let bestEntry=null,bestScore=0;
  const bid=(e,s)=>{if(s>bestScore){bestEntry=e;bestScore=s;}};
  for(const entry of PEPTIDE_CATALOG){
    const canon=_normPepStr(entry[0]);
    const aliases=entry[1]||[];
    const prefixes=entry[2]||[];
    // 1. Exact canonical name match (e.g. "Retatrutide")
    if(inName&&inName===canon)bid(entry,100+canon.length);
    // 2. Exact alias match (e.g. "Reta")
    for(const a of aliases){const na=_normPepStr(a);if(inName&&inName===na)bid(entry,95+na.length);}
    // 3. Name starts with canonical followed by a digit (e.g. "Retatrutide20")
    if(inName&&canon.length>=3&&inName.startsWith(canon)&&/^\d/.test(inName.slice(canon.length)))bid(entry,80+canon.length);
    // 4. Name starts with alias followed by a digit (e.g. "Reta20")
    for(const a of aliases){const na=_normPepStr(a);if(inName&&na.length>=3&&inName.startsWith(na)&&/^\d/.test(inName.slice(na.length)))bid(entry,70+na.length);}
    // 5. SKU starts with prefix followed by digit (e.g. SKU "RT20" → prefix "rt")
    if(inSku)for(const p of prefixes){const np=_normPepStr(p);if(np.length>=1&&inSku.startsWith(np)&&/^\d/.test(inSku.slice(np.length)))bid(entry,60+np.length);}
    // 6. SKU exactly equals a prefix (e.g. SKU "KPV")
    if(inSku)for(const p of prefixes){const np=_normPepStr(p);if(np.length>=2&&inSku===np)bid(entry,55+np.length);}
  }
  if(!bestEntry)return null;
  return dose?bestEntry[0]+' '+dose:bestEntry[0];
}
// Extract a "size-qualified" dose from a freeform peptide name (e.g. "Retatrutide 20mg" → "20mg").
function extractDoseFromName(s){
  const m=(s||'').match(/(\d+(?:\.\d+)?)\s*(mg|mcg|μg|ug|ml|iu|units)\b/i);
  if(!m)return'';
  let u=m[2].toLowerCase();if(u==='μg'||u==='ug')u='mcg';
  return m[1]+u;
}

// Default demo vendor list for the price table (built-in example data)
const VENDORS_DEF=['Vendor A','Vendor B','Vendor C','Vendor D'];
const PRICE_DATA_DEF={
  'BPC-157':{'Vendor A':45,'Vendor B':52,'Vendor C':40,'Vendor D':50},
  'TB-500':{'Vendor A':80,'Vendor B':75,'Vendor C':85,'Vendor D':70},
  'Ipamorelin':{'Vendor A':55,'Vendor B':60,'Vendor C':50,'Vendor D':58},
  'GHK-Cu':{'Vendor A':35,'Vendor B':40,'Vendor D':38},
  'CJC-1295':{'Vendor A':70,'Vendor C':65,'Vendor D':72},
  'Sermorelin':{'Vendor B':45,'Vendor C':48}
};
// Personal vendor list for extended price-import mode (injected once when that mode is on)
const OWNER_VENDORS=['JEEP','ERP US','ERP CHN','MKM','KR','WBS','WKC','PPHK','XL','BOC','SSY','XTP','HKMS US','HKMS CN','BCX FURONG','QST','CHP'];
const OWNER_PRICES={
  'RT20':{JEEP:208,'ERP US':159,'ERP CHN':145,MKM:120,KR:150,WKC:160,PPHK:180,XL:188,BOC:133,SSY:130,XTP:200,'HKMS CN':180,'BCX FURONG':160,QST:190,CHP:150},
  'RT30':{JEEP:270,'ERP US':199,'ERP CHN':189,MKM:174,KR:162,WBS:190,WKC:180,PPHK:180,XL:209,BOC:148,SSY:170,XTP:230,'HKMS CN':230,'BCX FURONG':170,QST:220,CHP:200},
  'TSM10':{JEEP:158,'ERP US':145,'ERP CHN':159,MKM:195,WBS:130,WKC:200,PPHK:200,XL:158,BOC:180,SSY:185,XTP:180,'HKMS CN':180,'BCX FURONG':150,QST:160,CHP:150},
  'TSM20':{WBS:265,PPHK:310},
  'CP 10':{'ERP US':90,'ERP CHN':79,MKM:100,KR:105,WBS:105,WKC:110,PPHK:110,XL:140,BOC:104,SSY:95,XTP:100,'HKMS CN':95,'BCX FURONG':110,QST:135},
  'CP 20':{'ERP US':165,WBS:180,XTP:200,'BCX FURONG':210},
  'KLOW80':{JEEP:200,'ERP US':199,KR:180,WBS:200,WKC:180,PPHK:180,XL:180,SSY:160,'BCX FURONG':190,QST:190,CHP:180},
  'IPA10':{'ERP US':65,MKM:75,KR:65,WBS:75,PPHK:65,XL:65,BOC:63,SSY:80,XTP:80,'HKMS CN':65,'BCX FURONG':80,QST:76,CHP:70},
  'IPA20':{XTP:100},
  'AOD9604 05':{'ERP CHN':100},
  'AOD9604 10':{PPHK:140},
  'Slu pp 332':{JEEP:65,'ERP CHN':99,MKM:90,BOC:104,SSY:100,'HKMS CN':100,'BCX FURONG':80,QST:95},
  'NJ1000':{'ERP US':129,MKM:160,KR:75,PPHK:96,BOC:99,'HKMS CN':160,'BCX FURONG':110},
  'TC250':{'HKMS CN':17}
};
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DEF=[
  // --- Active stack peptides (appear in daily stack / weekly calendar) ---
  {id:1,name:'BPC-157',fz:1,fr:0,dk:0,nd:0,cn:'',us:'',dose:250,doseUnit:'mcg',days:[]},
  {id:2,name:'TB-500',fz:1,fr:0,dk:0,nd:0,cn:'',us:'',dose:2,doseUnit:'mg',days:[]},
  {id:3,name:'Ipamorelin',fz:1,fr:0,dk:0,nd:0,cn:'',us:'',dose:300,doseUnit:'mcg',days:[]},
  {id:4,name:'GHK-Cu',fz:1,fr:0,dk:0,nd:0,cn:'',us:'',dose:2,doseUnit:'mg',days:[]},
  // --- Other example inventory ---
  {id:5,name:'CJC-1295',fz:0,fr:0,dk:0,nd:1,cn:'',us:'',dose:0,days:[]},
  {id:6,name:'Sermorelin',fz:0,fr:0,dk:0,nd:0,cn:'',us:'',dose:0,days:[]},
  {id:7,name:'SQ Pins',fz:0,fr:0,dk:25,nd:0,cn:'',us:'',dose:0,days:[]}
];
const CC=['#2563EB','#059669','#D97706','#EA580C','#DC2626','#0891B2','#7C3AED','#DB2777','#64748B'];
const PEPTIDE_REF=[
  // Existing 16 entries — augmented with goodWith / notGoodWith / tags.
  // Half-lives unchanged unless cheatsheet provided a better number.
  {n:'Ipamorelin',hl:2,cat:'GH Secretagogue',catC:'#185FA5',startD:100,targetD:300,unit:'mcg',incrAmt:50,incrWks:2,freq:'5×/week',timing:'Bedtime, fasted',cycleOn:12,cycleOff:4,use:'GH release, body composition, sleep quality',tags:['Sleep','Muscles','Weight Loss','Immune system','Longevity'],goodWith:['CJC-1295 (no DAC)','CJC-1295 (DAC)','Ibutamoren (MK-677)','Tesamorelin'],notGoodWith:[]},
  {n:'CJC-1295 (no DAC)',hl:0.5,cat:'GH Secretagogue',catC:'#185FA5',startD:100,targetD:200,unit:'mcg',incrAmt:50,incrWks:2,freq:'5×/week',timing:'Bedtime, fasted',cycleOn:12,cycleOff:4,use:'Short-acting GHRH; pair with Ipamorelin for nightly GH pulse. ~30 min half-life means more frequent injections.',tags:['Muscles','Bones','Cognitive function','Energy','Healing','Immune system','Longevity','Sleep'],goodWith:['Ibutamoren (MK-677)','Ipamorelin'],notGoodWith:['Sermorelin','Tesamorelin','CJC-1295 (DAC)']},
  {n:'CJC-1295 (DAC)',hl:168,cat:'GH Secretagogue',catC:'#185FA5',startD:1000,targetD:2000,unit:'mcg',incrAmt:0,incrWks:0,freq:'Once weekly',timing:'Any time',cycleOn:12,cycleOff:4,use:'Long-acting (6–8 day half-life) GHRH; weekly dosing. Brand: Modified GRF.',tags:['Muscles','Bones','Cognitive function','Energy','Healing','Immune system','Longevity','Sleep'],goodWith:['Ibutamoren (MK-677)','Ipamorelin'],notGoodWith:['Sermorelin','Tesamorelin','CJC-1295 (no DAC)']},
  {n:'Tesamorelin',hl:0.5,cat:'GH Secretagogue',catC:'#185FA5',startD:1000,targetD:2000,unit:'mcg',incrAmt:500,incrWks:4,freq:'Daily',timing:'Bedtime, fasted',cycleOn:8,cycleOff:4,use:'GHRH analog; FDA-approved for HIV lipodystrophy. Stronger GH effect than CJC-1295. Brand: EGRIFTA.',tags:['Weight Loss','Bones','Muscles','Focus','Sleep'],goodWith:['Ipamorelin'],notGoodWith:['CJC-1295 (no DAC)','CJC-1295 (DAC)']},
  {n:'Sermorelin',hl:0.1,cat:'GH Secretagogue',catC:'#185FA5',startD:200,targetD:500,unit:'mcg',incrAmt:100,incrWks:2,freq:'Daily',timing:'Bedtime, fasted',cycleOn:12,cycleOff:4,use:'Older GHRH analog (GRF 1-29). Short half-life (~6 min). Less common than CJC-1295.',tags:['Longevity','Weight Loss','Muscles','Cognitive function'],goodWith:['Ibutamoren (MK-677)'],notGoodWith:['CJC-1295 (DAC)','CJC-1295 (no DAC)','Tesamorelin']},
  {n:'Retatrutide',hl:144,cat:'GLP-1/GIP/Glucagon',catC:'#059669',startD:1,targetD:8,unit:'mg',incrAmt:1,incrWks:4,freq:'Once weekly',timing:'Any time',cycleOn:24,cycleOff:8,use:'Triple-agonist (GLP-1/GIP/glucagon); strongest weight-loss peptide as of 2024.',tags:['Weight Loss','Energy','Muscles'],goodWith:['AOD-9604'],notGoodWith:[]},
  {n:'Tirzepatide',hl:120,cat:'GLP-1/GIP',catC:'#059669',startD:2.5,targetD:15,unit:'mg',incrAmt:2.5,incrWks:4,freq:'Once weekly',timing:'Any time',cycleOn:24,cycleOff:8,use:'GLP-1/GIP dual agonist. FDA-approved (Mounjaro/Zepbound). Stronger than semaglutide for weight loss.',tags:['Weight Loss','Energy'],goodWith:['AOD-9604'],notGoodWith:[]},
  {n:'Semaglutide',hl:168,cat:'GLP-1',catC:'#059669',startD:0.25,targetD:2.4,unit:'mg',incrAmt:0.25,incrWks:4,freq:'Once weekly',timing:'Any time',cycleOn:24,cycleOff:8,use:'GLP-1 agonist. FDA-approved (Ozempic/Wegovy). Standard care for weight loss + T2D.',tags:['Weight Loss','Energy'],goodWith:['AOD-9604'],notGoodWith:[]},
  {n:'BPC-157',hl:4,cat:'Healing',catC:'#D97706',startD:250,targetD:500,unit:'mcg',incrAmt:0,incrWks:0,freq:'Daily',timing:'Morning or near injury site',cycleOn:8,cycleOff:2,use:'Body Protective Compound. Tendons, ligaments, gut healing, inflammation. Can affect mood with SSRI.',tags:['Healing','Immune system','Pain','Focus','Bones'],goodWith:['GHK-Cu','TB-500','Thymosin Beta-4'],notGoodWith:[]},
  {n:'TB-500',hl:36,cat:'Healing',catC:'#D97706',startD:2.5,targetD:2.5,unit:'mg',incrAmt:0,incrWks:0,freq:'2×/week (Mon+Thu)',timing:'Post-workout',cycleOn:6,cycleOff:2,use:'Active region of Thymosin Beta-4. Systemic tissue repair, inflammation. Half-life 1–2 days (corrected from 2.5h).',tags:['Healing','Longevity'],goodWith:['BPC-157','Thymosin Alpha-1'],notGoodWith:[]},
  {n:'GHK-Cu',hl:0.5,cat:'Healing / Anti-aging',catC:'#D97706',startD:1,targetD:2,unit:'mg',incrAmt:0.5,incrWks:4,freq:'Daily',timing:'Evening',cycleOn:6,cycleOff:4,use:'Copper peptide. Collagen, wound healing, skin, hair. Repeat cycles 3-4×/year. Take Zinc supplement to balance.',tags:['Longevity','Immune system'],goodWith:['BPC-157','Snap-8'],notGoodWith:[]},
  {n:'DSIP',hl:0.13,cat:'Sleep',catC:'#7C3AED',startD:100,targetD:300,unit:'mcg',incrAmt:100,incrWks:2,freq:'5×/week',timing:'30 min before sleep',cycleOn:8,cycleOff:4,use:'Delta Sleep-Inducing Peptide. Sleep architecture, cortisol, stress reduction.',tags:['Sleep'],goodWith:[],notGoodWith:[]},
  {n:'AOD-9604',hl:0.07,cat:'Fat Loss',catC:'#EA580C',startD:250,targetD:500,unit:'mcg',incrAmt:125,incrWks:2,freq:'Daily',timing:'Morning, fasted',cycleOn:3,cycleOff:1,use:'Modified Frag 176-191. Targeted fat loss without GH side effects. ~4 min half-life.',tags:['Weight Loss','Healing'],goodWith:['Tirzepatide','Semaglutide','Retatrutide'],notGoodWith:['Frag 176-191']},
  {n:'Epitalon',hl:0.5,cat:'Longevity',catC:'#DB2777',startD:5,targetD:10,unit:'mg',incrAmt:0,incrWks:0,freq:'Daily × 10 days per cycle',timing:'Evening',cycleOn:0.4,cycleOff:24,use:'Telomere extension, melatonin, anti-aging. Often stacked with Thymalin. Aliases: Epithalon, Epithalamin (less concentrated — 100mcg Epithalamin = 10mg Epitalon).',tags:['Longevity'],goodWith:['Thymalin (Thymogen)'],notGoodWith:[]},
  {n:'Klotho',hl:8,cat:'Longevity',catC:'#DB2777',startD:10,targetD:25,unit:'mcg',incrAmt:5,incrWks:4,freq:'2×/week',timing:'Any time',cycleOn:12,cycleOff:8,use:'Aging, cognition, kidney health.',tags:['Longevity','Cognitive function'],goodWith:[],notGoodWith:[]},
  {n:'KPV',hl:1.5,cat:'Anti-inflammatory',catC:'#0891B2',startD:500,targetD:1000,unit:'mcg',incrAmt:0,incrWks:0,freq:'Daily',timing:'Evening',cycleOn:8,cycleOff:4,use:'IBD, gut inflammation, immune modulation, skin (psoriasis, eczema).',tags:['Healing','Skin'],goodWith:[],notGoodWith:[]},
  {n:'Thymosin Alpha-1',hl:2,cat:'Immune',catC:'#0891B2',startD:900,targetD:1800,unit:'mcg',incrAmt:0,incrWks:0,freq:'2×/week',timing:'Any time',cycleOn:8,cycleOff:4,use:'FDA-approved. Immune support, viral defense, autoimmune. Used for chronic fatigue, Lyme, autoimmune.',tags:['Immune system'],goodWith:['Thymosin Beta-4','TB-500'],notGoodWith:[]},

  // ── New entries from cheatsheet (v23) ──────────────────────────────────────
  {n:'5-amino-1MQ',hl:6,cat:'Weight Loss',catC:'#EA580C',startD:50,targetD:150,unit:'mg',incrAmt:0,incrWks:0,freq:'Daily',timing:'Morning with food (Jay Campbell)',cycleOn:3,cycleOff:0,use:'Body recomposition (muscle preservation while losing fat). Lowers cholesterol. 20–30 days on, 1–2 weeks off.',tags:['Muscles','Weight Loss','Immune system'],goodWith:['NAD+'],notGoodWith:[]},
  {n:'ARA-290',hl:1,cat:'Healing',catC:'#D97706',startD:1,targetD:5,unit:'mg',incrAmt:0,incrWks:0,freq:'Daily',timing:'Any time',cycleOn:1,cycleOff:0,use:'Tissue repair, neuropathic pain, diabetes, immune function. Soluble in alkaline solutions; may appear cloudy with BAC water.',tags:['Healing','Immune system','Cognitive function'],goodWith:[],notGoodWith:[]},
  {n:'Argireline',hl:0,cat:'Skin',catC:'#EC4899',startD:0,targetD:0,unit:'mg',incrAmt:0,incrWks:0,freq:'Topical',timing:'Topical',cycleOn:0,cycleOff:0,use:'Topical anti-wrinkle peptide ("oral Botox"). Used in serums.',tags:['Skin'],goodWith:['Snap-8'],notGoodWith:[]},
  {n:'Dihexa',hl:0,cat:'Cognitive',catC:'#7C3AED',startD:8,targetD:45,unit:'mg',incrAmt:0,incrWks:0,freq:'Daily',timing:'Topical or oral',cycleOn:1,cycleOff:0,use:'Cognitive enhancement, Parkinson’s, Alzheimer’s, stroke recovery, hearing protection. Most users take topically (rub on inner forearms).',tags:['Longevity','Cognitive function'],goodWith:['Cerebrolysin','Selank','Semax'],notGoodWith:[]},
  {n:'Frag 176-191',hl:0,cat:'Fat Loss',catC:'#EA580C',startD:500,targetD:500,unit:'mcg',incrAmt:0,incrWks:0,freq:'Daily',timing:'First thing morning, fasted',cycleOn:1,cycleOff:0,use:'HGH Fragment. Modified 176-191 amino acids of HGH (related to AOD-9604). "Real Frag is always cloudy" per cheatsheet.',tags:['Weight Loss','Bones','Sleep'],goodWith:['MOTS-C'],notGoodWith:['AOD-9604']},
  {n:'Humanin',hl:0.5,cat:'Mitochondrial / Longevity',catC:'#DB2777',startD:1,targetD:1,unit:'mg',incrAmt:0,incrWks:0,freq:'Daily',timing:'Any time',cycleOn:1,cycleOff:0,use:'Mitochondrial protection. Used for osteoporosis, cardiovascular, diabetes, neurodegenerative. Modified version "Humanin G" (HN-G) is more concentrated.',tags:['Longevity','Immune system','Cognitive function','Mitochondrial'],goodWith:['MOTS-C','SS-31'],notGoodWith:[]},
  {n:'Ibutamoren (MK-677)',hl:24,cat:'GH Secretagogue',catC:'#185FA5',startD:12.5,targetD:25,unit:'mg',incrAmt:0,incrWks:0,freq:'Daily',timing:'Bedtime, empty stomach (oral)',cycleOn:1,cycleOff:1,use:'Oral ghrelin agonist. Increases lean muscle, IGF-1. Causes hunger — better to eat protein. Females 12.5mg, males 25mg.',tags:['Energy','Muscles','Sleep'],goodWith:['Sermorelin','CJC-1295 (no DAC)','CJC-1295 (DAC)','Ipamorelin'],notGoodWith:[]},
  {n:'LL-37',hl:0.1,cat:'Immune',catC:'#0891B2',startD:50,targetD:100,unit:'mcg',incrAmt:0,incrWks:0,freq:'Daily',timing:'Any time',cycleOn:1,cycleOff:0,use:'Immune booster, infection fighter, wound healing. CAUTION with dose — even lower if needed (Reddit). Can cause autoimmune issues at high doses.',tags:['Immune system','Healing','Bones'],goodWith:[],notGoodWith:[]},
  {n:'Matrixyl',hl:0,cat:'Skin',catC:'#EC4899',startD:0,targetD:0,unit:'mg',incrAmt:0,incrWks:0,freq:'Topical',timing:'Topical (3% concentration optimal)',cycleOn:0,cycleOff:0,use:'Topical anti-aging peptide. Used in creams/serums (2–8% concentration).',tags:['Skin'],goodWith:['Palmitoyl Tetrapeptide 7','Snap-8'],notGoodWith:[]},
  {n:'Melanotan 1',hl:0,cat:'Skin / Cognitive',catC:'#EC4899',startD:100,targetD:200,unit:'mcg',incrAmt:0,incrWks:0,freq:'Daily',timing:'Any time',cycleOn:8,cycleOff:0,use:'Skin pigmentation, light-related skin disorders. 200mcg daily 6–8 weeks immunity protocol; 200mcg once a week for tanning.',tags:['Cognitive function','Immune system'],goodWith:[],notGoodWith:[]},
  {n:'MOTS-C',hl:0,cat:'Mitochondrial',catC:'#DB2777',startD:5,targetD:10,unit:'mg',incrAmt:0,incrWks:0,freq:'3×/week or 1×/week',timing:'Any time',cycleOn:1,cycleOff:0,use:'Mitochondrial peptide. Decreases liver fat, cardiovascular health, life expectancy. Cycle after SS-31.',tags:['Mitochondrial','Energy','Weight Loss','Longevity'],goodWith:['Frag 176-292','Humanin','SS-31','Tesofensine'],notGoodWith:[]},
  {n:'NAD+',hl:0,cat:'Longevity',catC:'#DB2777',startD:25,targetD:100,unit:'mg',incrAmt:0,incrWks:0,freq:'2-3×/week',timing:'Any time',cycleOn:1,cycleOff:0,use:'Anti-aging, energy, cognitive. Mix with 3ml BAC. Ramp slowly. NOT for heart disease, kidney disease, liver disease, or blood thinners.',tags:['Longevity','Immune system','Cognitive function','Weight Loss','Muscles'],goodWith:['5-amino-1MQ'],notGoodWith:[]},
  {n:'PE 22-28',hl:0,cat:'Mood',catC:'#7C3AED',startD:400,targetD:400,unit:'mcg',incrAmt:0,incrWks:0,freq:'Daily',timing:'Morning (intranasal)',cycleOn:1,cycleOff:0,use:'Antidepressant-like effect (intranasal).',tags:['Mood'],goodWith:[],notGoodWith:[]},
  {n:'Selank',hl:0.1,cat:'Cognitive',catC:'#7C3AED',startD:100,targetD:1000,unit:'mcg',incrAmt:0,incrWks:0,freq:'Daily',timing:'Morning (intranasal or SQ)',cycleOn:1,cycleOff:0,use:'Anti-anxiety, cognitive enhancement, immune boost. Used for GAD treatment, alcohol withdrawal.',tags:['Cognitive function','Immune system'],goodWith:['Dihexa','Semax'],notGoodWith:[]},
  {n:'Semax',hl:0.1,cat:'Cognitive',catC:'#7C3AED',startD:100,targetD:1000,unit:'mcg',incrAmt:0,incrWks:0,freq:'Daily',timing:'Morning (intranasal or SQ)',cycleOn:1,cycleOff:0,use:'Nootropic. Brain health, memory, attention, learning. Reduces stroke risk.',tags:['Cognitive function','Mood'],goodWith:['Dihexa','Selank'],notGoodWith:[]},
  {n:'Snap-8',hl:0,cat:'Skin',catC:'#EC4899',startD:0,targetD:0,unit:'mg',incrAmt:0,incrWks:0,freq:'Topical',timing:'Topical (1-2× daily)',cycleOn:0,cycleOff:0,use:'Topical anti-aging. Reduce wrinkles, improve elasticity. Reconstitute 10mg with 1ml BAC, add to 30ml serum.',tags:['Skin'],goodWith:['HA','Matrixyl','GHK-Cu','Ceramides','Vitamin E','Vitamin B','Argireline'],notGoodWith:['High pH','AHA','Vitamin A']},
  {n:'SS-31',hl:0,cat:'Mitochondrial',catC:'#DB2777',startD:4,targetD:4,unit:'mg',incrAmt:0,incrWks:0,freq:'Daily for 10–20 days',timing:'Any time (SQ)',cycleOn:1,cycleOff:1,use:'Elamipretide. Mitochondrial healing. Repair cells, macular degeneration, kidney/lung. Cycle with MOTS-C and Humanin.',tags:['Mitochondrial','Healing','Focus','Longevity'],goodWith:['Humanin','MOTS-C','Tesofensine'],notGoodWith:[]},
  {n:'Tesofensine',hl:200,cat:'Weight Loss',catC:'#EA580C',startD:0.5,targetD:0.5,unit:'mg',incrAmt:0,incrWks:0,freq:'Daily',timing:'Early morning (oral)',cycleOn:3,cycleOff:1,use:'Appetite suppressant. Decreases triglycerides, BMR boost. Some use w/ Tirzepatide/Semaglutide/Retatrutide as bridge.',tags:['Focus','Weight Loss','Energy'],goodWith:['MOTS-C','SS-31'],notGoodWith:[]},
  {n:'Thymalin (Thymogen)',hl:0,cat:'Immune',catC:'#0891B2',startD:5,targetD:20,unit:'mg',incrAmt:0,incrWks:0,freq:'Daily',timing:'Any time',cycleOn:0.3,cycleOff:0,use:'Immune disorders, anti-aging, anti-tumor. Often stacked with Epitalon. Take 30mg zinc 30 min before. Thymalin = extract of Thymogen (10mg Thymalin = 100mcg Thymogen).',tags:['Longevity','Immune system'],goodWith:['Epitalon (Epithalon, Epithalamin)'],notGoodWith:[]},
  {n:'Thymosin Beta-4',hl:36,cat:'Healing',catC:'#D97706',startD:2.5,targetD:5,unit:'mg',incrAmt:0,incrWks:0,freq:'2×/week',timing:'Any time',cycleOn:6,cycleOff:2,use:'Full Thymosin Beta-4 peptide (TB-500 is its active region). Wound healing, tissue repair, immune support. Used in HIV/AIDS/influenza trials.',tags:['Immune system','Healing','Cognitive function'],goodWith:['Thymosin Alpha-1','BPC-157'],notGoodWith:[]},
  // ── Added 20260708 (GH secretagogues, GLP/metabolic, repair, misc) ──
  {n:'GHRP-6',hl:0.3,cat:'GH Secretagogue',catC:'#185FA5',startD:100,targetD:300,unit:'mcg',incrAmt:0,incrWks:0,freq:'1-3x/day',timing:'Empty stomach / bedtime',cycleOn:12,cycleOff:4,use:'GH secretagogue + ghrelin agonist; strong hunger stimulation. Commonly paired with a GHRH like CJC-1295 for a synergistic GH pulse.',tags:['Muscles','Sleep','Healing'],goodWith:['CJC-1295 (no DAC)','Ipamorelin'],notGoodWith:[]},
  {n:'GHRP-2',hl:0.3,cat:'GH Secretagogue',catC:'#185FA5',startD:100,targetD:300,unit:'mcg',incrAmt:0,incrWks:0,freq:'1-3x/day',timing:'Empty stomach / bedtime',cycleOn:12,cycleOff:4,use:'GH secretagogue; stronger GH release than GHRP-6 with less hunger. Mild prolactin/cortisol rise at high doses.',tags:['Muscles','Sleep'],goodWith:['CJC-1295 (no DAC)','Ipamorelin'],notGoodWith:[]},
  {n:'Hexarelin',hl:1,cat:'GH Secretagogue',catC:'#185FA5',startD:100,targetD:200,unit:'mcg',incrAmt:0,incrWks:0,freq:'1-2x/day',timing:'Empty stomach',cycleOn:4,cycleOff:4,use:'Potent GH secretagogue with the strongest acute GH spike but fastest desensitization - keep cycles short. Cardioprotective research interest.',tags:['Muscles','Healing'],goodWith:[],notGoodWith:[]},
  {n:'Teduglutide',hl:2,cat:'GLP-2',catC:'#059669',startD:0.05,targetD:0.05,unit:'mg',incrAmt:0,incrWks:0,freq:'Daily',timing:'Any time (clinically ~0.05 mg/kg)',cycleOn:0,cycleOff:0,use:'GLP-2 analog; FDA-approved (Gattex) for short bowel syndrome. Trophic to intestinal mucosa; researched for gut healing. Clinical dose is weight-based.',tags:['Healing','Immune system'],goodWith:['BPC-157'],notGoodWith:[]},
  {n:'TB4-FRAG',hl:0.5,cat:'Healing',catC:'#D97706',startD:500,targetD:750,unit:'mcg',incrAmt:0,incrWks:0,freq:'Daily',timing:'Post-workout / near injury',cycleOn:6,cycleOff:2,use:'Active fragment of Thymosin Beta-4 (TB-500 is the acetylated full peptide). Angiogenesis, actin regulation, tissue repair.',tags:['Healing'],goodWith:['BPC-157'],notGoodWith:[]},
  {n:'Cagrilintide',hl:168,cat:'GLP-1/Amylin',catC:'#059669',startD:0.3,targetD:2.4,unit:'mg',incrAmt:0.3,incrWks:4,freq:'Once weekly',timing:'Any time',cycleOn:24,cycleOff:8,use:'Long-acting amylin analog for appetite/satiety. Often paired with semaglutide (the "CagriSema" combination).',tags:['Weight Loss'],goodWith:['Semaglutide'],notGoodWith:[]},
  {n:'PT-141',hl:2,cat:'Sexual',catC:'#DB2777',startD:0.5,targetD:2,unit:'mg',incrAmt:0,incrWks:0,freq:'As needed',timing:'~45 min before activity',cycleOn:0,cycleOff:0,use:'Bremelanotide; melanocortin agonist for libido/arousal in both sexes. FDA-approved (Vyleesi). Nausea and transient blood-pressure rise are common.',tags:['Mood'],goodWith:[],notGoodWith:[]},
  {n:'Kisspeptin-10',hl:0.1,cat:'Hormone',catC:'#185FA5',startD:50,targetD:100,unit:'mcg',incrAmt:0,incrWks:0,freq:'As protocol',timing:'Any time',cycleOn:0,cycleOff:0,use:'Upstream of GnRH; stimulates LH/FSH and thus endogenous testosterone/estradiol. Researched for HPG-axis support and fertility.',tags:['Longevity'],goodWith:[],notGoodWith:[]},
  {n:'Melanotan II',hl:1,cat:'Pigment',catC:'#EA580C',startD:250,targetD:500,unit:'mcg',incrAmt:0,incrWks:0,freq:'Daily (load) then weekly',timing:'Evening',cycleOn:0,cycleOff:0,use:'Melanocortin agonist; tanning, appetite suppression, libido. Nausea and darkening of moles/freckles - monitor skin. Distinct from Melanotan 1.',tags:['Skin'],goodWith:[],notGoodWith:[]},
];

// --- PER-CELL SCHEDULE KEY ---
// Each calendar cell is fully independent: 'pepName/time/dayIndex'
const sk=(n,t,di)=>n+'/'+t+'/'+di;
const MEAL_LANE_TO_TIME={breakfast:'am',lunch:'am',dinner:'pm',bedtime:'pm'};
const TIME_MEAL_LANES={am:['breakfast','lunch'],pm:['dinner','bedtime']};
function tmpAllowCalSched(name){
  try{if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()&&name)tmpCalClearGuard.allowName(name);}catch(_){}
}
function schedTimeForKey(t){
  const lane=String(t||'').toLowerCase();
  return MEAL_LANE_TO_TIME[lane]||t;
}
function schedCellActive(name,time,di){
  const keys=schedKeysForCell(name,time,di);
  return keys.some(k=>S.sched&&S.sched[k]&&(S.sched[k]===true||typeof S.sched[k]==='object'));
}
function schedKeysForCell(name,time,di){
  const keys=[sk(name,time,di)];
  for(const meal of (TIME_MEAL_LANES[time]||[])) keys.push(sk(name,meal,di));
  return keys;
}
function pfMealLaneFromForm(){
  const sel=g('pf-stk');
  const fromDataset=sel&&sel.dataset.gptMealLane;
  if(fromDataset&&MEAL_LANE_TO_TIME[fromDataset]) return fromDataset;
  const v=String(gv('pf-stk')||'').toLowerCase();
  if(MEAL_LANE_TO_TIME[v]) return v;
  return null;
}
function piaStackToSides(stk){
  stk=String(stk||'').toLowerCase();
  if(stk==='breakfast'||stk==='lunch'||stk==='am') return {am:true,pm:false};
  if(stk==='dinner'||stk==='pm') return {pm:true,am:false};
  if(stk==='bedtime'||stk==='both') return {am:true,pm:true};
  return {am:stk==='am',pm:stk==='pm'};
}

/* ============================================================
   SECTION: Utility Helpers
   HTML escaping, debug flag, canonical supplies, peptide color
   assignment, and the top-level state object S.
   ============================================================ */

// HTML escape helper — hoisted to top level so every render function can reach it.
// Previously duplicated inside init() and two render functions as local `escHtml`.
// Use this on ANY user-controlled string before interpolating into innerHTML.
function escH(s){return(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
// Convenience for attribute values inside double-quoted attrs (same output, intent-signalling name)
const escA=escH;

// Debug flag — leaves diagnostic console.log calls silent in normal use to keep support
// screenshots clean and avoid leaking peptide name lists into shared logs.
// Enable from DevTools: localStorage.setItem('tmp_debug','1');  disable: .removeItem('tmp_debug')
// Or pass ?debug=1 in the URL once.
const TMP_DEBUG=(function(){
  try{
    const params=new URLSearchParams(location.search||'');
    if(params.get('debug')==='1'){localStorage.setItem('tmp_debug','1');}
    return localStorage.getItem('tmp_debug')==='1';
  }catch(e){return false;}
})();
function dbg(){if(TMP_DEBUG&&typeof console!=='undefined'&&console.log){console.log.apply(console,arguments);}}

// Canonical supply rows — single source of truth, shared by load() and import().
// Each row auto-decrements when shots are logged (see lg-btn handler).
const CANONICAL_SUPPLIES=[
  {name:'SQ syringes',   supplyKind:'sq'},
  {name:'IM syringes',   supplyKind:'im'},
  {name:'BAC water',     supplyKind:'bac'},
  {name:'Alcohol pads',  supplyKind:'pad'}
];
// Ensure every canonical supply row exists on S.inv. Idempotent — safe to call
// on every load. IDs use S.nI++ to avoid Date.now() collisions.
function seedSupplies(){
  if(!Array.isArray(S.inv))S.inv=[];
  if(typeof S.nI!=='number'||S.nI<31)S.nI=31;
  CANONICAL_SUPPLIES.forEach(spec=>{
    const have=S.inv.some(i=>i.isSupply&&(i.supplyKind===spec.supplyKind||i.name===spec.name));
    if(!have){
      S.inv.push({id:S.nI++,name:spec.name,isSupply:true,isPeptide:false,supplyKind:spec.supplyKind,fz:0,fr:0,dk:0,nd:0,days:[]});
    }
  });
}

// Explicit color assignments for common peptides to guarantee no collisions in
// the default stack (e.g., Tesamorelin/Retatrutide both hash to purple otherwise).
const PEP_COLOR_MAP={
  'BPC-157':0,      // Blue
  'TB-500':1,       // Emerald
  'Ipamorelin':2,   // Amber
  'GHK-Cu':3,       // Orange
  'Tirzepatide':4,  // Red
  'CJC-1295':5,     // Cyan
  'Sermorelin':6,   // Violet
  'Tesamorelin':7,  // Pink
  'AOD-9604':8,     // Slate
  'Retatrutide':9,  // Teal  (distinct from Tesa)
  'Cagrilintide':10,// Lime
  'MK-677':11,      // Indigo
  'Semaglutide':3,  // Orange
  'DSIP':6,         // Violet
  'Kisspeptin-10':7,// Pink
  'Klotho':9,       // Teal
  'Epithalon':10    // Lime
};
const PREFIX_COLOR={};  // 2-letter prefix → palette index (unused; kept for API stability)
function pepPrefix(n){return n.slice(0,2).toLowerCase();}
function rebuildCM(){
  Object.keys(PEP_COLOR_MAP).forEach(k=>delete PEP_COLOR_MAP[k]);
  Object.keys(PREFIX_COLOR).forEach(k=>delete PREFIX_COLOR[k]);
  let ci=0;
  function assign(name){
    const p=pepPrefix(name);
    if(!(p in PREFIX_COLOR))PREFIX_COLOR[p]=ci++%PEP_PALETTE.length;
    PEP_COLOR_MAP[name]=PREFIX_COLOR[p];
  }
  const seen=new Set();
  // Default stack order first (stable color assignment for Cyp, Klo, etc.)
  [...AM_ST_DEF,...PM_ST_DEF].forEach(r=>{if(!seen.has(r.n)){seen.add(r.n);assign(r.n);}});
  // Inventory order
  S.inv.forEach(i=>{if(!seen.has(i.name)){seen.add(i.name);assign(i.name);}});
  // Sched-only
  Object.keys(S.sched).forEach(k=>{const n=k.split('/')[0];if(!seen.has(n)){seen.add(n);assign(n);}});
}
function pepColor(n){
  // Manual override stored on inv item takes priority
  const inv=S.inv.find(i=>i.name===n);
  if(inv&&typeof inv.colorOverride==='number'&&inv.colorOverride>=0) return PEP_PALETTE[inv.colorOverride%PEP_PALETTE.length];
  if(n in PEP_COLOR_MAP)return PEP_PALETTE[PEP_COLOR_MAP[n]];
  // Fallback: FNV-like hash over the whole name for better spread across 12 hues
  // than a 2-letter prefix (which would collide Sermorelin/Semaglutide etc.)
  let h=2166136261;
  for(let i=0;i<n.length;i++){h^=n.charCodeAt(i);h=Math.imul(h,16777619);}
  return PEP_PALETTE[(h>>>0)%PEP_PALETTE.length];
}

// --- STATE ---
// vials[]: per-physical-vial inventory rows (added Q2 2026). Each row represents
// ONE vial — sealed in freezer, reconstituted in fridge, or sitting on a desk —
// with its own vendor/batch/remaining-mcg trail. Doses logged against a peptide
// auto-deduct from the active fridge vial (see pickFridgeVial). The legacy
// fz/fr/dk counts on inv items are kept in sync via recomputeStockFromVials so
// existing renderInv code keeps working without rewrite.
// nV is the per-vial id counter (parallel to nI for inv, nS for shots).
let S={shots:[],inv:JSON.parse(JSON.stringify(DEF)),sched:{},wkOff:0,nI:31,nS:1,nV:1,vials:[],vendors:[...VENDORS_DEF],prices:JSON.parse(JSON.stringify(PRICE_DATA_DEF)),vits:[],vitsLog:[],rx:[],rxLog:[],vitals:[],vitalsUnit:'imperial',nVit:1};
// v0.27.19: expose S on window so that other scripts (pt-pool-js IIFE,
// shot-stat helpers, dashboard etc.) can use `window.S` checks. ES6
// `let` at script top-level does NOT auto-attach to window.
if (window.TMPStateBridge && typeof window.TMPStateBridge.ensureStore === 'function') {
  window.TMPStateBridge.ensureStore(S);
} else {
  window.S = S; // fallback only if bridge script missing or failed to load
}
let CUR=null,pepEId=null,saveTimer=null,swapId=null,delConfirmId=null,stackHighlight=null;
// PWA install-prompt event, stashed here so the install-banner and init()
// can both reach it. Populated by the beforeinstallprompt handler (Chrome /
// Edge / Android browsers fire this; iOS Safari does not — see applyInstallBanner).
let _pwaPrompt=null;

/* ============================================================
   SECTION: Dose & Schedule Helpers
   Dose formatting (mcg→mg auto-convert), schedule display text,
   day counting, row packing by AM/PM.
   ============================================================ */

// Auto-convert 4-digit mcg (≥1000) to mg for display
function fmtDose(dose,unit){
  if(!dose||dose<=0)return null;
  unit=unit||'mcg';
  const fmt=v=>String(v).replace(/^0\./,'.');
  // Pills render as "1×" / "2×" — no unit suffix, × is multiplier shorthand for "count"
  if(unit==='pill'){
    return fmt(dose===Math.floor(dose)?dose:parseFloat(dose.toFixed(2)))+'×';
  }
  if(unit==='mcg'&&dose>=1000){
    const mg=dose/1000;
    return fmt(mg===Math.floor(mg)?mg:parseFloat(mg.toFixed(3)))+' mg';
  }
  return fmt(dose)+unit;
}
// vialMg is always stored in milligrams for math; vialMgDisplayUnit is optional UI preference ('mg'|'g').
function fmtVialMgSuffix(vialMg,vialMgDisplayUnit){
  if(!vialMg||vialMg<=0)return null;
  const u=vialMgDisplayUnit||'mg';
  if(u==='g'){
    const gg=vialMg/1000;
    const s=(gg===Math.floor(gg))?String(gg):String(parseFloat(gg.toFixed(4)));
    return s+'g';
  }
  const m=vialMg===Math.floor(vialMg)?String(vialMg):String(parseFloat(vialMg.toFixed(3)));
  return m+'mg';
}
function schedDisplayTxt(n){const inv=S.inv.find(i=>i.name===n);const dose=inv?inv.dose:0;const unit=inv?(inv.doseUnit||'mcg'):'mcg';const d=fmtDose(dose,unit);return d?n+' '+d:n;}
function countSchedDays(name){return[0,1,2,3,4,5,6].filter(di=>S.sched[sk(name,'am',di)]||S.sched[sk(name,'pm',di)]).length;}
function schedRows(time){
  // Order follows S.inv for collection, then sorted by this time slot's day count
  // v7: archived peptides are hidden from the calendar grid.
  const names=[],seen=new Set();
  // Track names of archived peptides so the orphan-recovery branch below
  // also skips them (otherwise an archived peptide's lingering S.sched keys
  // would resurrect it as an orphan row).
  const _archived = new Set((S.inv||[]).filter(i=>i.archived).map(i=>i.name));
  // Only active inventory peptides may appear on Daily Stack / calendar rows.
  // Orphan S.sched keys (deleted peptides, old defaults) must not resurrect rows.
  const _inInv = new Set((S.inv||[]).filter(i=>i && i.name && !i.isSupply && !i.archived).map(i=>i.name));
  // v0.27.70: peptides with interval > 0 are scheduled by interval, not
  // by day-of-week. They render via intervalOverlaysForWeek instead.
  const _intervalManaged = new Set((S.inv||[]).filter(i=>i && !i.isSupply && (i.interval>0)).map(i=>i.name));
  S.inv.forEach(i=>{
    if(i.archived) return;
    if(_intervalManaged.has(i.name)) return;
    if(!seen.has(i.name)&&[0,1,2,3,4,5,6].some(di=>S.sched[sk(i.name,time,di)])){
      seen.add(i.name);names.push(i.name);
    }
  });
  Object.keys(S.sched).forEach(k=>{
    const[n,t]=k.split('/');
    if(t!==time||seen.has(n)||_archived.has(n)||_intervalManaged.has(n)) return;
    if(!_inInv.has(n)) return;
    if(!S.sched[k]) return;
    seen.add(n);names.push(n);
  });
  // Sort: fewest days in THIS time slot first, then latest occupied day descending (clusters same-day peptides), then alphabetical
  return names.sort((a,b)=>{
    const ca=[0,1,2,3,4,5,6].filter(di=>S.sched[sk(a,time,di)]).length;
    const cb=[0,1,2,3,4,5,6].filter(di=>S.sched[sk(b,time,di)]).length;
    if(ca!==cb)return ca-cb;
    const la=Math.max(-1,...[0,1,2,3,4,5,6].filter(di=>S.sched[sk(a,time,di)]));
    const lb=Math.max(-1,...[0,1,2,3,4,5,6].filter(di=>S.sched[sk(b,time,di)]).length>0?[0,1,2,3,4,5,6].filter(di=>S.sched[sk(b,time,di)]):[-1]);
    if(la!==lb)return lb-la;
    return a.localeCompare(b);
  });
}

// v0.27.63: returns the YYYY-MM-DD date a peptide's interval clock says
// it's next due, based on the most recent shot. Returns null if the
// peptide has no interval set or no shots logged yet.
function intervalDueDateFor(name){
  const it = (S.inv||[]).find(i => i && !i.isSupply && i.name === name);
  if(!it || !(it.interval > 0)) return null;
  const shots = (S.shots||[]).filter(s => s && s.peptide === name);
  if(!shots.length) return null;
  shots.sort((a,b) => (b.date||'').localeCompare(a.date||''));
  const last = new Date(shots[0].date + 'T12:00:00');
  if(isNaN(last.getTime())) return null;
  const target = new Date(last);
  target.setDate(target.getDate() + it.interval);
  return fmD(target);
}

// Returns interval-tracked peptide names whose next-due date falls
// inside the given week (array of Date) and which don't already have a
// sched entry on that exact column. Used by renderCal to inject a row
// for peptides that are interval-due THIS week but live on a different
// day in S.sched.
function intervalOverlaysForWeek(weekDates, time){
  // v0.27.70: walk every interval-due date in the visible week, anchored on
  // the most recent shot OR cycleStart when no shots are logged yet.
  const out = []; // {name, di}
  const seen = new Set();
  if(time !== 'am') return out; // interval doses always placed on AM rail
  if(!weekDates || !weekDates.length) return out;
  const wsIso = fmD(weekDates[0]);
  const weIso = fmD(weekDates[weekDates.length-1]);
  const shotsByPep=new Map();
  (S.shots||[]).forEach(s=>{
    if(!s||!s.peptide) return;
    if(!shotsByPep.has(s.peptide)) shotsByPep.set(s.peptide,[]);
    shotsByPep.get(s.peptide).push(s);
  });
  (S.inv||[]).forEach(it => {
    if(!it || it.isSupply || it.archived) return;
    if(!(it.interval > 0)) return;
    // Determine the FIRST upcoming due date.
    let firstDoseIso = null;
    if(it.cycleStart){
      // v0.27.71: cycleStart wins over shot history. Logged shots are
      // historical records, not schedule anchors.
      firstDoseIso = it.cycleStart;
    } else {
      const shots = shotsByPep.get(it.name) || [];
      if(!shots.length) return;
      shots.sort((a,b) => (b.date||'').localeCompare(a.date||''));
      const last = new Date(shots[0].date + 'T12:00:00');
      if(isNaN(last.getTime())) return;
      last.setDate(last.getDate() + it.interval);
      firstDoseIso = fmD(last);
    }
    // Walk forward by interval until we either pass weEnd, or pass cycleEnd.
    let current = new Date(firstDoseIso + 'T12:00:00');
    if(isNaN(current.getTime())) return;
    let safety = 0;
    // Fast-forward to the first date >= wsIso so we don't iterate decades.
    while(fmD(current) < wsIso && safety < 5000){
      current.setDate(current.getDate() + it.interval);
      safety++;
    }
    while(fmD(current) <= weIso && safety < 5000){
      const isoCur = fmD(current);
      if(it.cycleEnd && isoCur > it.cycleEnd) break;
      const di = weekDates.findIndex(d => fmD(d) === isoCur);
      if(di >= 0){
        // Suppression ownership: S.sched[name/am/di] === false means the user
        // explicitly deleted this interval occurrence. Use strict === false so
        // missing keys (normal interval) and true/object (sched ownership) are
        // unaffected. Only boolean false triggers suppression.
        const _suppressed = S.sched && S.sched[it.name+'/am/'+di] === false;
        if(!_suppressed){
          const key = it.name + '/' + di;
          if(!seen.has(key)){
            out.push({name: it.name, di});
            seen.add(key);
          }
        }
      }
      current.setDate(current.getDate() + it.interval);
      safety++;
    }
  });
  return out;
}

// Cycle window: a peptide with cycleStart/cycleEnd (either or both) is only
// "active" on dates inside that window. A peptide with neither is on forever
// (the backward-compatible default — everything imported before this feature
// existed will fall into this case). isoDate is "YYYY-MM-DD"; string compare
// works correctly for that format so we don't need to parse to Date.
// Used by renderCal and renderStack to hide scheduled cells outside the window;
// logged shots always remain visible regardless (historical data is sacred).
function isInCycleWindow(name,isoDate){
  const inv=S.inv.find(i=>i.name===name);
  if(!inv)return true;
  const s=inv.cycleStart,e=inv.cycleEnd;
  if(!s&&!e)return true;
  if(s&&isoDate<s)return false;
  if(e&&isoDate>e)return false;
  return true;
}

// Look up a peptide in PEPTIDE_REF by fuzzy name match. Used by the edit form
// to surface suggested doses, typical frequency, cycle guidance, and use case
// right where the user is filling in their own numbers. Returns null for
// unknown peptides (user proceeds without guidance, which is fine).
// Matches: case-insensitive exact, then prefix (e.g. "BPC" → BPC-157), then
// substring. Strips trailing dose phrases ("BPC-157 250mcg" → "BPC-157").
function findPeptideRef(rawName){
  if(!rawName)return null;
  const clean=rawName.replace(/\s+\d+(?:\.\d+)?\s*(mg|mcg|μg|ug|iu|units)\b.*/i,'').trim().toLowerCase();
  if(!clean)return null;
  // v0.27.88: also strip trailing digits like "Reta30" -> "reta" so user
  // shorthand names match canonical PEPTIDE_REF entries like "Retatrutide".
  const cleanStub = clean.replace(/\s*\d+\s*$/, '').replace(/[\s-_]+$/,'').trim();
  // v25: search built-ins AND user-custom catalog entries.
  let pool = PEPTIDE_REF;
  try {
    if (typeof window.tmpCatalogAllEntries === 'function'){
      pool = window.tmpCatalogAllEntries();
    }
  } catch(_){}
  // Try exact, prefix, substring against the original `clean` first…
  let hit=pool.find(r=>r.n.toLowerCase()===clean);
  if(hit)return hit;
  hit=pool.find(r=>r.n.toLowerCase().startsWith(clean));
  if(hit)return hit;
  hit=pool.find(r=>{
    const n=r.n.toLowerCase();
    return n.includes(clean)||clean.includes(n);
  });
  if(hit)return hit;
  // …then retry with the trailing-digit-stripped stub for "Reta30"-style names.
  if(cleanStub && cleanStub !== clean){
    hit=pool.find(r=>r.n.toLowerCase()===cleanStub);
    if(hit)return hit;
    hit=pool.find(r=>r.n.toLowerCase().startsWith(cleanStub));
    if(hit)return hit;
    hit=pool.find(r=>{
      const n=r.n.toLowerCase();
      return n.includes(cleanStub)||cleanStub.includes(n);
    });
    if(hit)return hit;
  }
  return null;
}
// Refresh the peptide-reference info card in the edit form. Called when the
// name input changes, when fillPF loads an existing peptide, and when clrPF
// resets. Hides itself cleanly when no match is found.
function updatePepRefCard(){
  const card=g('pf-ref-card');if(!card)return;
  const ref=findPeptideRef(gv('pf-nm'));
  if(!ref){card.style.display='none';return;}
  const doseRange=ref.startD===ref.targetD?ref.startD+ref.unit:ref.startD+'–'+ref.targetD+' '+ref.unit;
  g('pf-ref-head').textContent=ref.n+' · '+ref.cat;
  const lines=[];
  lines.push('<b>Typical dose:</b> '+escH(doseRange)+' · '+escH(ref.freq));
  if(ref.timing)lines.push('<b>Timing:</b> '+escH(ref.timing));
  if(ref.cycleOn)lines.push('<b>Cycle:</b> '+ref.cycleOn+' weeks on, '+ref.cycleOff+' weeks off');
  if(ref.use)lines.push('<b>Use:</b> '+escH(ref.use));
  // v14a: surface literature half-life + auto-suggest into the input.
  if(typeof ref.hl==='number' && ref.hl>0){
    const hlStr = ref.hl >= 24
      ? (Math.round(ref.hl/24*10)/10)+' days'
      : (ref.hl < 1 ? Math.round(ref.hl*60)+' min' : ref.hl+' hr');
    lines.push('<b>Half-life:</b> '+escH(hlStr)+' <span style="opacity:.65;font-size:10px">(literature)</span>');
    // v23: stacking suggestions from cheatsheet "Good With" column.
    if(Array.isArray(ref.goodWith) && ref.goodWith.length){
      lines.push('<b>Often stacked with:</b> '+ref.goodWith.map(escH).join(', '));
    }
    if(Array.isArray(ref.notGoodWith) && ref.notGoodWith.length){
      lines.push('<b style="color:var(--accent-red-fg)">⚠ Avoid stacking with:</b> '+ref.notGoodWith.map(escH).join(', '));
    }
    const hlInp=g('pf-hl'), hlUnit=g('pf-hl-unit');
    if(hlInp && !hlInp.value){
      if(ref.hl >= 24){ hlInp.value = Math.round(ref.hl/24*100)/100; if(hlUnit) hlUnit.value='days'; }
      else            { hlInp.value = ref.hl;                         if(hlUnit) hlUnit.value='hours'; }
    }
  }
  g('pf-ref-body').innerHTML=lines.join('<br>');
  card.style.display='';
}

// ── Blend / stack-group form helpers ─────────────────────────────────────────
// A blend is an inventory item with {isBlend:true, components:[{peptide,amount,unit}]}
// representing multiple peptides combined into one vial or syringe. The edit
// form surfaces these via a checkbox and a hidden Composition section.
// Component peptides must already exist as standalone (non-blend) inventory
// items — this keeps color, naming, and ordering consistent.

// Build one component row for the Composition section. `comp` is {peptide,
// amount, unit} from a saved blend, or undefined for a fresh empty row.
function buildCompositionRow(comp){
  const row=document.createElement('div');
  row.className='pf-blend-row';
  row.style.cssText='display:flex;gap:6px;margin-bottom:6px;align-items:center';
  // Peptide dropdown — populated from current inventory, excluding other
  // blends (no nesting) and excluding the item currently being edited (no
  // self-reference). Falls back to a free-text option if the saved component
  // isn't in inventory anymore (orphaned reference — still displayed so user
  // can see and fix it).
  const sel=document.createElement('select');
  sel.className='pf-blend-peptide';
  sel.style.cssText='flex:1;min-width:0';
  sel.innerHTML='<option value="">— pick peptide —</option>';
  let foundExact=false;
  (S.inv||[]).forEach(p=>{
    if(p.isBlend)return;
    if(pepEId&&p.id===pepEId)return;
    const o=document.createElement('option');
    o.value=p.name;
    o.textContent=p.name;
    if(comp&&comp.peptide===p.name){o.selected=true;foundExact=true;}
    sel.appendChild(o);
  });
  // Orphaned reference — peptide was deleted or renamed. Keep the row valid
  // so the user sees what's broken instead of silently dropping data.
  if(comp&&comp.peptide&&!foundExact){
    const o=document.createElement('option');
    o.value=comp.peptide;
    o.textContent=comp.peptide+' (not in inventory)';
    o.selected=true;
    sel.appendChild(o);
  }
  const amt=document.createElement('input');
  amt.type='number';amt.min='0';amt.step='any';
  amt.className='pf-blend-amount';
  amt.placeholder='amount';
  amt.style.cssText='width:90px;flex-shrink:0';
  if(comp&&typeof comp.amount==='number')amt.value=comp.amount;
  const unit=document.createElement('select');
  unit.className='pf-blend-unit';
  unit.style.cssText='width:58px;flex-shrink:0';
  unit.innerHTML='<option value="mcg">mcg</option><option value="mg">mg</option>';
  if(comp&&comp.unit)unit.value=comp.unit;
  const rm=document.createElement('button');
  rm.type='button';rm.className='btn';
  rm.textContent='×';
  rm.title='Remove component';
  rm.setAttribute('aria-label','Remove component');
  rm.style.cssText='width:32px;padding:4px;flex-shrink:0;font-weight:700';
  rm.addEventListener('click',()=>row.remove());
  row.appendChild(sel);row.appendChild(amt);row.appendChild(unit);row.appendChild(rm);
  return row;
}

// Read the current Composition UI into a components array, skipping empty or
// invalid rows. This is the canonical path from form DOM back to data.
function readComposition(){
  const out=[];
  document.querySelectorAll('#pf-blend-components .pf-blend-row').forEach(row=>{
    const p=row.querySelector('.pf-blend-peptide');
    const a=row.querySelector('.pf-blend-amount');
    const u=row.querySelector('.pf-blend-unit');
    if(!p||!a||!u)return;
    const peptide=p.value.trim();
    const amount=parseFloat(a.value);
    const unit=u.value;
    if(peptide&&!isNaN(amount)&&amount>0)out.push({peptide:peptide,amount:amount,unit:unit});
  });
  return out;
}

// Toggle the form between single-peptide and blend modes. The dose-unit
// dropdown swaps between mass/count options and volume options because a
// blend's "dose" is the volume drawn from the blended vial, not a mass.
// The "Typical dose" label changes to "Volume per dose" to match.
function refreshBlendUI(){
  const cb=g('pf-is-blend');if(!cb)return;
  const on=cb.checked;
  const sec=g('pf-blend-section');if(sec)sec.style.display=on?'':'none';
  const du=g('pf-du');
  if(!du)return;
  const cur=du.value;
  if(on){
    du.innerHTML='<option value="units">units</option><option value="mL">mL</option>';
    du.value=(cur==='mL'||cur==='units')?cur:'units';
  }else{
    du.innerHTML='<option value="mcg">mcg</option><option value="mg">mg</option><option value="pill">pill</option>';
    du.value=(cur==='mcg'||cur==='mg'||cur==='pill')?cur:'mg';
  }
  const lbl=document.querySelector('label[for="pf-ds"]');
  if(lbl)lbl.textContent=on?'Volume per dose':'Typical dose';
  // Reference card is about single peptides — hide when in blend mode (a
  // blend's name won't match PEPTIDE_REF and the card would be misleading).
  if(on){const card=g('pf-ref-card');if(card)card.style.display='none';}
  else{updatePepRefCard();}
}

// Return a list of blend inventory items that reference `peptideName` as a
// component. Used to (a) warn on delete, (b) propagate renames.
function blendsUsing(peptideName){
  if(!peptideName)return [];
  return (S.inv||[]).filter(it=>it.isBlend&&Array.isArray(it.components)&&it.components.some(c=>c.peptide===peptideName));
}

// u100 syringe math — the practical "how much to draw up" number at injection
// time. u100 means 100 units = 1 mL (the standard insulin syringe scale). At a
// glance on the calendar, the user wants to see "17u" not "2.5mg", because
// the mg is math that was already done upstream when they reconstituted.
// Returns null when we can't compute (missing vial/BAC/dose, or pill format).
// Rounds to 1 decimal below 10u (precision matters for small doses like 4.5u)
// and whole numbers at 10u+ (no one draws up 17.3u from an insulin syringe).

// TMP-IU: resolve how many IU equal 1 mg for a peptide. Priority: explicit
// item.iuPerMg override, then well-known substances (somatropin/HGH standard
// is 3 IU = 1 mg). Returns 0 when unknown - callers must skip mg conversion.
function tmpIuPerMgFor(itemOrName){
  try{
    var it = (typeof itemOrName === 'string')
      ? (S.inv||[]).find(function(i){ return i && i.name === itemOrName; })
      : itemOrName;
    if (it && +it.iuPerMg > 0) return +it.iuPerMg;
    var nm = String((it && it.name) || (typeof itemOrName === 'string' ? itemOrName : '') || '').toLowerCase();
    if (/hgh|somatropin|growth\s*hormone|genotropin|norditropin|omnitrope|humatrope/.test(nm)) return 3;
  }catch(_){ }
  return 0;
}
window.tmpIuPerMgFor = tmpIuPerMgFor;

function computeUnitsFromMg(doseMg,vialMg,reconBacMl){
  if(!doseMg||!vialMg||!reconBacMl)return null;
  const units=doseMg*100*reconBacMl/vialMg;
  return units<10?Math.round(units*10)/10:Math.round(units);
}
// For a SCHEDULED peptide — uses the inventory item's typical dose + recon data.
// For BLENDS: the "dose" is already a volume (mL or units), so we translate
// directly without going through mass/concentration math.
function schedUnits(name){
  const inv=S.inv.find(i=>i.name===name);
  if(!inv)return null;
  const du=inv.doseUnit||'mcg';
  if(du==='pill')return null;
  if(du==='units'){
    const u=+inv.dose||0;
    return u?(u<10?Math.round(u*10)/10:Math.round(u)):null;
  }
  if(du==='mL'){
    const u=(+inv.dose||0)*100;
    return u?(u<10?Math.round(u*10)/10:Math.round(u)):null;
  }
  const doseMg=(du==='mg'||du==='iu')?(+inv.dose||0):(+inv.dose||0)/1000;
  return computeUnitsFromMg(doseMg,+inv.vialMg||0,+inv.reconBacMl||0);
}
// RC-5: Per-occurrence dose helpers.
// S.sched[key] is either:
//   true               — no override; use inventory default dose
//   {dose, doseUnit}   — occurrence-level override (single cell)
// All boolean checks on S.sched[key] remain correct because both forms are truthy.
function _doseToMcgNum(dose,unit){
  const d=+dose||0; if(!d) return 0;
  const _u=(unit||'mcg');return (_u==='mg'||_u==='iu')?d*1000:d;
}
function _schedDoseLooksStale(name,time,di,cellVal){
  if(!cellVal||typeof cellVal!=='object') return false;
  if(cellVal._user) return false;
  const inv=(S.inv||[]).find(i=>i.name===name&&!i.isSupply);
  if(!inv||!inv.dose) return false;
  const invMcg=_doseToMcgNum(inv.dose,inv.doseUnit||'mcg');
  const cellMcg=_doseToMcgNum(cellVal.dose,cellVal.doseUnit||'mcg');
  if(!invMcg||!cellMcg||Math.abs(invMcg-cellMcg)<0.001) return false;
  // Stale alias bug: one wrong object while siblings use inventory default (true).
  let trueSiblings=0;
  for(let d=0;d<7;d++){
    if(d===di) continue;
    const v=S.sched[sk(name,time,d)];
    if(v===true) trueSiblings++;
  }
  return trueSiblings>=1;
}
function getOccurrenceDose(name,time,di){
  const canon=sk(name,time,di);
  const cv=S.sched[canon];
  if(cv&&typeof cv==='object'){
    if(_schedDoseLooksStale(name,time,di,cv)){
      const inv=(S.inv||[]).find(i=>i.name===name&&!i.isSupply);
      return inv?{dose:inv.dose||0,doseUnit:inv.doseUnit||'mcg'}:{dose:0,doseUnit:'mcg'};
    }
    return{dose:cv.dose||0,doseUnit:cv.doseUnit||'mcg'};
  }
  if(cv===true){
    const inv=(S.inv||[]).find(i=>i.name===name&&!i.isSupply);
    return inv?{dose:inv.dose||0,doseUnit:inv.doseUnit||'mcg'}:{dose:0,doseUnit:'mcg'};
  }
  // Legacy meal-lane keys only when no canonical am/pm cell exists yet.
  for(const meal of (TIME_MEAL_LANES[time]||[])){
    const mk=sk(name,meal,di);
    const v=S.sched[mk];
    if(v&&typeof v==='object'){
      if(_schedDoseLooksStale(name,time,di,v)){
        const inv=(S.inv||[]).find(i=>i.name===name&&!i.isSupply);
        return inv?{dose:inv.dose||0,doseUnit:inv.doseUnit||'mcg'}:{dose:0,doseUnit:'mcg'};
      }
      return{dose:v.dose||0,doseUnit:v.doseUnit||'mcg'};
    }
    if(v===true){
      const inv=(S.inv||[]).find(i=>i.name===name&&!i.isSupply);
      return inv?{dose:inv.dose||0,doseUnit:inv.doseUnit||'mcg'}:{dose:0,doseUnit:'mcg'};
    }
  }
  const inv=(S.inv||[]).find(i=>i.name===name&&!i.isSupply);
  return inv?{dose:inv.dose||0,doseUnit:inv.doseUnit||'mcg'}:{dose:0,doseUnit:'mcg'};
}
// Write dose override (or true) to every active key for one calendar cell, then
// drop stale meal-lane duplicates so sanitize cannot resurrect a wrong dose.
function writeOccurrenceDose(name,time,di,val){
  const canon=sk(name,time,di);
  const keys=schedKeysForCell(name,time,di);
  let wrote=false;
  keys.forEach(k=>{
    if(S.sched[k]===false) return;
    S.sched[k]=val;
    wrote=true;
  });
  if(!wrote) S.sched[canon]=val;
  for(const meal of (TIME_MEAL_LANES[time]||[])){
    const mk=sk(name,meal,di);
    if(mk!==canon) try{ delete S.sched[mk]; }catch(_){}
  }
  S.sched[canon]=val;
}
// schedUnitsForCell: like schedUnits() but uses per-occurrence dose (RC-5).
function schedUnitsForCell(name,time,di){
  const inv=(S.inv||[]).find(i=>i.name===name);if(!inv)return null;
  const occ=getOccurrenceDose(name,time,di);
  const du=occ.doseUnit;
  if(du==='pill')return null;
  if(du==='units'){const u=+occ.dose||0;return u?(u<10?Math.round(u*10)/10:Math.round(u)):null;}
  if(du==='mL'){const u=(+occ.dose||0)*100;return u?(u<10?Math.round(u*10)/10:Math.round(u)):null;}
  const doseMg=(du==='mg'||du==='iu')?(+occ.dose||0):(+occ.dose||0)/1000;
  return computeUnitsFromMg(doseMg,+inv.vialMg||0,+inv.reconBacMl||0);
}
// For a LOGGED shot — prefers the stored volume directly (what was ACTUALLY
// drawn at injection time, which is the source of truth even if the peptide's
// recon ratio changes later). Falls back to computing from dose if volume is
// missing. Returns null for pill shots.
function shotUnits(shot){
  if(!shot)return null;
  if(shot.volumeUnit==='pill'||shot.doseUnit==='pill')return null;
  const vol=+shot.volume||0;
  if(vol){
    if((shot.volumeUnit||'mL')==='units')return vol<10?Math.round(vol*10)/10:Math.round(vol);
    if((shot.volumeUnit||'mL')==='mL'){const u=vol*100;return u<10?Math.round(u*10)/10:Math.round(u);}
  }
  // Fallback: compute from dose + the peptide's inventory recon (best effort)
  const inv=S.inv.find(i=>i.name===shot.peptide);
  if(!inv)return null;
  const du=shot.doseUnit||'mcg';
  if(du==='pill')return null;
  const doseMg=(du==='mg'||du==='iu')?(+shot.dose||0):(+shot.dose||0)/1000;
  return computeUnitsFromMg(doseMg,+inv.vialMg||0,+inv.reconBacMl||0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Vial-Level Inventory (per-physical-vial tracking)
// ═══════════════════════════════════════════════════════════════════════════════
// The legacy model treated stock as bucket counts: peptide X has 3 in freezer,
// 1 in fridge. That can't answer "which vendor was the vial that worked best?"
// or "how much GHK-Cu is left in the custom blend I made last week?"
//
// S.vials[] is a flat list of physical vial instances. Each row =
//   {
//     id, peptideName,                      // identity
//     vendor, orderId, batchId,             // provenance
//     labelMg, totalMcg, remainingMcg,      // amount (decrements per dose)
//     location: 'freezer'|'fridge'|'desk',  // where it lives
//     storedDate, reconDate, reconExpDays,  // dates
//     reconBacMl, productionDate, vendorExpiry,
//     sourceType: 'purchased'|'blend'|'gift',
//     status: 'active'|'depleted'|'discarded'|'gifted',
//     cost, notes,
//     // Phase 2 fields (declared but only Phase-1-populated where noted):
//     sources:    [{vialId, amountMcg}],    // for blend vials — which vials went in
//     consumedBy: vialId,                   // back-pointer on a source vial
//     components: [{peptide, mcg}],         // for blend vials — what's IN the bottle
//     depletedDate
//   }
//
// Doses logged against peptide P:
//   1. Pick the fridge vial of P with the most-recent reconDate (LIFO — finish
//      what's open). If none, auto-recon the oldest freezer vial (FIFO — use
//      old stock first), decrement BAC, set reconDate=today.
//   2. Decrement remainingMcg by dose. If it hits 0, mark depleted.
//   3. Stamp shot.vialId for traceability (later: per-vial shot history).
//
// Migration: load() once converts each non-blend peptide's legacy fz/fr/dk
// counts into N anonymous vial rows, idempotent via S._vialMigration_v1.
// After migration, fz/fr/dk are computed views — recomputeStockFromVials keeps
// them synced so existing renderInv() etc. still work without rewrite.
//
// Phase 1 (this implementation): purchased vials only. Custom blends (multiple
// source vials → new combined vial) are wired in Phase 2.

// Convert dose+unit to canonical mcg for vial accounting. Pills/units/mL
// don't have a mass equivalent here — return 0 and the caller skips deduction.
function doseToMcg(dose,unit){
  if(!dose||dose<=0)return 0;
  if(unit==='mg'||unit==='iu')return (+dose)*1000;
  if(unit==='mcg')return +dose;
  return 0; // pill, units, mL — no mass-based deduction
}

// Active vials (excluding gifted/discarded) for a given peptide.
// `status` is the lifecycle field; depleted vials are kept in the array as
// historical record but not eligible for new doses (remainingMcg===0 anyway).
function vialsFor(peptideName){
  return (S.vials||[]).filter(v=>v.peptideName===peptideName&&v.status!=='discarded'&&v.status!=='gifted');
}

// Eligible-to-deduct fridge vials: in fridge, status=active, remaining>0.
function fridgeVialsFor(peptideName){
  return vialsFor(peptideName).filter(v=>v.location==='fridge'&&v.status==='active'&&v.remainingMcg>0);
}

// Sealed freezer vials available for reconstitution.
function freezerVialsFor(peptideName){
  return vialsFor(peptideName).filter(v=>v.location==='freezer'&&v.status==='active');
}

// LIFO pick — use the vial that's already open. Tied recon dates → highest id
// (most recently added) wins, which generally matches "most recently opened".
function pickFridgeVial(peptideName){
  const fridge=fridgeVialsFor(peptideName);
  if(!fridge.length)return null;
  fridge.sort((a,b)=>{
    const cmp=(b.reconDate||'').localeCompare(a.reconDate||'');
    if(cmp!==0)return cmp;
    return b.id-a.id;
  });
  return fridge[0];
}

// FIFO pick — burn down old stock first. Vials with a productionDate sort
// before vials without one (we treat unknown as newest, since we can't prove
// it's older). Tie-breaker: lowest id (earliest added).
function pickFreezerVial(peptideName){
  const fz=freezerVialsFor(peptideName);
  if(!fz.length)return null;
  fz.sort((a,b)=>{
    const ap=a.productionDate||'9999-12-31';
    const bp=b.productionDate||'9999-12-31';
    const cmp=ap.localeCompare(bp);
    if(cmp!==0)return cmp;
    return a.id-b.id;
  });
  return fz[0];
}

// Sync the legacy fz/fr/dk and reconDate fields on the inv item from S.vials.
// Called after any vial mutation. Keeps existing renderInv/renderStack happy
// without forcing a rewrite of every place that reads inv.fz etc.
function recomputeStockFromVials(peptideName){
  const inv=S.inv.find(i=>i.name===peptideName&&!i.isSupply);
  if(!inv)return;
  const vs=vialsFor(peptideName);
  inv.fz=vs.filter(v=>v.location==='freezer'&&v.status==='active').length;
  inv.fr=vs.filter(v=>v.location==='fridge'&&v.status==='active'&&v.remainingMcg>0).length;
  inv.dk=vs.filter(v=>v.location==='desk'&&v.status==='active').length;
  // Mirror most-recent fridge vial's recon date onto inv for the existing
  // expiry-badge code in renderInv.
  const fridge=fridgeVialsFor(peptideName);
  if(fridge.length){
    fridge.sort((a,b)=>(b.reconDate||'').localeCompare(a.reconDate||''));
    if(fridge[0].reconDate)inv.reconDate=fridge[0].reconDate;
    if(fridge[0].reconExpDays)inv.reconExpDays=fridge[0].reconExpDays;
  }else{
    delete inv.reconDate;
  }
}

// True if this peptide has at least one usable vial row. Used to decide
// whether the dose-logging path should deduct from vials or fall back to the
// legacy fr-counter logic for peptides added before vial tracking existed.
function hasVials(peptideName){
  return vialsFor(peptideName).length>0;
}

// One-time backfill. For each non-blend, non-supply peptide that has stock
// counts, spawn that many anonymous vial rows. Vendor/batch are left blank —
// the user can edit individual vials later. Lossy on partial-fridge-vial
// remaining-mcg (we assume "still mostly there" by setting remainingMcg=total),
// which matches what the user would estimate anyway.
function migrateInventoryToVials(){
  if(S._vialMigration_v1)return;
  if(!Array.isArray(S.vials))S.vials=[];
  if(typeof S.nV!=='number'||S.nV<1)S.nV=1;

  (S.inv||[]).forEach(item=>{
    if(item.isSupply)return;
    if(item.isBlend)return; // blend recipe items — Phase 2 will spawn vials for blend instances
    const labelMg=+item.vialMg||0;
    const total=labelMg*1000;
    const mk=(loc,reconDate,reconExpDays)=>({
      id:S.nV++,
      peptideName:item.name,
      vendor:'',
      orderId:'',
      batchId:'',
      labelMg:labelMg,
      totalMcg:total,
      remainingMcg:total,
      location:loc,
      storedDate:'',
      reconDate:reconDate||'',
      reconExpDays:reconExpDays||0,
      reconBacMl:+item.reconBacMl||0,
      productionDate:item.productionDate||'',
      vendorExpiry:'',
      sourceType:'purchased',
      status:'active',
      cost:0,
      notes:'',
      _migrated:true
    });
    const fz=item.fz||0, fr=item.fr||0, dk=item.dk||0;
    for(let i=0;i<fz;i++)S.vials.push(mk('freezer','',0));
    for(let i=0;i<fr;i++)S.vials.push(mk('fridge',item.reconDate||'',item.reconExpDays||28));
    for(let i=0;i<dk;i++)S.vials.push(mk('desk','',0));
  });

  S._vialMigration_v1=true;
}

// Display helper — short identity string for a vial in lists/dropdowns.
// "Vendor B · Batch 20260201 · 50mg" or "Unlabeled 50mg #12" if blank.
function vialLabel(v){
  if(!v)return '';
  const bits=[];
  if(v.vendor)bits.push(v.vendor);
  if(v.batchId)bits.push(v.batchId);
  if(v.labelMg)bits.push(v.labelMg+'mg');
  if(!bits.length)bits.push('Unlabeled #'+v.id);
  return bits.join(' · ');
}

// Percentage of vial remaining (0-100). For empty / labelless vials returns 0
// to avoid div-by-zero crashes in the bar renderer.
function vialPct(v){
  if(!v||!v.totalMcg||v.totalMcg<=0)return 0;
  return Math.max(0,Math.min(100,(v.remainingMcg/v.totalMcg)*100));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Persistence (IndexedDB + Import/Export)
// REDUNDANT PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════════
// localStorage is our primary store but it's fragile — it's scoped per origin,
// so a change in path/protocol/port treats data as missing. To reduce the pain:
//   1. Every save() also mirrors the state to IndexedDB (different eviction rules,
//      larger capacity) so if localStorage gets cleared we can recover.
//   2. On load(), if localStorage is empty/new but IndexedDB has data, auto-restore.
//   3. sessionStorage gets a copy too — survives reloads within the same tab session,
//      protects against accidental localStorage clears during development.
// None of this helps across genuinely-different origins (e.g. file:// vs https://) —
// that's a browser-level security boundary no code can cross.

const IDB_NAME='peptide_tracker_db';
const IDB_STORE='state';
const IDB_KEY='S';
let _idbReady=null;
function openIdb(){
  if(_idbReady)return _idbReady;
  _idbReady=new Promise((resolve)=>{
    if(!window.indexedDB){resolve(null);return;}
    try{
      const req=indexedDB.open(IDB_NAME,1);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(IDB_STORE))db.createObjectStore(IDB_STORE);};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>resolve(null);
    }catch(e){resolve(null);}
  });
  return _idbReady;
}
async function idbPut(value){
  const db=await openIdb();if(!db)return false;
  return new Promise(resolve=>{
    try{
      const tx=db.transaction(IDB_STORE,'readwrite');
      tx.objectStore(IDB_STORE).put(value,IDB_KEY);
      tx.oncomplete=()=>resolve(true);
      tx.onerror=()=>resolve(false);
    }catch(e){resolve(false);}
  });
}
async function idbGet(){
  const db=await openIdb();if(!db)return null;
  return new Promise(resolve=>{
    try{
      const tx=db.transaction(IDB_STORE,'readonly');
      const req=tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>resolve(null);
    }catch(e){resolve(null);}
  });
}

// ── Debounced save ──────────────────────────────────────────────────────────
// save() used to flush synchronously on every call: stringify the ENTIRE state
// object + write localStorage + sessionStorage + IndexedDB. Patch layers wrap
// save() up to 8 deep and single interactions often call it several times, so
// one click could serialize the full state 3-5x back-to-back on the main
// thread — a primary cause of UI freezes. Calls now coalesce into one flush
// 150 ms after the first call. Data-loss safety: pagehide and
// visibilitychange(hidden) force an immediate flush, so tab close, reload,
// and navigation always persist the latest state. window.saveNow() is
// available for code that must flush synchronously before proceeding.
let _savePending=false,_saveDebounceTimer=null;
function save(){
  if(_savePending)return;
  _savePending=true;
  // If the page is already hidden/unloading (e.g. the close-save hook calls
  // save() from pagehide), a deferred timer would never fire — flush now.
  var hidden=false;try{hidden=document.visibilityState==='hidden';}catch(_){}
  if(hidden){_flushPendingSave();return;}
  _saveDebounceTimer=setTimeout(_flushPendingSave,150);
}
function _flushPendingSave(){
  if(!_savePending)return;
  _savePending=false;
  if(_saveDebounceTimer){clearTimeout(_saveDebounceTimer);_saveDebounceTimer=null;}
  _flushSaveNow();
}
function saveNow(){_savePending=true;_flushPendingSave();}
window.saveNow=saveNow;
try{
  window.addEventListener('pagehide',_flushPendingSave);
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='hidden')_flushPendingSave();
  });
}catch(_){}
// Ask the browser to protect this origin's storage from automatic eviction.
// For an app whose entire dataset lives in localStorage/IndexedDB, this is the
// single cheapest data-loss protection available. Silent no-op if unsupported.
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();}catch(_){}
const LAST_ACTIVE_PAGE_KEY='tmp.lastActivePage';
function rememberCurrentPage(pg){
  if(!pg) return;
  try{localStorage.setItem(LAST_ACTIVE_PAGE_KEY,String(pg));}catch(_){}
}
function readSavedPage(){
  try{
    const pg=localStorage.getItem(LAST_ACTIVE_PAGE_KEY);
    if(pg&&document.getElementById('pg-'+pg)) return pg;
  }catch(_){}
  return 'stack';
}
function saveAsync(done){
  const run=()=>{try{_flushSaveNow();}catch(_){}if(done)done();};
  if(typeof requestIdleCallback==='function')requestIdleCallback(run,{timeout:600});
  else setTimeout(run,0);
}
// Save hook registry — replaces the old pattern of patches re-wrapping
// window.save (it was 8 wrappers deep). Patches push functions here instead:
//   pre-hooks  run once per flush, BEFORE state is serialized (guards/repairs)
//   post-hooks run once per flush, AFTER a successful localStorage write
window.__tmpSavePre=window.__tmpSavePre||[];
window.__tmpSavePost=window.__tmpSavePost||[];
// SHOT-PERSIST-R1: union two shot arrays by id so a stale tab / older backup
// cannot erase shots that exist in either side. Prefer the entry with the
// higher numeric id when both sides have the same id (newer write wins).
function mergeShotArrays(a,b){
  const map=new Map();
  function absorb(list){
    if(!Array.isArray(list))return;
    for(let i=0;i<list.length;i++){
      const s=list[i];
      if(!s||typeof s!=='object')continue;
      const id=s.id!=null?String(s.id):('__anon_'+i+'_'+(s.date||'')+'_'+(s.peptide||'')+'_'+(s.time||''));
      const prev=map.get(id);
      if(!prev){map.set(id,s);continue;}
      const prevId=Number(prev.id)||0, nextId=Number(s.id)||0;
      map.set(id, nextId>=prevId?s:prev);
    }
  }
  absorb(a);absorb(b);
  return Array.from(map.values());
}
window.mergeShotArrays=mergeShotArrays;
function maxShotId(list){
  let m=0;
  if(!Array.isArray(list))return 0;
  for(let i=0;i<list.length;i++){
    const n=Number(list[i]&&list[i].id)||0;
    if(n>m)m=n;
  }
  return m;
}
// Pull disk state into memory when another tab wrote a newer revision, or when
// disk has shot history we are missing. Returns true if S was mutated.
function reconcileFromDisk(){
  try{
    const raw=localStorage.getItem('peptide_tracker');
    if(!raw)return false;
    const disk=JSON.parse(raw);
    if(!disk||typeof disk!=='object')return false;
    const diskRev=Number(disk._saveRev)||0;
    const memRev=Number(S._saveRev)||0;
    const diskShots=Array.isArray(disk.shots)?disk.shots:[];
    const memShots=Array.isArray(S.shots)?S.shots:[];
    const diskNewer=diskRev>memRev;
    const diskHasExtraShots=diskShots.length>memShots.length||maxShotId(diskShots)>maxShotId(memShots);
    if(!diskNewer&&!diskHasExtraShots)return false;
    // Always union shots — never let the older side win by replacement.
    const merged=mergeShotArrays(memShots,diskShots);
    let changed=merged.length!==memShots.length;
    if(!changed){
      const beforeIds=new Set(memShots.map(s=>String(s&&s.id)));
      changed=merged.some(s=>!beforeIds.has(String(s&&s.id)));
    }
    S.shots=merged;
    if(disk.nS!=null&&(!S.nS||Number(disk.nS)>Number(S.nS)))S.nS=disk.nS;
    // If disk is strictly newer, adopt non-shot fields too (sched/inv/etc).
    // Shots already merged above.
    if(diskNewer){
      const keepShots=S.shots;
      const keepNS=S.nS;
      Object.assign(S,disk);
      S.shots=mergeShotArrays(keepShots,Array.isArray(disk.shots)?disk.shots:[]);
      if(keepNS!=null&&(!S.nS||Number(keepNS)>Number(S.nS)))S.nS=keepNS;
      changed=true;
    }
    S._saveRev=Math.max(diskRev,memRev);
    return changed;
  }catch(_){return false;}
}
window.reconcileFromDisk=reconcileFromDisk;
function _flushSaveNow(){
  (window.__tmpSavePre||[]).forEach(function(fn){try{fn();}catch(_){}});
  // SHOT-PERSIST-R1: merge any newer/extra shots from disk before we write, so
  // a background tab cannot clobber shots logged in another tab.
  try{reconcileFromDisk();}catch(_){}
  S._saveRev=(Number(S._saveRev)||0)+1;
  S._saveAt=Date.now();
  const payload=JSON.stringify(S);
  let _lsOk=false;
  try{localStorage.setItem('peptide_tracker',payload);_lsOk=true;}catch(e){console.error('localStorage save failed:',e);}
  // (removed) sessionStorage mirror: it duplicated the full payload on every
  // save but was never read anywhere in the app — pure main-thread cost.
  idbPut(payload).catch(()=>{});
  if(_lsOk){
    showSaved();
    (window.__tmpSavePost||[]).forEach(function(fn){try{fn();}catch(_){}});
    // Nudge the auto-backup rotation (postload patch) AFTER a real flush, so
    // snapshots never read a stale localStorage payload. Throttled internally.
    try{if(typeof window.tmpBackupSnapshot==='function')setTimeout(window.tmpBackupSnapshot,0);}catch(_){}
  }else{showSaveFailed();}
}
// Cross-tab + wake-from-sleep: when this tab becomes visible again, pull any
// shots logged elsewhere before the user acts (and before we save over them).
try{
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState!=='visible')return;
    try{
      if(reconcileFromDisk()){
        try{if(typeof refreshAfterShotChange==='function')refreshAfterShotChange();}catch(_){}
        try{if(typeof renderLogShotRows==='function')renderLogShotRows();}catch(_){}
        try{if(typeof renderCal==='function')renderCal({force:true});}catch(_){}
      }
    }catch(_){}
  });
  window.addEventListener('storage',function(e){
    if(!e||e.key!=='peptide_tracker'||!e.newValue)return;
    try{
      if(reconcileFromDisk()){
        try{if(typeof refreshAfterShotChange==='function')refreshAfterShotChange();}catch(_){}
        try{if(typeof renderLogShotRows==='function')renderLogShotRows();}catch(_){}
        try{if(typeof renderCal==='function')renderCal({force:true});}catch(_){}
      }
    }catch(_){}
  });
}catch(_){}
// Allow-list of top-level keys we'll accept from a backup. Anything else is dropped.
// Keeping this narrow shields us from surprise keys (future app versions, malicious backups)
// that could shadow prototype methods or collide with future state.
const ALLOWED_IMPORT_KEYS=new Set([
  'shots','inv','sched','stackPlan','wkOff','nI','nS','nV','vendors','prices','tit','packages','vials','tracking','amStack','pmStack','ov',
  // v33.375-stable-vendor-post-import-review: vits + rx state and their log arrays — were silently stripped on import before this version
  'vits','vitsLog','rx','rxLog',
  // vitals feature (health metrics): entries + unit pref + id counter
  'vitals','vitalsUnit','nVit',
  // Migration / feature flags the app itself sets
  '_hadSaved','_mig','_supplies_seeded','_supply_dupes_cleaned_v3','_alcohol_pads_recovery','_owner_vendors_restored','_vialMigration_v1','_isPeptide_backfill_v1','_shotTypes_backfill_v1','_vendorUppercaseMigration_v1','_warehouseMigration_v1'
]);
// Hard cap on imported JSON text size. 10 MB is generous — real backups are <<1 MB.
// Above this we refuse rather than lock up the main thread parsing a bloated or malicious file.
const IMPORT_MAX_BYTES=10*1024*1024;

// Shared by file-picker import and drag-and-drop of a .json backup onto the page.
function runPeptideTrackerImport(text,clearFileInput){
  const clearIn=()=>{try{const lr=g('logo-reveal-actions');if(lr)lr.style.display='none';if(typeof clearFileInput==='function')clearFileInput();}catch(e){}};
  // Size guard first — cheaper than parsing a huge string.
  if(typeof text!=='string'){alert('Invalid backup file — not text.');clearIn();return;}
  if(text.length>IMPORT_MAX_BYTES){
    alert('Backup file is too large ('+(text.length/1024/1024).toFixed(1)+' MB). Max accepted size is '+(IMPORT_MAX_BYTES/1024/1024)+' MB. If this is a legitimate backup please get in touch.');
    clearIn();return;
  }
  let imported;
  try{imported=JSON.parse(text);}
  catch(err){alert('Could not parse file: '+err.message);clearIn();return;}
  if(!imported||typeof imported!=='object'||Array.isArray(imported)){alert('Invalid backup file — not a JSON object.');clearIn();return;}
  // Build a clean, null-prototype object with only the allow-listed keys copied over.
  // This neutralizes any __proto__/constructor games in the backup and ensures we don't
  // inherit unknown fields that could collide with future app state.
  const clean=Object.create(null);
  for(const k of Object.keys(imported)){
    if(!ALLOWED_IMPORT_KEYS.has(k))continue;
    if(k==='__proto__'||k==='constructor'||k==='prototype')continue; // belt and suspenders
    clean[k]=imported[k];
  }
  // Coerce inv to array if it arrived as an object (some older exports had this)
  if(clean.inv&&!Array.isArray(clean.inv)){
    try{clean.inv=Object.values(clean.inv).filter(x=>x&&typeof x==='object');}catch(err){clean.inv=[];}
  }
  if(!Array.isArray(clean.inv))clean.inv=[];
  if(clean.vials&&!Array.isArray(clean.vials))clean.vials=[];
  // Cap the inventory and shot lists at sane maxes so a tampered file can't OOM the browser.
  // (Real-world: few hundred shots, few dozen inv rows.)
  if(clean.inv.length>5000){alert('Backup has '+clean.inv.length+' inventory rows — refusing as likely corrupt/malicious.');clearIn();return;}
  if(Array.isArray(clean.shots)&&clean.shots.length>100000){alert('Backup has '+clean.shots.length+' shots — refusing as likely corrupt/malicious.');clearIn();return;}
  // Schema-version check: if the backup tags itself as a newer schema than this app knows about,
  // prompt the user. Unversioned backups (from before v1) are treated as v0 and imported silently.
  // TMP_SCHEMA_VERSION is defined inside init() — the `typeof` guard handles the pre-init case.
  const backupSchema=Number(imported._export_schema)||0;
  const appSchema=(typeof TMP_SCHEMA_VERSION!=='undefined')?TMP_SCHEMA_VERSION:1;
  if(backupSchema>appSchema){
    if(!confirm('This backup was exported by a newer version of PeptideGenius (schema v'+backupSchema+', this app understands v'+appSchema+'). Some fields may be dropped. Continue anyway?')){clearIn();return;}
  }
  const importVialN=Array.isArray(clean.vials)?clean.vials.length:0;
  const importParts=[clean.inv.length+' peptides',((clean.shots||[]).length)+' shots'];
  if(importVialN)importParts.push(importVialN+' vial'+(importVialN===1?'':'s'));
  let importSchedN=0;
  try{
    importSchedN=Object.keys(clean.sched||{}).filter(k=>{
      const v=clean.sched[k];
      return v===true||(v&&typeof v==='object');
    }).length;
  }catch(_){}
  if(importSchedN)importParts.push(importSchedN+' calendar slots');
  if(!confirm('Import '+importParts.join(' + ')+'? This REPLACES your current data.')){clearIn();return;}

  // CRITICAL ORDER: calendar clear-lock installs an S.sched setter that prunes
  // non-allowed names. If we Object.assign(sched) while the lock/guard is still
  // active, the imported schedule is wiped to {} before we ever clear the lock.
  try{window._tmpBypassCalEnforce=true;}catch(_){}
  try{if(window.tmpCalClearGuard)tmpCalClearGuard.clear();}catch(_){}
  try{
    // Dismantle defineProperty/Proxy guard so assign writes a plain sched object.
    delete S.__schedPropGuard;
    delete S.__tmpSchedGuardWrapped;
    const desc=Object.getOwnPropertyDescriptor(S,'sched');
    if(desc&&(desc.get||desc.set)){
      Object.defineProperty(S,'sched',{value:{},writable:true,configurable:true,enumerable:true});
    }
  }catch(_){}

  // Prefer field restore over wipe-all-keys — deleting every key on S can leave
  // a broken empty state when sched was previously a defineProperty accessor.
  try{
    Object.keys(clean).forEach(k=>{
      if(k==='sched') return;
      try{S[k]=clean[k];}catch(_){}
    });
  }catch(_){
    try{Object.assign(S,clean);}catch(__){}
  }
  try{
    const plainSched=Object.assign(Object.create(null), (clean.sched&&typeof clean.sched==='object')?clean.sched:{});
    Object.defineProperty(S,'sched',{value:plainSched,writable:true,configurable:true,enumerable:true});
  }catch(_){
    S.sched=(clean.sched&&typeof clean.sched==='object')?Object.assign({},clean.sched):{};
  }
  if(!S.sched||typeof S.sched!=='object')S.sched={};
  if(!S.tit||typeof S.tit!=='object')S.tit={};
  if(!Array.isArray(S.packages))S.packages=[];
  if(!Array.isArray(S.vits))S.vits=[];
  if(!Array.isArray(S.vitsLog))S.vitsLog=[];
  if(!Array.isArray(S.rx))S.rx=[];
  if(!Array.isArray(S.rxLog))S.rxLog=[];
  if(!Array.isArray(S.vitals))S.vitals=[];if(typeof S.vitalsUnit!=='string')S.vitalsUnit='imperial';if(typeof S.nVit!=='number'||S.nVit<1)S.nVit=1;
  if(!Array.isArray(S.inv))S.inv=[];
  if(!Array.isArray(S.vials))S.vials=[];
  if(!Array.isArray(S.stackPlan))S.stackPlan=[];
  try{localStorage.setItem('tmp.stackPlan.v1',JSON.stringify(S.stackPlan));}catch(_){}
  if(typeof S.nV!=='number'||S.nV<1)S.nV=1;
  if(!Array.isArray(S.vendors)||!S.vendors.length)S.vendors=[...VENDORS_DEF];
  if(!S.prices||typeof S.prices!=='object')S.prices=JSON.parse(JSON.stringify(PRICE_DATA_DEF));
  migrateInventoryToVials();
  (S.inv||[]).forEach(it=>{if(!it.isSupply&&!it.isBlend)recomputeStockFromVials(it.name);});
  try{
    const vs=g('vl-search');if(vs)vs.value='';
    const vl=g('vl-filter-loc');if(vl)vl.value='';
    const vp=g('vl-filter-pep');if(vp)vp.value='';
  }catch(_){}
  // Always re-seed supplies after an import — canonical list may have grown since the backup.
  seedSupplies();
  S._supplies_seeded=true;
  S._mig=true;
  S._hadSaved=true;
  // If something re-marks the lock before save finishes, allow imported names.
  try{
    if(window.tmpCalClearGuard&&tmpCalClearGuard.isActive()){
      const names=(S.inv||[]).map(i=>i&&i.name).filter(Boolean);
      Object.keys(S.sched||{}).forEach(k=>{
        const n=String(k||'').split('/')[0];
        if(n) names.push(n);
      });
      names.forEach(n=>{try{tmpCalClearGuard.allowName(n);}catch(_){}});
    }
  }catch(_){}
  // CRITICAL: saveNow() calls reconcileFromDisk() before writing. If the imported
  // backup has an older/missing _saveRev than what's already in localStorage,
  // reconcile would overwrite the import with the previous (often empty) state.
  // Bump rev above disk so the imported data always wins this flush.
  try{
    const diskRaw=localStorage.getItem('peptide_tracker');
    const disk=diskRaw?JSON.parse(diskRaw):null;
    const diskRev=Number(disk&&disk._saveRev)||0;
    const importRev=Number(S._saveRev)||0;
    S._saveRev=Math.max(diskRev,importRev)+1;
  }catch(_){S._saveRev=(Number(S._saveRev)||0)+1;}
  try{
    saveNow(); // must be synchronous: the verify below reads localStorage right back
    // If save hooks still stripped sched, force-write the imported schedule.
    if(importSchedN>0){
      let diskSchedN=0;
      try{
        const v=JSON.parse(localStorage.getItem('peptide_tracker')||'null');
        diskSchedN=Object.keys((v&&v.sched)||{}).filter(k=>{
          const x=v.sched[k];
          return x===true||(x&&typeof x==='object');
        }).length;
      }catch(_){}
      if(diskSchedN<importSchedN){
        try{if(window.tmpCalClearGuard)tmpCalClearGuard.clear();}catch(_){}
        try{
          const plainSched=Object.assign(Object.create(null), clean.sched||{});
          Object.defineProperty(S,'sched',{value:plainSched,writable:true,configurable:true,enumerable:true});
        }catch(_){S.sched=Object.assign({},clean.sched||{});}
        S._saveRev=(Number(S._saveRev)||0)+1;
        try{localStorage.setItem('peptide_tracker',JSON.stringify(S));}catch(_){}
      }
    }
  }finally{
    // Keep bypass through first calendar paint, then release.
    try{
      setTimeout(function(){try{window._tmpBypassCalEnforce=false;}catch(_){}},400);
    }catch(_){try{window._tmpBypassCalEnforce=false;}catch(__){}}
  }
  const verifyRaw=localStorage.getItem('peptide_tracker');
  let verified=false;
  try{
    const v=verifyRaw?JSON.parse(verifyRaw):null;
    verified=!!(v&&Array.isArray(v.inv)&&v.inv.length===S.inv.length);
  }catch(_){verified=!!(verifyRaw&&verifyRaw.length>100);}
  try{
    rebuildCM();buildLegend();popSel();
    renderInv(true);
    renderVials(true);
    try{if(typeof renderLog==='function')renderLog();}catch(_){}
    try{if(typeof renderStack==='function')renderStack();}catch(_){}
    try{if(typeof renderCal==='function')renderCal({force:true});}catch(_){}
    rr();
    // Land on Weekly Calendar so imported schedule is obvious.
    try{
      const calBtn=document.querySelector('#nav [data-pg="calendar"]');
      if(calBtn)calBtn.click();
      setTimeout(function(){
        try{if(typeof renderCal==='function')renderCal({force:true});}catch(_){}
      },80);
    }catch(_){}
  }catch(err){console.error('Render after import:',err);}
  const loadedVialN=(S.vials||[]).length;
  const loadedShotN=(S.shots||[]).length;
  let loadedSchedN=0;
  try{
    loadedSchedN=Object.keys(S.sched||{}).filter(k=>{
      const v=S.sched[k];
      return v===true||(v&&typeof v==='object');
    }).length;
  }catch(_){}
  if(verified){
    alert('Import complete! '+S.inv.length+' inventory items'+(loadedVialN?' + '+loadedVialN+' vials':'')+(loadedShotN?' + '+loadedShotN+' shots':'')+(loadedSchedN?' + '+loadedSchedN+' calendar slots':'')+' loaded and saved.');
  }else{
    alert('⚠️ Import loaded in memory but browser save verify failed. Try Import again, or use a different browser. (Inventory now shows what was loaded.)');
  }
  clearLgSiteUserPicked();
  clearLgSiteScratchStorage();
  clearIn();
}
function load(){
  clearLgSiteUserPicked();
  S._hadSaved=false;
  try{
    const raw=localStorage.getItem('peptide_tracker');
    if(raw){
      const p=JSON.parse(raw);
      // Restore any saved state that looks valid — don't require non-empty inventory.
      // An empty-but-structured save is still valid (user could have deleted everything).
      // Previously required p.inv.length>0 which silently discarded imports with zero items.
      if(p&&typeof p==='object'){
        // Coerce inv to array if it arrived as an object (some older exports had this)
        if(p.inv&&!Array.isArray(p.inv)){
          try{p.inv=Object.values(p.inv).filter(x=>x&&typeof x==='object');}catch(e){p.inv=[];}
        }
        if(!Array.isArray(p.inv))p.inv=[];
        Object.assign(S,p);
        S._hadSaved=true;
        // One-time migrations that should only run if this user has never been migrated
        if(!S._mig){
          // Migrate: ensure stack peptides are in inventory (for users predating the stack-in-inventory change)
          const STACK_PEPS=[{id:24,name:'Cyp',dose:0,doseUnit:'mcg'},{id:25,name:'Klo',dose:2,doseUnit:'mg'},{id:26,name:'Ipa',dose:1.5,doseUnit:'mg'},{id:27,name:'Anastraz',dose:0,doseUnit:'mcg'},{id:28,name:'Reta',dose:1.5,doseUnit:'mg'},{id:29,name:'Tesa',dose:2,doseUnit:'mg'},{id:30,name:'DSIP',dose:250,doseUnit:'mcg'}];
          STACK_PEPS.forEach(p=>{
            if(!S.inv.find(i=>i.name===p.name)){
              S.inv.unshift({id:p.id,name:p.name,fz:0,fr:0,dk:0,nd:0,cn:'',us:'',dose:p.dose,doseUnit:p.doseUnit,days:[]});
            }
          });
          if(S.nI<31)S.nI=31;
          // Migrate: convert any saved 4-digit mcg doses (>=1000) to mg
          S.inv.forEach(i=>{
            if((!i.doseUnit||i.doseUnit==='mcg')&&i.dose>=1000){
              i.dose=Math.round(i.dose/100)/10;
              i.doseUnit='mg';
            }
          });
          if(!S.sched){
            S.sched={};
            const am=S.amStack||AM_ST_DEF;
            const pm=S.pmStack||PM_ST_DEF;
            am.forEach(row=>row.s.forEach((v,di)=>{if(v)S.sched[sk(row.n,'am',di)]=true;}));
            pm.forEach(row=>row.s.forEach((v,di)=>{if(v)S.sched[sk(row.n,'pm',di)]=true;}));
            if(S.ov){
              Object.entries(S.ov).forEach(([key,ov])=>{
                let name,origTime;
                if(key.endsWith('_am')){name=key.slice(0,-3);origTime='am';}
                else if(key.endsWith('_pm')){name=key.slice(0,-3);origTime='pm';}
                else return;
                if(ov.removed){for(let di=0;di<7;di++)delete S.sched[sk(name,origTime,di)];}
                else{for(let di=0;di<7;di++)delete S.sched[sk(name,origTime,di)];ov.days.forEach(di=>{S.sched[sk(name,ov.time||origTime,di)]=true;});}
              });
            }
          }
          if(!S.sched)S.sched={};
          S._mig=true;
          // Persist immediately so migrations never run again for this user
          try{localStorage.setItem('peptide_tracker',JSON.stringify(S));}catch(e){}
        }
      }
    }
  }catch(e){console.error(e);}
  if(!S.sched)S.sched={};
  if(!S.tit)S.tit={};
  if(!Array.isArray(S.packages))S.packages=[];
  if(!Array.isArray(S.vits))S.vits=[];
  if(!Array.isArray(S.vitsLog))S.vitsLog=[];
  if(!Array.isArray(S.rx))S.rx=[];
  if(!Array.isArray(S.rxLog))S.rxLog=[];
  if(!Array.isArray(S.vitals))S.vitals=[];if(typeof S.vitalsUnit!=='string')S.vitalsUnit='imperial';if(typeof S.nVit!=='number'||S.nVit<1)S.nVit=1;
  if(!Array.isArray(S.inv))S.inv=[];
  if(!Array.isArray(S.vendors)||!S.vendors.length)S.vendors=[...VENDORS_DEF];  if(!S.prices||typeof S.prices!=='object')S.prices=JSON.parse(JSON.stringify(PRICE_DATA_DEF));
  // Ensure the canonical supply rows always exist. Idempotent — safe to re-run on every load,
  // so users seeded before pads were added will get a pads row next time they open the app.
  seedSupplies();
  S._supplies_seeded=true;
  // One-time cleanup: users who had manually-created "SQ Pins"/"IM Pins"/"BAC Water"/"Alcohol Pads"
  // rows before the supply system existed now have duplicates. Migrate their counts
  // into the official supply rows and remove the old ones. Runs once per user.
  if(!S._supply_dupes_cleaned_v3){
    const migrate=(oldName,supplyKind)=>{
      const old=S.inv.find(i=>!i.isSupply&&(i.name||'').toLowerCase()===oldName.toLowerCase());
      if(!old)return;
      const supply=S.inv.find(x=>x.isSupply&&x.supplyKind===supplyKind);
      if(supply){
        // Sum all location counts from the old row into the supply's desk (the unified count).
        const total=(+old.fz||0)+(+old.fr||0)+(+old.dk||0);
        supply.dk=(supply.dk||0)+total;
      }
      // Remove the old duplicate row
      S.inv=S.inv.filter(i=>i!==old);
    };
    // Normalized matcher — trims and lowercases both sides so rows like "Alcohol Pads "
    // or "alcohol pads" still match. Strips common suffix variations.
    const migrateLoose=(patterns,supplyKind)=>{
      const norm=s=>(s||'').toLowerCase().replace(/\s+/g,' ').trim();
      const supply=S.inv.find(x=>x.isSupply&&x.supplyKind===supplyKind);
      const matches=S.inv.filter(i=>!i.isSupply&&patterns.some(p=>norm(i.name)===norm(p)));
      matches.forEach(old=>{
        if(supply){
          // Sum EVERY numeric field — users may have stored counts in any of the
          // location columns (freezer/fridge/desk) or even the need-to-buy column
          // depending on how they thought about the row.
          const total=(+old.fz||0)+(+old.fr||0)+(+old.dk||0)+(+old.nd||0);
          supply.dk=(supply.dk||0)+total;
        }
        S.inv=S.inv.filter(i=>i!==old);
      });
    };
    migrateLoose(['SQ Pins','SQ Pin','SQ pins'],'sq');
    migrateLoose(['IM Pins','IM Pin','IM pins'],'im');
    migrateLoose(['BAC Water','BAC water','Bac water'],'bac');
    migrateLoose(['Alcohol Pads','Alcohol Pad','alcohol pad'],'pad');
    S._supply_dupes_cleaned_v3=true;
  }
  // One-time recovery: the v3 supply-dupe migration missed the "Need to buy" column
  // when summing old custom supply rows, so some users who stored counts there lost them.
  // This ONLY applies to users who already had saved data (i.e. were affected by v3);
  // brand-new users must not receive 150 phantom pads they never added.
  if(!S._alcohol_pads_recovery){
    if(S._hadSaved){
      const pad=S.inv.find(x=>x.isSupply&&x.supplyKind==='pad');
      if(pad&&(pad.dk||0)===0){
        pad.dk=150;
      }
    }
    S._alcohol_pads_recovery=true;
  }
  // One-time: flag existing supply rows with isPeptide:false so the Log Shot
  // dropdown filter excludes them. New rows get this set in seedSupplies()
  // and the form, but pre-existing user data needs a backfill. Idempotent.
  if(!S._isPeptide_backfill_v1){
    (S.inv||[]).forEach(it=>{
      if(it.isSupply&&it.isPeptide===undefined)it.isPeptide=false;
    });
    S._isPeptide_backfill_v1=true;
  }
  // One-time: convert legacy fz/fr/dk bucket counts into per-vial rows.
  // Idempotent via S._vialMigration_v1. Safe to call on every load.
  if(!Array.isArray(S.vials))S.vials=[];
  if(typeof S.nV!=='number'||S.nV<1)S.nV=1;
  migrateInventoryToVials();
  // After migration, recompute stock counts on every peptide so the legacy
  // fz/fr/dk fields and the vial array agree. (No-op for items with no vials.)
  (S.inv||[]).forEach(it=>{if(!it.isSupply&&!it.isBlend)recomputeStockFromVials(it.name);});
  // RC-2: wkOff ownership normalization.
  // Always open at the current week on reload. wkOff in localStorage reflects
  // wherever the user was navigating when an unrelated save() last fired —
  // that implicit persistence is the root cause of "calendar changes on its own."
  // Resetting here makes reload behavior deterministic and explicit.
  // Within-session navigation (btn-prev/btn-next) still works; only the
  // cross-reload persistence of wkOff is neutralized.
  S.wkOff=0;
  rebuildCM();
}
const __TMP_ORIGIN__='peptidegenius.net/v1/TMP-2026Q2-a7f3d9e2';
function showSaved(){const el=g('save-ind');if(!el)return;el.textContent='✓ Saved';el.style.color='';el.style.opacity='1';el.setAttribute('data-origin',__TMP_ORIGIN__);clearTimeout(saveTimer);saveTimer=setTimeout(()=>{el.style.opacity='0';},2000);}
function showSaveFailed(){
  const el=g('save-ind');
  if(el){el.textContent='⚠ Save failed';el.style.color='var(--accent-red-fg,#DC2626)';el.style.opacity='1';clearTimeout(saveTimer);saveTimer=setTimeout(()=>{el.style.opacity='0';el.style.color='';},4000);}
  try{window.tmpInventoryToast&&window.tmpInventoryToast('⚠ Save failed — storage may be full. Export a backup now.','red',6000);}catch(_){}
}

// ---- Price import (PDF) mode ----
// Backup/import: triple‑tap syringe logo. Optional PDF price import is off by default so the page
// stays lighter; unlock with ?ptx=1 once (stored as pt_xtr). Legacy ?owner / pt_owner
// still work but are normalized away with no UI text referring to them.
const HAS_PRICE_IMPORT=(()=>{
  try{
    if(localStorage.getItem('pt_owner')==='1'){
      localStorage.setItem('pt_xtr','1');
      localStorage.removeItem('pt_owner');
    }
    const q=new URLSearchParams(window.location.search);
    if(q.has('ptx')||q.has('owner'))return true;
    if(localStorage.getItem('pt_xtr')==='1')return true;
  }catch(e){}
  return false;
})();

/* ============================================================
   SECTION: UI Banners & DOM Helpers
   Host/storage warning banners, date formatters, price panel
   layout, and the g()/sv()/gv() DOM shortcut helpers used
   everywhere downstream.
   ============================================================ */

// Storage-context banner: persistent warning when running from a local file
// (where data is fragile across downloads) or in private/incognito mode.
// Respects a 24h dismiss flag via sessionStorage so it's not nagging every render.
// Soft banner shown when the page is served from a host not on our allow-list.
// The watermark IIFE at the top of this file sets window.__TMP_HOST_OK__; this reads it
// and surfaces a dismissible notice so the flag actually does something, rather than
// sitting as dead data. App keeps working either way — this is informational only.
function applyHostBanner(){
  try{
    if(window.__TMP_HOST_OK__!==false)return;
    if(sessionStorage.getItem('tmp_host_banner_dismissed')==='1')return;
    const host=(location.hostname||'(unknown)').toLowerCase();
    const bar=document.createElement('div');
    bar.id='tmp-host-banner';
    bar.style.cssText='margin:0 0 12px;padding:10px 14px;background:var(--info-amber-bg);border:1px solid var(--info-amber-border);border-radius:10px;color:var(--info-amber-fg2);font-size:12px;display:flex;align-items:center;gap:10px;line-height:1.5';
    bar.innerHTML='<span style="font-size:16px;flex-shrink:0">ℹ️</span>'
      +'<span style="flex:1">This copy of PeptideGenius is running on <code>'+escH(host)+'</code>, which isn\'t one of the recognised hosts. The app still works locally — no data leaves your device. If this is an unofficial mirror, the canonical version lives at <a href="https://peptidegenius.net" style="color:var(--info-amber-fg);text-decoration:underline">peptidegenius.net</a>.</span>'
      +'<button class="btn" type="button" style="padding:3px 10px;font-size:11px;flex-shrink:0">Dismiss</button>';
    bar.querySelector('button').addEventListener('click',()=>{
      try{sessionStorage.setItem('tmp_host_banner_dismissed','1');}catch(e){}
      bar.remove();
    });
    // Insert ahead of the storage banner / nav so it's visible immediately.
    const app=document.querySelector('.app');
    const nav=document.getElementById('nav');
    if(app&&nav)app.insertBefore(bar,nav);
    else if(app)app.insertBefore(bar,app.firstChild);
  }catch(e){/* never break the app over a decorative banner */}
}

function applyStorageBanner(){
  const banner=g('storage-banner');
  if(!banner)return;
  // Wire the two buttons exactly once, now that the DOM element exists.
  if(!banner._wired){
    banner._wired=true;
    const backupBtn=g('sb-backup');
    const dismissBtn=g('sb-dismiss');
    if(backupBtn)backupBtn.addEventListener('click',()=>{
      if(typeof window.doExport==='function')window.doExport('peptide-tracker-backup-');
      else alert('Backup unavailable — please reload and try again.');
    });
    if(dismissBtn)dismissBtn.addEventListener('click',()=>{
      const twentyFourHours=24*60*60*1000;
      try{sessionStorage.setItem('sb_dismissed_until',String(Date.now()+twentyFourHours));}catch(e){}
      banner.style.display='none';
    });
  }
  // Never show on the deployed site — the whole point is to guide users off file://
  try{
    const proto=(location.protocol||'').toLowerCase();
    const isFile=proto==='file:';
    let isPrivate=false;
    try{localStorage.setItem('__tmp_probe__','1');localStorage.removeItem('__tmp_probe__');}catch(e){isPrivate=true;}
    const dismissedUntil=parseInt(sessionStorage.getItem('sb_dismissed_until')||'0',10);
    const dismissed=dismissedUntil&&Date.now()<dismissedUntil;
    if((isFile||isPrivate)&&!dismissed){
      if(isPrivate&&!isFile){
        const title=banner.querySelector('div[style*="font-weight:700"]');
        const body=banner.querySelectorAll('div[style*="font-size:12px"]')[0];
        if(title)title.textContent='Private browsing detected — your data will be lost when you close this window';
        if(body)body.innerHTML='Incognito / private mode doesn\'t keep data between sessions. <b>Click "💾 Backup now" to save a JSON file before you close the tab.</b> Or switch to a normal browser window.';
      }
      banner.style.display='';
    }else{
      banner.style.display='none';
    }
  }catch(e){banner.style.display='none';}
}

// PWA install banner — prompts the user to add PeptideGenius to their home
// screen. On Chromium browsers we can't show it until `beforeinstallprompt`
// has fired (the browser gates installability on engagement signals). On iOS
// Safari the event never fires, so we detect iOS and show a manual-instructions
// variant instead. Hidden entirely once the app is running in standalone
// (already installed) or if the user dismissed it within the last 14 days.
function applyInstallBanner(){
  const banner=g('install-banner');
  if(!banner)return;
  // Wire buttons exactly once per page load
  if(!banner._wired){
    banner._wired=true;
    const installBtn=g('ib-install');
    const dismissBtn=g('ib-dismiss');
    if(installBtn)installBtn.addEventListener('click',()=>{
      if(_pwaPrompt){
        _pwaPrompt.prompt();
        _pwaPrompt.userChoice.then(()=>{_pwaPrompt=null;banner.style.display='none';});
      }else{
        // iOS path — no install event, so we surface instructions in place
        const body=g('ib-body');
        if(body)body.innerHTML='On iPhone/iPad: tap the <b>Share</b> icon <span aria-hidden="true">⎘</span> at the bottom of Safari, then <b>Add to Home Screen</b>. The app will appear on your home screen like a native app, and your data stays on this device.';
        if(installBtn)installBtn.style.display='none';
      }
    });
    if(dismissBtn)dismissBtn.addEventListener('click',()=>{
      const fourteenDays=14*24*60*60*1000;
      try{localStorage.setItem('ib_dismissed_until',String(Date.now()+fourteenDays));}catch(e){}
      banner.style.display='none';
    });
  }
  try{
    // Don't nag if already running as installed PWA
    const standalone=(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||window.navigator.standalone===true;
    if(standalone){banner.style.display='none';return;}
    // Respect prior dismissal
    const dismissedUntil=parseInt(localStorage.getItem('ib_dismissed_until')||'0',10);
    if(dismissedUntil&&Date.now()<dismissedUntil){banner.style.display='none';return;}
    // iOS Safari detection — no beforeinstallprompt, but still installable via Share sheet
    const ua=navigator.userAgent||'';
    const isIos=/iPad|iPhone|iPod/.test(ua)&&!window.MSStream;
    const isSafari=/Safari/.test(ua)&&!/CriOS|FxiOS|EdgiOS/.test(ua);
    if(isIos&&isSafari){
      g('ib-title').textContent='Add to Home Screen';
      g('ib-body').textContent='Install PeptideGenius for one-tap access — your data stays on this device. Tap Install for instructions.';
      banner.style.display='';
      return;
    }
    // Chromium path — show only once the browser has told us it's installable
    if(_pwaPrompt){
      banner.style.display='';
    }else{
      banner.style.display='none';
    }
  }catch(e){banner.style.display='none';}
}

// PDF price import is optional (heavier); backup / restore is always available.
function applyPricesLayout(){
  const pdfSec=g('pi-pdf-section');
  const textHint=g('pi-text-hint');
  const pkgBackup=g('pkg-export-btn');
  if(HAS_PRICE_IMPORT){
    if(pdfSec)pdfSec.style.display='';
    if(textHint)textHint.textContent='(paste the vendor\'s price list text)';
  }else{
    if(pdfSec)pdfSec.style.display='none';
    if(textHint)textHint.textContent='(paste the vendor\'s price list text)';
  }
  if(pkgBackup)pkgBackup.style.display='';
}

const td=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
function wkD(o){const n=new Date();n.setHours(0,0,0,0);const m=new Date(n);m.setDate(n.getDate()-((n.getDay()+6)%7)+o*7);return Array.from({length:7},(_,i)=>{const d=new Date(m);d.setDate(m.getDate()+i);return d;});}
const fmD=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const fmMD=d=>d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
const fmFull=ds=>new Date(ds+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});
function normalizeIsoDate(raw){
  if(raw==null||raw==='')return '';
  const s=String(raw).trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  const us=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(us)return us[3]+'-'+String(us[1]).padStart(2,'0')+'-'+String(us[2]).padStart(2,'0');
  const d=new Date(s.includes('T')?s:s+'T12:00:00');
  if(!isNaN(d.getTime()))return fmD(d);
  return s;
}
function shotBucketTime(shot){
  const t=String((shot&&shot.time)||'').toLowerCase();
  if(t==='am'||t==='pm')return t;
  if(shot&&shot.timeStr){
    const m=String(shot.timeStr).match(/^(\d{1,2}):/);
    if(m)return parseInt(m[1],10)<12?'am':'pm';
  }
  if(t==='morning'||t==='breakfast'||t==='lunch')return 'am';
  if(t==='evening'||t==='dinner'||t==='bedtime'||t==='night')return 'pm';
  const hr=new Date().getHours();
  return hr<13?'am':'pm';
}
function readFocusDate(){
  try{
    const v=window._tmpFocusDate||localStorage.getItem('tmp.focusDate')||'';
    return v?normalizeIsoDate(v):'';
  }catch(_){return window._tmpFocusDate?normalizeIsoDate(window._tmpFocusDate):'';}
}
function focusDateWeekOffset(iso){
  const d=new Date(iso+'T12:00:00');
  if(isNaN(d.getTime()))return null;
  const now=new Date();now.setHours(0,0,0,0);
  const thisMon=new Date(now);thisMon.setDate(now.getDate()-((now.getDay()+6)%7));
  const targMon=new Date(d);targMon.setDate(d.getDate()-((d.getDay()+6)%7));
  return Math.round((targMon-thisMon)/(86400000*7));
}
function logEditModalOpen(){
  const m=g('log-edit-modal');
  return !!(m&&(m.getAttribute('aria-hidden')==='false'||m.style.display==='flex'));
}

function clearFocusDate(){
  window._tmpFocusDate=null;
  try{localStorage.removeItem('tmp.focusDate');}catch(_){}
  try{document.querySelectorAll('.shdc-focused').forEach(el=>el.classList.remove('shdc-focused'));}catch(_){}
  try{renderLogShotRows();}catch(_){}
  try{if(typeof renderLog==='function')renderLog({formOnly:true});}catch(_){}
  try{renderInv(true);}catch(_){}
  try{renderVials(true);}catch(_){}
  try{renderCal({force:true});}catch(_){}
}
window.clearFocusDate=clearFocusDate;
function setFocusDate(iso){
  const norm=iso?normalizeIsoDate(iso):'';
  window._tmpFocusDate=norm||null;
  try{
    if(norm)localStorage.setItem('tmp.focusDate',norm);
    else localStorage.removeItem('tmp.focusDate');
  }catch(_){}
  if(norm){
    const wo=focusDateWeekOffset(norm);
    if(wo!=null&&S.wkOff!==wo){ S.wkOff=wo; try{save();}catch(_){} }
  }
  applyFocusDateToForms(norm);
  try{renderLogShotRows();}catch(_){}
  try{renderInv(true);}catch(_){}
  try{renderVials(true);}catch(_){}
  try{renderCal({force:true});}catch(_){}
}
function _setDateInput(el,iso){
  if(!el||!iso)return;
  window._dateInputSilent=true;
  el.value=iso;
  try{el.dispatchEvent(new Event('input',{bubbles:true}));}catch(_){}
  try{el.dispatchEvent(new Event('change',{bubbles:true}));}catch(_){}
  window._dateInputSilent=false;
}
function goToShotLogPage(){
  const pg=g('pg-log');
  if(pg&&pg.style.display!=='none') return;
  const btn=document.querySelector('#nav [data-pg="log"], .hdr-tab-btn[data-pg="log"]');
  if(btn) btn.click();
}
function applyFocusDateToForms(iso){
  if(!iso)return;
  _setDateInput(g('lg-date'),iso);
  try{const lg=g('lg-date');if(lg)lg.dispatchEvent(new Event('input',{bubbles:true}));}catch(_){}
  const leEl=g('le-date');
  if(leEl&&!window._leDateUserEdited&&(logEditModalOpen()||g('log-edit-modal')?.style.display==='flex')) _setDateInput(leEl,iso);
  const fMove=g('f-move');
  if(fMove&&fMove.style.display==='block'){
    const fmLog=g('fm-logged');
    const fmSched=g('fm-sched');
    if(fmLog&&fmLog.style.display!=='none') sv('m-date',iso);
    else if(fmSched&&fmSched.style.display!=='none'){
      const d=new Date(iso+'T12:00:00');
      if(!isNaN(d.getTime())) sv('ms-day',String((d.getDay()+6)%7));
    }
  }
}
function peptidesWithShotsOnDate(iso){
  const set=new Set();
  (S.shots||[]).forEach(s=>{
    if(!s||!s.peptide)return;
    if(normalizeIsoDate(s.date)===iso)set.add(s.peptide);
  });
  return set;
}
function invItemRelevantToFocusDate(item,iso){
  if(!item||!iso)return true;
  if(peptidesWithShotsOnDate(iso).has(item.name))return true;
  if(normalizeIsoDate(item.productionDate)===iso)return true;
  if(normalizeIsoDate(item.reconDate)===iso)return true;
  const d=new Date(iso+'T12:00:00');
  if(!isNaN(d.getTime())){
    const di=(d.getDay()+6)%7;
    if(S.sched[item.name+'/am/'+di]||S.sched[item.name+'/pm/'+di])return true;
  }
  return false;
}
window.readFocusDate=readFocusDate;
window.setFocusDate=setFocusDate;
window.applyFocusDateToForms=applyFocusDateToForms;
window.goToShotLogPage=goToShotLogPage;
window.normalizeIsoDate=normalizeIsoDate;
window.shotBucketTime=shotBucketTime;
const g=id=>document.getElementById(id);
const sv=(id,v)=>{const el=g(id);if(el)el.value=v;};
const gv=id=>{const el=g(id);return el?el.value:'';};
const wireId=(id,type,fn,opts)=>{const el=g(id);if(el)el.addEventListener(type,fn,opts);};

function buildSchedArr(n,days,dose){const txt=dose>0?n+' '+dose+'mcg':n;return Array.from({length:7},(_,i)=>days.includes(i)?txt:'');}

function buildLegend(){
  // Legend pill row removed; no-op. Left in place so existing call sites don't break.
}

function getSchedText(n,di,time){return S.sched[sk(n,time,di)]?schedDisplayTxt(n):null;}

/* ============================================================
   SECTION: Calendar & Action Popup
   The weekly calendar grid and the tap-a-cell action panel
   (Edit / Move / Delete a scheduled or logged dose). Includes
   the undo toast for dose deletions.
   ============================================================ */

// --- ACTION PANEL ---
function hideSubs(){['f-edit','f-move','f-del'].forEach(id=>g(id).style.display='none');}
function exportCalPdf(){
  try{renderCal({force:true});}catch(_){}
  try{if(typeof apClose==='function')apClose();}catch(_){}
  document.body.classList.add('tmp-cal-print');
  const cleanup=()=>document.body.classList.remove('tmp-cal-print');
  window.addEventListener('afterprint',cleanup,{once:true});
  setTimeout(cleanup,60000);
  setTimeout(()=>window.print(),80);
}
window.exportCalPdf=exportCalPdf;
function scrollCalActionPanel(id){
  const resolve=()=>{
    const edit=g('f-edit'),move=g('f-move'),del=g('f-del');
    if(edit&&getComputedStyle(edit).display!=='none')return edit;
    if(move&&getComputedStyle(move).display!=='none')return move;
    if(del&&getComputedStyle(del).display!=='none')return del;
    if(typeof id==='string')return g(id);
    return id||g('ap-body')||g('ap');
  };
  const topInset=()=>{
    let n=12;
    ['.app-header','#storage-banner','#install-banner','nav#nav','.top-bar'].forEach(sel=>{
      const el=document.querySelector(sel);
      if(!el)return;
      const h=el.getBoundingClientRect().height;
      if(h>0)n+=h+4;
    });
    return n;
  };
  const run=()=>{
    const el=resolve();
    if(!el)return;
    const inset=topInset();
    try{
      const y=el.getBoundingClientRect().top+window.scrollY-inset;
      window.scrollTo({top:Math.max(0,y),behavior:'smooth'});
    }catch(_){
      try{el.scrollIntoView({behavior:'smooth',block:'start'});}catch(__){
        try{el.scrollIntoView({block:'start'});}catch(___){}
      }
    }
  };
  requestAnimationFrame(run);
  setTimeout(run,60);
  setTimeout(run,220);
  setTimeout(run,480);
  setTimeout(run,800);
}
window.scrollCalActionPanel=scrollCalActionPanel;
function showTiles(){g('ap-tiles').style.display='grid';g('ap-info').style.display='block';hideSubs();}
function apClose(){g('ap').style.cssText='border-radius:10px;padding:.4rem .75rem;margin-bottom:.5rem;background:var(--color-background-secondary)';g('ap-idle').style.display='block';g('ap-body').style.display='none';hideSubs();CUR=null;}

// --- STACK ACTION PANEL ---
// Tracks which peptide name the stack panel is currently showing actions for.
// Set by apShowStack and read by the four tile click handlers wired in init().
let CUR_STACK_PEP=null;
function apCloseStack(){
  const panel=g('aps');if(!panel)return;
  panel.style.display='none';
  panel.style.cssText='display:none';
  CUR_STACK_PEP=null;
}
function apShowStack(name){
  if(!name)return;
  const pep=(S.inv||[]).find(i=>!i.isSupply&&i.name===name);
  if(!pep)return;  // peptide not in inventory — nothing useful to offer
  CUR_STACK_PEP=name;
  const c=pepColor(name);
  const panel=g('aps');
  if(!panel)return;
  panel.style.cssText='border-radius:12px;padding:.875rem 1.25rem;margin-bottom:1rem;background:var(--color-background-primary);border:2px solid '+c.border;
  panel.style.display='block';
  g('aps-body').style.display='block';
  // Header: peptide name + a small info line summarizing dose / schedule status.
  const badge=g('aps-badge');
  badge.textContent=name;
  badge.style.cssText='font-size:11px;padding:3px 12px;border-radius:20px;font-weight:500;display:inline-block;margin-bottom:5px;background:'+c.bg+';color:'+c.text+';border:1px solid '+c.border;
  g('aps-nm').textContent=name;
  // Build a short summary: "Typical 250mcg · 🧊×2 in fridge" — a one-glance status check
  const bits=[];
  if(pep.dose>0)bits.push('Typical '+pep.dose+(pep.doseUnit||'mcg'));
  const fr=+pep.fr||0,fz=+pep.fz||0,dk=+pep.dk||0;
  if(fr>0)bits.push('🧊×'+fr+' in fridge');
  else if(fz>0)bits.push('❄ '+fz+' in freezer');
  else if(dk>0)bits.push('📦 '+dk+' on desk');
  else bits.push('out of stock');
  g('aps-dt').textContent=bits.join(' · ');
  scrollCalActionPanel(panel);
}
function apShow(ctx){
  CUR=ctx;const c=pepColor(ctx.name);
  g('ap').style.cssText='border-radius:12px;padding:.875rem 1.25rem;margin-bottom:1rem;background:var(--color-background-primary);border:2px solid '+c.border;
  g('ap-idle').style.display='none';g('ap-body').style.display='block';
  const am=ctx.time==='am';
  const badge=g('ap-badge');
  badge.textContent=ctx.name+' — '+(ctx.type==='logged'?(am?'AM logged':'PM logged'):(am?'AM scheduled':'PM scheduled'));
  badge.style.cssText='font-size:11px;padding:3px 12px;border-radius:20px;font-weight:500;display:inline-block;margin-bottom:5px;background:'+c.bg+';color:'+c.text+';border:1px solid '+c.border;
  g('ap-nm').style.cssText='font-size:16px;font-weight:500;color:var(--color-text-primary);margin-bottom:2px';g('ap-nm').textContent=ctx.name;
  g('ap-dt').style.cssText='font-size:12px;color:var(--color-text-secondary)';
  if(ctx.type==='logged'){
    const s=S.shots.find(x=>x.id===ctx.shotId);
    g('ap-dt').textContent=fmFull(ctx.date)+' · '+(am?'AM':'PM');
    g('ap-info').style.cssText='font-size:12px;color:var(--color-text-secondary);background:var(--color-background-secondary);border-radius:8px;padding:8px 12px;line-height:1.9';
    // Add "Units" (u100 syringe) alongside Vol for at-a-glance injection reference
    const uLogged=shotUnits(s);
    const unitsChip=uLogged!=null?' &nbsp;·&nbsp; <strong>Units:</strong> '+uLogged+'u':'';
    g('ap-info').innerHTML='<strong>Dose:</strong> '+(fmtDose(s.dose,s.doseUnit||'mcg')||s.dose+' '+(s.doseUnit||'mcg'))+((s.volumeUnit||'mL')==='pill'||(s.doseUnit||'')==='pill'?'':' &nbsp;·&nbsp; <strong>Vol:</strong> '+((s.volumeUnit||'mL')==='units'?Math.round(s.volume):s.volume.toFixed(2))+' '+(s.volumeUnit||'mL'))+unitsChip+' &nbsp;·&nbsp; <strong>Site:</strong> '+escH(siteDisplayName(s.site)||'')+(s.notes?'<br><strong>Notes:</strong> '+escH(s.notes):'');
  }else{
    const inv=S.inv.find(i=>i.name===ctx.name);
    g('ap-dt').textContent=fmFull(ctx.date)+' · '+(am?'AM scheduled':'PM scheduled');
    g('ap-info').style.cssText='font-size:12px;color:var(--color-text-secondary);background:var(--color-background-secondary);border-radius:8px;padding:8px 12px;line-height:1.9';
    const uSched=schedUnits(ctx.name);
    const unitsChipS=uSched!=null?' &nbsp;·&nbsp; <strong>Units:</strong> '+uSched+'u':'';
    g('ap-info').innerHTML='<strong>Day:</strong> '+DAYS[ctx.di]+'<br><strong>Dose:</strong> '+(inv&&inv.dose?fmtDose(inv.dose,inv.doseUnit)||inv.dose+(inv.doseUnit||'mcg'):'not set')+unitsChipS;
  }
  showTiles();
  // The "Log shot" tile only makes sense for scheduled cells that haven't been
  // logged yet — for already-logged cells, the user wants Edit/Move/Delete instead.
  const logTile=g('t-log');
  if(logTile)logTile.style.display=(ctx.type==='sched')?'':'none';
  scrollCalActionPanel('ap');
}
function doEdit(){
  const ctx=CUR;
  if(ctx.type==='logged'){const s=S.shots.find(x=>x.id===ctx.shotId);g('fe-logged').style.display='block';g('fe-sched').style.display='none';sv('e-dose',s.dose);sv('e-dose-unit',s.doseUnit||'mcg');sv('e-vol',s.volume);sv('e-vol-unit',s.volumeUnit||'mL');sv('e-time',s.time);
    // The e-site <select> is hardcoded with legacy human-named options (SQ Abdomen UL etc.).
    // New shots store site as a cell ID like "f-15" which won't match any existing option,
    // so we prepend a temp option for the cell first. Otherwise sv silently fails and the
    // user sees the wrong site selected when they open Edit.
    const eSite=g('e-site');
    if(eSite&&s.site){
      const existing=Array.from(eSite.options).find(o=>o.value===s.site);
      if(!existing){
        const cell=getSiteCell(s.site);
        const opt=document.createElement('option');
        opt.value=s.site;
        opt.textContent=cell?(cell.region.short+' #'+cell.number):s.site;
        eSite.insertBefore(opt,eSite.firstChild);
      }
    }
    sv('e-site',s.site||'SQ Abdomen');sv('e-notes',s.notes||'');}
  else{
    // RC-5: pre-populate with per-occurrence dose (override if set, else inv default).
    // Inventory is NOT read for writing — only for the initial display fallback.
    const occ=getOccurrenceDose(ctx.name,ctx.time,ctx.di);
    const hasOvr=S.sched[sk(ctx.name,ctx.time,ctx.di)]&&typeof S.sched[sk(ctx.name,ctx.time,ctx.di)]==='object';
    g('fe-logged').style.display='none';g('fe-sched').style.display='block';
    g('fe-hint').textContent=(hasOvr?'Custom dose active for this cell. ':'')+'Changes apply to this '+DAYS[ctx.di]+' '+(ctx.time==='am'?'AM':'PM')+' occurrence. Inventory default is unchanged.';
    sv('e-sdose',occ.dose||'');sv('e-sdu',occ.doseUnit||'mcg');sv('e-stime',ctx.time);
    const _ss=g('e-sscope');if(_ss)_ss.value='one';
  }
  g('e-msg').textContent='';g('ap-tiles').style.display='none';g('ap-info').style.display='none';hideSubs();g('f-edit').style.display='block';
  scrollCalActionPanel('f-edit');
}
function doMove(){
  const ctx=CUR;
  if(ctx.type==='logged'){const s=S.shots.find(x=>x.id===ctx.shotId);g('fm-logged').style.display='block';g('fm-sched').style.display='none';sv('m-date',normalizeIsoDate(s.date));sv('m-time',s.time);}
  else{
    g('fm-logged').style.display='none';g('fm-sched').style.display='block';
    sv('ms-day',String(ctx.di));sv('ms-time',ctx.time);
  }
  g('m-msg').textContent='';g('ap-tiles').style.display='none';g('ap-info').style.display='none';hideSubs();g('f-move').style.display='block';
  scrollCalActionPanel('f-move');
}
function doDel(){
  const ctx=CUR;
  const allBtn=g('del-confirm-all');
  if(ctx.type==='logged'){
    const s=S.shots.find(x=>x.id===ctx.shotId);
    g('del-warn').textContent='Remove logged shot: '+s.peptide+' on '+fmFull(s.date)+' ('+(fmtDose(s.dose,s.doseUnit||'mcg')||s.dose+' '+(s.doseUnit||'mcg'))+')? Cannot be undone.';
    if(allBtn){allBtn.style.display='none';}
  } else {
    // v4: count this peptide's scheduled cells across the week to inform the user.
    const prefix=ctx.name+'/';
    const total=Object.keys(S.sched||{}).filter(k=>k.indexOf(prefix)===0&&S.sched[k]).length;
    g('del-warn').textContent='Remove '+ctx.name+' from '+DAYS[ctx.di]+' '+(ctx.time==='am'?'AM':'PM')+'? Choose:\n  • Yes, delete — just this cell\n  • Delete all — every '+ctx.name+' scheduled cell ('+total+' total)';
    if(allBtn){
      if(total>1){
        allBtn.textContent='Delete all '+total+' '+ctx.name;
        allBtn.style.display='inline-flex';
      } else {
        allBtn.style.display='none';
      }
    }
  }
  g('ap-tiles').style.display='none';g('ap-info').style.display='none';hideSubs();g('f-del').style.display='block';
}
function saveEdit(){
  const ctx=CUR;const m=g('e-msg');
  if(ctx.type==='logged'){
    const s=S.shots.find(x=>x.id===ctx.shotId);
    const dose=parseFloat(gv('e-dose')),vol=parseFloat(gv('e-vol'));
    if(isNaN(dose)||isNaN(vol)){m.textContent='Enter dose & volume.';m.style.color='#A32D2D';return;}
    // Vial accounting: if this shot was tied to a vial, re-balance the deduction.
    // Old dose gets credited back, new dose gets debited. Any leftover at zero
    // re-marks the vial active (its previous depletion may have been wrong).
    // If the user changed peptide via the form (not currently exposed but the
    // field exists), we skip the rebalance to avoid debiting the wrong vial.
    if(s.vialId){
      const newUnit=gv('e-dose-unit')||'mcg';
      const oldMcg=doseToMcg(s.dose,s.doseUnit||'mcg');
      const newMcg=doseToMcg(dose,newUnit);
      const delta=newMcg-oldMcg;
      if(delta!==0){
        const v=S.vials.find(x=>x.id===s.vialId);
        if(v){
          v.remainingMcg=Math.max(0,Math.min(v.totalMcg,v.remainingMcg-delta));
          // Re-evaluate status. Active when there's anything left; depleted when zero.
          if(v.remainingMcg>0&&v.status==='depleted'){
            v.status='active';
            delete v.depletedDate;
          }else if(v.remainingMcg===0&&v.status==='active'){
            v.status='depleted';
            v.depletedDate=td();
          }
          recomputeStockFromVials(v.peptideName);
        }
      }
    }
    s.dose=dose;s.doseUnit=gv('e-dose-unit')||'mcg';s.volume=vol;s.volumeUnit=gv('e-vol-unit')||'mL';s.time=gv('e-time');s.site=gv('e-site');s.notes=gv('e-notes').trim();
  }
  else{
    // RC-5: write per-occurrence override; inventory default is NEVER touched.
    const dose=parseFloat(gv('e-sdose'))||0;
    const doseUnit=gv('e-sdu')||'mcg';
    const scope=(g('e-sscope')&&g('e-sscope').value)||'one';
    // dose===0 means user cleared the field — revert to inv default (val=true).
    const val=dose>0?{dose,doseUnit,_user:1}:true;
    if(scope==='similar'){
      // Apply override to every scheduled cell for this peptide at the same time slot.
      [0,1,2,3,4,5,6].forEach(d=>{
        if(schedCellActive(ctx.name,ctx.time,d)) writeOccurrenceDose(ctx.name,ctx.time,d,val);
      });
    }else{
      // This occurrence only — sync all lane aliases for this cell.
      writeOccurrenceDose(ctx.name,ctx.time,ctx.di,val);
    }
  }
  save();apClose();
  if(ctx.type==='logged'){
    refreshAfterShotChange();
    try{window.tmpInventoryToast('✓ Shot updated');}catch(_){}
  }else{
    refreshAfterSchedChange();
    if(!window.__tmpCalEditToastAt||Date.now()-window.__tmpCalEditToastAt>800){
      try{window.tmpInventoryToast('✓ Schedule updated');}catch(_){}
    }
  }
}
function saveMove(){
  const ctx=CUR;const m=g('m-msg');
  if(ctx.type==='logged'){const s=S.shots.find(x=>x.id===ctx.shotId);const date=gv('m-date');if(!date){m.textContent='Pick a date.';m.style.color='#A32D2D';return;}s.date=normalizeIsoDate(date);s.time=shotBucketTime({time:gv('m-time')});save();apClose();refreshAfterShotChange();try{window.tmpInventoryToast('✓ Shot date updated');}catch(_){}}
  else{
    // Per-cell move: suppress old cell, create new cell
    // RC-5: preserve any occurrence-level override when moving a cell.
    const _moveKey=sk(ctx.name,ctx.time,ctx.di);
    const _moveVal=S.sched[_moveKey]||true;
    // RC-D: use = false instead of delete. For interval-overlay cells
    // S.sched[_moveKey] does not exist so delete is a no-op — the original
    // day stays unsuppressed and the interval re-injects after render.
    // = false activates the === false suppression guard.
    S.sched[_moveKey]=false;
    const newDi=parseInt(gv('ms-day'));
    const rawLane=String(gv('ms-time')||'').toLowerCase();
    const newTime=schedTimeForKey(rawLane);
    S.sched[sk(ctx.name,newTime,newDi)]=_moveVal;
    try{
      const _mvInv=(S.inv||[]).find(i=>i&&i.name===ctx.name&&!i.isSupply);
      if(_mvInv&&MEAL_LANE_TO_TIME[rawLane])_mvInv.stackLane=rawLane;
    }catch(_){}
    save();apClose();renderCal();
    try { window.tmpInventoryToast('✓ Moved ' + ctx.name + ' to ' + ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][newDi] + ' ' + newTime.toUpperCase()); } catch(_){}
  }
}
function confirmDel(mode){
  // mode: 'one' (default, single cell) or 'all-sched' (delete every scheduled instance of ctx.name)
  const ctx=CUR;
  if(ctx&&ctx.type==='sched'&&!ctx.name) return;
  if(ctx.type==='logged'){
    const shot=S.shots.find(x=>x.id===ctx.shotId);
    const shotIdx=S.shots.indexOf(shot);
    // Credit the dose back to its vial, if the shot was tied to one. Mirrors
    // the debit done at log-time. If the vial was marked depleted by exactly
    // this dose, it becomes active again (it has remaining mcg now).
    if(shot&&shot.vialId){
      const v=S.vials.find(x=>x.id===shot.vialId);
      if(v){
        const mcg=doseToMcg(shot.dose,shot.doseUnit||'mcg');
        if(mcg>0){
          v.remainingMcg=Math.min(v.totalMcg,v.remainingMcg+mcg);
          if(v.remainingMcg>0&&v.status==='depleted'){
            v.status='active';
            delete v.depletedDate;
          }
          recomputeStockFromVials(v.peptideName);
        }
      }
    }
    S.shots=S.shots.filter(x=>x.id!==ctx.shotId);
    save();apClose();refreshAfterShotChange();
    showUndoToast(shot,shotIdx);
    // v33.375-stable-vendor-post-import-review: if we got here from the Shot log page, navigate back instead
    // of leaving the user stranded on the Weekly Calendar.
    try {
      if(window._delReturnPage){
        var pg = window._delReturnPage;
        window._delReturnPage = null;
        var navBtn = document.querySelector('#nav [data-pg="'+pg+'"]');
        if(navBtn){
          // Click the nav button so the standard page-swap + render flow runs
          setTimeout(function(){ navBtn.click(); }, 140);
        }
      }
    } catch(_){}
  } else if(mode==='all-sched'){
    // v4: remove every scheduled instance of this peptide. Schedule keys
    // in TMP look like `name/time/dayIndex` — match on `name/` prefix.
    const prefix=ctx.name+'/';
    // RC-4: snapshot deleted keys before mutation so undo can restore exactly.
    const _schedSnap={};
    // RC-5: capture actual sched value (true or {dose,doseUnit}) so undo restores occurrence overrides.
    Object.keys(S.sched||{}).forEach(k=>{if(k.indexOf(prefix)===0&&S.sched[k])_schedSnap[k]=S.sched[k];});
    // RC-A: use = false instead of delete so intervalOverlaysForWeek() === false
    // suppression guard fires. delete leaves key undefined (undefined !== false),
    // causing interval overlays to re-inject on next render.
    Object.keys(S.sched||{}).forEach(k=>{ if(k.indexOf(prefix)===0) S.sched[k]=false; });
    save();apClose();refreshAfterSchedChange();
    showSchedUndoToast('All '+ctx.name+' cells removed',_schedSnap);
  } else {
    // RC-4: snapshot the single deleted key before mutation.
    const _delKeys=schedKeysForCell(ctx.name,ctx.time,ctx.di);
    const _schedSnap={};
    _delKeys.forEach(k=>{if(S.sched[k])_schedSnap[k]=S.sched[k];});
    // Suppression ownership: set false on canonical am/pm AND meal-lane alias keys
    // (e.g. SK10/breakfast/0). Otherwise sanitizeMealLaneScheduleKeys resurrects
    // the cell from a surviving breakfast/lunch key after am/pm was suppressed.
    _delKeys.forEach(k=>{S.sched[k]=false;});
    save();apClose();refreshAfterSchedChange();
    showSchedUndoToast(ctx.name+' removed from '+DAYS[ctx.di]+' '+(ctx.time==='am'?'AM':'PM'),_schedSnap);
  }
}

// Single source of truth for "a shot was added / edited / moved / deleted —
// re-render everything that depends on shot history". Keeps all views in sync
// so the titration adherence badges and dose progression update immediately.
function refreshAfterShotChange(){
  try{
    const calPage=g('pg-calendar');
    const calVisible=calPage&&calPage.style.display!=='none';
    if(calVisible) renderCal&&renderCal({force:true});
  }catch(e){}
  try{refreshLogAfterShotChange();}catch(e){}
  try{renderStats&&renderStats();}catch(e){}
  try{renderIntervalDoses&&renderIntervalDoses();}catch(e){}
  try{renderTitList&&renderTitList();}catch(e){}
  try{renderStack&&renderStack();}catch(e){}
  try{tmpRenderInsights&&tmpRenderInsights();}catch(e){}  // v9
  try{tmpRenderCirculationTable&&tmpRenderCirculationTable();}catch(e){}  // v14b
  try{tmpRenderCirculationChart&&tmpRenderCirculationChart();}catch(e){}  // v14c
}
function refreshAfterSchedChange(){
  try{renderCal&&renderCal();}catch(e){}
  try{
    if(typeof window.__tmpPgDebounced==='function'){
      window.__tmpPgDebounced('renderStatsAfterSched',function(){try{renderStats&&renderStats();}catch(e){}},80);
    }else{
      setTimeout(function(){try{renderStats&&renderStats();}catch(e){}},80);
    }
  }catch(e){}
}

let _undoTimer=null;
function showUndoToast(shot,idx){
  if(_undoTimer){clearTimeout(_undoTimer);_undoTimer=null;}
  const toast=g('undo-toast');
  if(!toast)return;
  g('undo-msg').textContent=shot.peptide+' shot deleted.';
  toast.style.display='flex';
  toast.dataset.type='shot';
  toast.dataset.shot=JSON.stringify(shot);
  toast.dataset.idx=idx;
  delete toast.dataset.sched;
  _undoTimer=setTimeout(()=>{toast.style.display='none';},5000);
}
// RC-4: undo path for scheduled cell delete.
// Reuses the same undo-toast element. Snapshot contains only the deleted
// sched key(s) — not all of S.sched — so a restore never overwrites
// schedule entries the user added between delete and undo.
function showSchedUndoToast(label,snap){
  if(_undoTimer){clearTimeout(_undoTimer);_undoTimer=null;}
  const toast=g('undo-toast');
  if(!toast)return;
  const msg=g('undo-msg');if(msg)msg.textContent=label;
  toast.style.display='flex';
  toast.dataset.type='sched';
  toast.dataset.sched=JSON.stringify(snap);
  delete toast.dataset.shot;
  delete toast.dataset.idx;
  _undoTimer=setTimeout(()=>{toast.style.display='none';},5000);
}
function hideUndoToast(){
  if(_undoTimer){clearTimeout(_undoTimer);_undoTimer=null;}
  const toast=g('undo-toast');if(toast)toast.style.display='none';
}
function packRows(names,time){
  // Greedy bin packing with last-fit: search rows backward so same-day neighbours
  // end up paired together rather than scattered into the earliest available row
  const rows=[];
  for(const name of names){
    const days=[0,1,2,3,4,5,6].filter(di=>S.sched[sk(name,time,di)]);
    let placed=false;
    for(let i=rows.length-1;i>=0;i--){
      if(days.every(di=>!rows[i][di])){days.forEach(di=>rows[i][di]=name);placed=true;break;}
    }
    if(!placed){const r=[null,null,null,null,null,null,null];days.forEach(di=>r[di]=name);rows.push(r);}
  }
  return rows;
}
function renderCal(opts){
  // P1A: visibility guard — same ownership pattern as rr().
  // renderCal() is called from refreshAfterShotChange() and confirmDel()
  // without a page-visibility check. When the Calendar page is hidden,
  // all innerHTML teardowns, node rebuilds, and listener recreation are
  // wasted work. Return early; rr() will re-render when the user navigates
  // back to the calendar page. {force:true} bypasses for post-shot refresh.
  const _calPage=g('pg-calendar');
  if((!opts||!opts.force)&&_calPage&&_calPage.style.display==='none')return;
  const days=wkD(S.wkOff);
  g('wk-lbl').textContent=fmMD(days[0])+' – '+fmMD(days[6])+', '+days[0].getFullYear();
  const ts=td();
  const _focusIso=readFocusDate();
  const weekShotMap=new Map();
  (S.shots||[]).forEach(s=>{
    if(!s||!s.date||!s.peptide) return;
    weekShotMap.set(normalizeIsoDate(s.date)+'|'+shotBucketTime(s)+'|'+s.peptide,s);
  });
  // Rx-taken lookup — mirrors weekShotMap but for the weekly Rx card's log
  // (S.rxLog, written by the "Taken today" checkbox / + Log button). A calendar
  // cell whose name matches an Rx med gets a pill indicator on dates it was
  // taken. RX-NAME-PREFIX-R1: calendar names are often abbreviations of the Rx
  // name ("Fin" vs "Finasteride", "Min" vs "Minoxidil"), so match exact OR
  // prefix (≥3 chars) in either direction.
  // RX-NAME-TYPO-R1: also tolerate a single-character typo (edit distance ≤1)
  // for names ≥6 chars — e.g. a calendar cell saved as "Tadalifil" still
  // matches the Rx med "Tadalafil", so the Taken-today 💊 marker renders.
  // The ≥6 guard keeps short abbreviations ("Fin"/"Min") from cross-matching.
  const _rxNorm=s=>String(s==null?'':s).trim().toLowerCase();
  const _rxNearMatch=(a,b)=>{
    if(a.length<6||b.length<6)return false;
    if(Math.abs(a.length-b.length)>1)return false;
    let i=0,j=0,edits=0;
    while(i<a.length&&j<b.length){
      if(a[i]===b[j]){i++;j++;continue;}
      if(++edits>1)return false;
      if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++;}
    }
    return edits+(a.length-i)+(b.length-j)<=1;
  };
  const _rxNameMatch=(a,b)=>a===b||(a.length>=3&&b.length>=3&&(a.startsWith(b)||b.startsWith(a)))||_rxNearMatch(a,b);
  const weekRxTakenByDate=new Map();
  (S.rxLog||[]).forEach(e=>{
    if(!e||!e.date||!e.name) return;
    const d=normalizeIsoDate(e.date);
    if(!weekRxTakenByDate.has(d))weekRxTakenByDate.set(d,[]);
    weekRxTakenByDate.get(d).push(_rxNorm(e.name));
  });
  const rxTakenOn=(ds,name)=>{
    const list=weekRxTakenByDate.get(ds);
    if(!list)return false;
    const n=_rxNorm(name);
    return !!n&&list.some(x=>_rxNameMatch(x,n));
  };
  const _amIntervalOverlays=intervalOverlaysForWeek(days,'am');
  // RC-F: interval-managed peptides render via intervalOverlaysForWeek, NOT via
  // the day-of-week schedRowsBucket rows. But the "load from inventory" quick-add
  // (setItemMealSchedule) writes plain day-of-week keys (name/am|pm/di), so an
  // interval peptide added that way would render TWICE — once as a day-of-week
  // row and once as an interval overlay (often on a different day or am/pm rail,
  // which is why the overlay-name dedup guard can't catch it). Suppress the
  // day-of-week rows for any interval peptide that actually has an overlay this
  // week. When there's no interval anchor yet (no shots / cycleStart) there are
  // no overlays, so the day-of-week rows still show and nothing disappears.
  const _ovNormName=s=>String(s==null?'':s).trim().toLowerCase();
  const _ivOverlayNames=new Set(_amIntervalOverlays.map(o=>_ovNormName(o.name)));
  const _schedNamesByTime={am:new Set(),pm:new Set()};
  const _calInvNames=new Set((S.inv||[]).filter(i=>i&&i.name&&!i.isSupply&&!i.archived).map(i=>i.name));
  Object.keys(S.sched||{}).forEach(k=>{
    if(!S.sched[k]) return;
    const parts=k.split('/');
    if(parts.length<3) return;
    if(!_calInvNames.has(parts[0])) return;
    let t=parts[1];
    if(MEAL_LANE_TO_TIME[t]) t=MEAL_LANE_TO_TIME[t];
    if(t==='am'||t==='pm') _schedNamesByTime[t].add(parts[0]);
  });
  // v0.26.6: apply same immediate-glow logic as renderStack — today × current half-day
  const _calHr=new Date().getHours();
  const _calAmImmediate=_calHr<13;
  const _calIsImmediate=(time,isToday)=>isToday && ((time==='am')?_calAmImmediate:!_calAmImmediate);
  // Diagnostic badge — shows what hour the page believes it is + which half-day is "now".
  // If this disagrees with the user's clock, the immediate-glow will look wrong.
  try {
    const _nowBadge = (() => {
      const h12 = ((_calHr % 12) || 12);
      const ampm = _calAmImmediate ? 'AM' : 'PM';
      return ' · 🕘 ' + h12 + ' ' + ampm + ' (' + (_calAmImmediate ? 'AM' : 'PM') + ' active)';
    })();
    const lbl = g('wk-lbl');
    if(lbl){
      // Strip any prior badge before re-appending
      const baseTxt = lbl.textContent.split(' · 🕘 ')[0];
      lbl.textContent = baseTxt + _nowBadge;
    }
  } catch(_){}
  function buildHdr(id,time){
    const hdr=g(id);hdr.innerHTML='';
    const hdrCls=time==='am'?'today-hdr-am':'today-hdr';
    days.forEach((d,di)=>{
      const ds=fmD(d);
      const isToday=ds===ts;
      const isImm=_calIsImmediate(time,isToday);
      const isOtherTodayHalf=isToday && !isImm; // today's column on the non-immediate grid
      let cls='shdc';
      if(isToday) cls+=' '+hdrCls;
      if(isImm) cls+=' immediate-hdr';
      if(isOtherTodayHalf) cls+=' today-faded';
      if(_focusIso&&_focusIso===ds) cls+=' shdc-focused';
      const dc=document.createElement('button');
      dc.type='button';
      dc.className=cls;
      dc.dataset.date=ds;
      dc.innerHTML=DAYS[di]+'<br><span style="font-weight:400;font-size:9px">'+d.getDate()+'</span>';
      hdr.appendChild(dc);
    });
  }
  function calBucketFor(name,time){
    const nm=String(name||'').toLowerCase();
    let invItem=null;
    try{ invItem=(S.inv||[]).find(i=>i&&i.name===name&&!i.isSupply); }catch(_){ }
    const forced=String((invItem&&invItem.stackLane)||'').toLowerCase();
    const hasOnTime=[0,1,2,3,4,5,6].some(di=>schedCellActive(name,time,di));
    if(hasOnTime){
      for(const meal of (TIME_MEAL_LANES[time]||[])){
        if([0,1,2,3,4,5,6].some(di=>S.sched[sk(name,meal,di)])) return meal;
      }
      if((forced==='breakfast'||forced==='lunch')&&time==='am') return forced;
      if((forced==='dinner'||forced==='bedtime')&&time==='pm') return forced;
      if(forced==='breakfast'||forced==='lunch'||forced==='dinner'||forced==='bedtime'){
        const allowed=TIME_MEAL_LANES[time]||[];
        if(allowed.includes(forced)) return forced;
      }
    }
    let ref=null;
    try{ if(typeof findRefByName==='function') ref=findRefByName(name); }catch(_){ }
    const timing=String((ref&&ref.timing)||'').toLowerCase();
    const hay=(nm+' '+timing).toLowerCase();
    if(time==='am'){
      if(/lunch|midday|mid-day|mid day|afternoon|noon/.test(hay)) return 'lunch';
      return 'breakfast';
    }
    if(/bed|bedtime|night|sleep|before bed|fasted/.test(hay)) return 'bedtime';
    if(/(dsip|ipa|ipamorelin|cjc|tesa|tesamorelin|sermorelin|mk-677|ibutamoren)/.test(nm)) return 'bedtime';
    return 'dinner';
  }
  function schedRowsBucket(time,bucket){
    const names=[..._schedNamesByTime[time]].filter(name=>calBucketFor(name,time)===bucket && !_ivOverlayNames.has(_ovNormName(name)));
    const rows=[];
    for(const name of names){
      const dlist=[0,1,2,3,4,5,6].filter(di=>schedCellActive(name,time,di));
      let placed=false;
      for(let i=rows.length-1;i>=0;i--){
        if(dlist.every(di=>!rows[i][di])){ dlist.forEach(di=>rows[i][di]=name); placed=true; break; }
      }
      if(!placed){ const r=[null,null,null,null,null,null,null]; dlist.forEach(di=>r[di]=name); rows.push(r); }
    }
    return rows;
  }
  buildHdr('cal-breakfast-hdr','am');buildHdr('cal-lunch-hdr','am');buildHdr('cal-dinner-hdr','pm');buildHdr('cal-bedtime-hdr','pm');
  function buildRows(rowsId,time,bucket){
    const container=g(rowsId);container.innerHTML='';
    const accent=time==='am'?'#B45309':'#185FA5';
    const glow  =time==='am'?'rgba(180,83,9,.15)':'rgba(24,95,165,.15)';
    const emptyBg=time==='am'?'rgba(180,83,9,.08)':'rgba(24,95,165,.08)';
    const emptyTx=time==='am'?'#92400E':'#185FA5';
    // v0.27.63: for the current week (S.wkOff === 0), pull interval-due peptides
    // that don't have a sched entry on the due-today column and add them to
    // the rows so they appear on the right day.
    let _packed = schedRowsBucket(time,bucket);
    // v0.27.70: interval overlays apply to every visible week, not just the
    // current one, so future weeks render on the correct interval-due day
    // instead of falling back to the day-of-week sched cell.
    {
      const overlays = (time==='am'?_amIntervalOverlays:[]).filter(ov => calBucketFor(ov.name,time)===bucket);
      const _ovNorm=s=>String(s==null?'':s).trim().toLowerCase();
      overlays.forEach(ov => {
        // RC-C: if this peptide is already on this day from a sched row,
        // skip entirely. Without this guard the placement loop exhausts all
        // rows (cell non-null but not empty), falls through to create a new
        // row, and the peptide appears twice on the same day.
        // RC-E: compare names normalized (trim + case-insensitive). The
        // interval overlay uses the inventory item's name while packed sched
        // cells use the name embedded in the schedule key. When those diverge
        // only by trailing/leading whitespace or case (e.g. after a rename or
        // vendor import), a strict === compare misses the match and the
        // overlay injects a phantom duplicate row on an already-scheduled day.
        const ovName=_ovNorm(ov.name);
        if(_packed.some(row => row[ov.di]!=null && _ovNorm(row[ov.di]) === ovName)) return;
        // Try to find an existing row where ov.di is empty so we can
        // inject without spawning extra row real estate.
        let placed = false;
        for(const row of _packed){
          if(!row[ov.di]){
            row[ov.di] = ov.name;
            placed = true;
            break;
          }
        }
        if(!placed){
          // Create a new row with just this peptide on the due column
          const r = [null,null,null,null,null,null,null];
          r[ov.di] = ov.name;
          _packed.push(r);
        }
      });
    }
    if(!_packed.length) _packed=[[null,null,null,null,null,null,null]];
    _packed.forEach(row=>{
      const rowEl=document.createElement('div');rowEl.className='srow';
      days.forEach((d,di)=>{
        const name=row[di];
        const ds=fmD(d);const isToday=ds===ts;
        let cell;
        // Cycle window: scheduled cells outside cycleStart/cycleEnd are hidden,
        // but any cell that has a logged shot stays visible (history wins).
        // Dual-slot fix (20260819): when a peptide is scheduled in BOTH am and
        // pm on this day, match shots strictly to this cell's own time bucket -
        // otherwise logging the AM shot would light the PM cell's needle too.
        // The opposite-bucket fallback remains for single-slot items (log time
        // differing from scheduled time still marks the one scheduled cell).
        const _dualSlot=name?!!(S.sched&&S.sched[sk(name,'am',di)]&&S.sched[sk(name,'pm',di)]):false;
        const logged=name?(weekShotMap.get(ds+'|'+time+'|'+name)||(_dualSlot?null:weekShotMap.get(ds+'|'+(time==='am'?'pm':'am')+'|'+name))):null;
        const inWindow=name?isInCycleWindow(name,ds):true;
        if(name&&!logged&&!inWindow){
          cell=document.createElement('button');cell.type='button';cell.className='sc e cal-day-pick';
          cell.dataset.date=ds;cell.dataset.di=String(di);
          if(isToday){cell.style.background=emptyBg;cell.style.boxShadow='inset 0 0 0 2px '+accent;cell.style.color=emptyTx;cell.style.fontWeight='600';}
          cell.textContent='—';
          rowEl.appendChild(cell);
          return;
        }
        if(name){
          const c=pepColor(name);
          const baseStyle='background:'+c.bg+';color:'+c.text+';border:.5px solid '+c.border+(isToday?';box-shadow:inset 0 0 0 2.5px '+accent+',0 0 0 2px '+glow:'');
          if(logged){
            cell=document.createElement('button');cell.type='button';cell.className='sc active sc-logged';cell.style.cssText=baseStyle;
            // v13: unified 3-line layout — peptide name on top, units in
            // middle (the actionable number), dose as small tertiary text.
            // Logged vs scheduled distinguished by color/border, not by
            // position swap. shotUnits uses the SHOT's stored volume as the
            // source of truth (matches what was actually drawn at log time).
            const u=shotUnits(logged);
            const doseTxt=fmtDose(logged.dose,logged.doseUnit||'mcg')||(logged.dose+(logged.doseUnit||'mcg'));
            const shortName=name.length>8?name.slice(0,7)+'…':name;
            cell.style.flexDirection='column';
            let inner='<div style="font-size:9.5px;font-weight:600;line-height:1;letter-spacing:.01em">'+escH(shortName)+'</div>';
            if(u!=null){
              inner+='<div style="line-height:1;font-weight:700;margin-top:2px">'+u+'u</div>';
              if(doseTxt) inner+='<div style="font-size:8px;font-weight:400;opacity:.65;line-height:1;margin-top:1px">'+escH(doseTxt)+'</div>';
            }else if(doseTxt){
              inner+='<div style="font-size:9px;font-weight:500;opacity:.85;line-height:1;margin-top:2px">'+escH(doseTxt)+'</div>';
            }
            cell.innerHTML=inner;
            // Needle indicator — visual confirmation this scheduled shot is logged.
            const _needle=document.createElement('span');
            _needle.className='sc-needle';
            _needle.textContent='💉';
            _needle.title='Shot logged';
            cell.appendChild(_needle);
            cell.dataset.pep=name;
            // P1B: encode ctx fields as data attributes; delegation handler reconstructs ctx at click time.
            cell.dataset.type='logged';cell.dataset.di=String(di);cell.dataset.time=time;cell.dataset.date=ds;cell.dataset.shotid=String(logged.id);
          }else{
            cell=document.createElement('button');cell.type='button';cell.className='sc active';cell.style.cssText=baseStyle;
            cell.dataset.pep=name;
            // v13: unified 3-line layout — same structure as logged cells
            // above (name / units / dose). RC-5: reads per-occurrence dose
            // override if set, otherwise falls back to inventory default.
            // schedUnitsForCell mirrors schedUnits but uses occurrence dose.
            const occ=getOccurrenceDose(name,time,di);
            const doseTxt=fmtDose(occ.dose,occ.doseUnit)||'';
            const u=schedUnitsForCell(name,time,di);
            const shortName=name.length>8?name.slice(0,7)+'…':name;
            cell.style.flexDirection='column';
            let inner='<div style="font-size:9.5px;font-weight:600;line-height:1;letter-spacing:.01em">'+escH(shortName)+'</div>';
            if(u!=null){
              inner+='<div style="line-height:1;font-weight:700;margin-top:2px">'+u+'u</div>';
              if(doseTxt) inner+='<div style="font-size:8px;font-weight:400;opacity:.65;line-height:1;margin-top:1px">'+escH(doseTxt)+'</div>';
            }else if(doseTxt){
              inner+='<div style="font-size:9px;font-weight:500;opacity:.85;line-height:1;margin-top:2px">'+escH(doseTxt)+'</div>';
            }
            cell.innerHTML=inner;
            // Pill-bottle indicator — this Rx med was marked taken on this date
            // via the weekly Rx card (Taken-today checkbox / + Log). Mirrors the
            // sc-needle syringe shown on logged shots.
            if(rxTakenOn(ds,name)){
              cell.classList.add('sc-rx-taken'); // gives the marker its position:relative context
              const _pill=document.createElement('span');
              _pill.className='sc-needle sc-pill';
              _pill.textContent='💊';
              _pill.title='Rx taken';
              cell.appendChild(_pill);
            }
            // P1B: encode ctx fields as data attributes; delegation handler reconstructs ctx at click time.
            cell.dataset.type='sched';cell.dataset.di=String(di);cell.dataset.time=time;cell.dataset.date=ds;
          }
        }else{
          cell=document.createElement('div');cell.className='sc e';
          if(isToday){cell.style.background=emptyBg;cell.style.boxShadow='inset 0 0 0 2px '+accent;cell.style.color=emptyTx;cell.style.fontWeight='600';}
          cell.textContent='—';
        }
        rowEl.appendChild(cell);
      });
      container.appendChild(rowEl);
    });
  }
  buildRows('cal-breakfast-rows','am','breakfast');buildRows('cal-lunch-rows','am','lunch');buildRows('cal-dinner-rows','pm','dinner');buildRows('cal-bedtime-rows','pm','bedtime');
  // v33.375-stable-vendor-post-import-review: apply the immediate glow to the active meal window pair and fade the opposite pair.
  (function(){
    const todayDi = days.findIndex(d => fmD(d) === ts);
    if(todayDi < 0) return;
    const activeIds = _calAmImmediate ? ['cal-breakfast-rows','cal-lunch-rows'] : ['cal-dinner-rows','cal-bedtime-rows'];
    const otherIds  = _calAmImmediate ? ['cal-dinner-rows','cal-bedtime-rows'] : ['cal-breakfast-rows','cal-lunch-rows'];
    activeIds.forEach(id => {
      const el = g(id); if(!el) return;
      el.querySelectorAll('.srow').forEach(row => { const cells=row.children; if(cells && cells[todayDi]) cells[todayDi].classList.add('immediate'); });
    });
    otherIds.forEach(id => {
      const el = g(id); if(!el) return;
      el.querySelectorAll('.srow').forEach(row => { const cells=row.children; if(cells && cells[todayDi]) cells[todayDi].classList.add('today-faded'); });
    });
  })();
  // v0.26.8: auto-refresh on visibility change so a calendar that was rendered
  // hours ago doesn't show stale immediate-glow when the user returns.
  if(!window._renderCalAutoHook){
    window._renderCalAutoHook = true;
    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'visible'){
        const calVisible = document.getElementById('pg-calendar') && document.getElementById('pg-calendar').style.display !== 'none';
        if(calVisible) try { renderCal(); } catch(_){}
      }
    });
  }
  // RC-3: visibilitychange ownership guard.
  // Only close the action panel when no cell is currently selected.
  // CUR is null when no panel is open; non-null when the user tapped a cell
  // and the action panel is active. Without this guard every renderCal() call
  // (including those triggered by visibilitychange on tab-back) dismissed the
  // panel unconditionally, causing perceived "calendar changes on its own."
  if(!CUR)apClose();
  applyStackHighlight();
}

/* ============================================================
   SECTION: Stats, Stack & Dose Intervals
   Weekly stats summary, dose-interval tracker (day gaps per
   peptide), daily stack view, and the cross-view highlight sync.
   ============================================================ */

function renderStats(){
  // Local-date ISO (YYYY-MM-DD), matching what <input type="date"> produces and what shots store
  const pad=n=>String(n).padStart(2,'0');
  const isoDate=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const today=new Date(); today.setHours(0,0,0,0);
  const weekAgo=new Date(today); weekAgo.setDate(weekAgo.getDate()-6);
  const loToday=isoDate(today), loWeekAgo=isoDate(weekAgo);
  const shots=S.shots||[];
  const shotsThisWeek=shots.filter(s=>s.date>=loWeekAgo&&s.date<=loToday).length;
  const schedTotal=Object.keys(S.sched||{}).filter(k=>S.sched[k]).length;
  // Streak: consecutive calendar days with >=1 shot, walking back from today.
  const shotDays=new Set(shots.map(s=>s.date));
  let cursor=new Date(today);
  if(!shotDays.has(isoDate(cursor))){cursor.setDate(cursor.getDate()-1);}
  let streak=0;
  while(shotDays.has(isoDate(cursor))){streak++;cursor.setDate(cursor.getDate()-1);}
  const wkEl=g('stats-week'),stEl=g('stats-streak');
  if(wkEl)wkEl.textContent=schedTotal>0?(shotsThisWeek+'/'+schedTotal):String(shotsThisWeek);
  if(stEl)stEl.textContent=streak;
  // Active peptides: unique names in S.sched where any slot is true
  const schedKeys=Object.keys(S.sched||{}).filter(k=>S.sched[k]);
  const pepsFromSched=new Set(schedKeys.map(k=>k.split('/')[0]));
  const skEl=g('stats-stack');
  if(skEl)skEl.textContent=pepsFromSched.size;
  // === Projected run-out ===
  // For each active peptide with stock + known dose + vial size, compute weekly
  // usage and project when they'll run out. Surface the earliest one.
  const toMg=(amt,u)=>u==='mcg'?amt/1000:u==='mg'?amt:0;
  let earliest=null;
  pepsFromSched.forEach(nm=>{
    const it=(S.inv||[]).find(i=>!i.isSupply&&i.name===nm);
    if(!it)return;
    const shotsPerWeek=pepShotsPerWeek(it);
    if(!(shotsPerWeek>0))return;
    const dosePerShotMg=toMg(it.dose||0,it.doseUnit||'mcg');
    const vialMg=+it.vialMg||0;
    const vialsOnHand=(+it.fz||0)+(+it.fr||0);
    if(dosePerShotMg<=0||vialMg<=0||vialsOnHand<=0)return;
    const dosesPerVial=vialMg/dosePerShotMg;
    const totalDoses=vialsOnHand*dosesPerVial;
    const daysLeft=Math.floor(totalDoses/shotsPerWeek*7);
    if(earliest===null||daysLeft<earliest.days)earliest={name:nm,days:daysLeft};
  });
  const roEl=g('stats-runout'),roLblEl=g('stats-runout-label'),roTile=g('runout-icon-tile');
  if(roEl){
    if(!earliest){
      roEl.textContent='—';roEl.style.fontSize='22px';
      if(roLblEl)roLblEl.textContent='Next run-out';
      if(roTile)roTile.style.background='linear-gradient(135deg,#7C3AED,#A855F7)';
    }else{
      const days=earliest.days;
      const isUrgent=days<=7,isSoon=days<=14;
      roEl.textContent=days<=0?'Now':days+'d';
      roEl.style.fontSize=days<=0?'20px':'22px';
      roEl.style.color=isUrgent?'#B91C1C':isSoon?'#B45309':'#0C4A6E';
      if(roLblEl){
        const shortName=earliest.name.length>11?earliest.name.slice(0,10)+'…':earliest.name;
        roLblEl.textContent=shortName;
      }
      if(roTile)roTile.style.background=isUrgent?'linear-gradient(135deg,#B91C1C,#DC2626)':isSoon?'linear-gradient(135deg,#B45309,#F59E0B)':'linear-gradient(135deg,#7C3AED,#A855F7)';
    }
  }
}

function renderIntervalDoses(){
  const card=g('interval-card'),rows=g('interval-rows');
  if(!card||!rows)return;
  const items=(S.inv||[]).filter(i=>i.interval&&i.interval>0);
  if(!items.length){card.style.display='none';return;}
  card.style.display='';
  const pad=n=>String(n).padStart(2,'0');
  const isoDate=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const today=new Date();today.setHours(0,0,0,0);
  rows.innerHTML=items.map(it=>{
    const shots=(S.shots||[]).filter(s=>s.peptide===it.name).sort((a,b)=>b.date.localeCompare(a.date));
    const lastDate=shots.length?shots[0].date:null;
    const c=pepColor(it.name);
    const badge='<span style="font-size:11px;padding:2px 8px;border-radius:6px;font-weight:500;background:'+c.bg+';color:'+c.text+';border:.5px solid '+c.border+';white-space:nowrap">'+escH(it.name)+'</span>';
    const intLbl='<span style="font-size:10px;color:var(--color-text-tertiary)">every '+it.interval+'d</span>';
    // v0.27.75: cycleStart-anchored next-due (matches weekly calendar logic).
    // Walk forward by interval from cycleStart (or last shot if no cycleStart)
    // until we land on a date >= today.
    let nextDate=null;
    if(it.cycleStart){
      const start=new Date(it.cycleStart+'T12:00:00');
      if(!isNaN(start.getTime())){
        start.setHours(0,0,0,0);
        nextDate=new Date(start);
        let safety=0;
        while(nextDate<today && safety<5000){
          nextDate.setDate(nextDate.getDate()+it.interval);
          safety++;
        }
      }
    } else if(lastDate){
      const last=new Date(lastDate);last.setHours(0,0,0,0);
      nextDate=new Date(last);nextDate.setDate(nextDate.getDate()+it.interval);
    }
    let status;
    if(!nextDate){
      status='<span style="font-size:11px;color:var(--color-text-tertiary)">Not started — set cycle start or log first shot</span>';
    } else {
      const daysUntil=Math.round((nextDate-today)/(24*60*60*1000));
      const nextStr=isoDate(nextDate);
      // Respect cycleEnd
      if(it.cycleEnd && nextStr>it.cycleEnd){
        status='<span style="font-size:11px;color:var(--color-text-tertiary)">Cycle ended '+it.cycleEnd+'</span>';
      } else if(daysUntil<0)
        status='<span style="font-size:11px;font-weight:600;color:var(--accent-red-fg)">⚠ Overdue by '+Math.abs(daysUntil)+(Math.abs(daysUntil)===1?' day':' days')+'</span>';
      else if(daysUntil===0)
        status='<span style="font-size:11px;font-weight:600;color:#059669">✓ Due today</span>';
      else if(daysUntil===1)
        status='<span style="font-size:11px;color:#D97706">Due tomorrow</span>';
      else
        status='<span style="font-size:11px;color:var(--color-text-secondary)">Next: '+nextStr+' (in '+daysUntil+' days)</span>';
    }
    const last=lastDate?'<span style="font-size:10px;color:var(--color-text-tertiary)">last: '+lastDate+'</span>':'';
    return'<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:.5px solid var(--color-border-tertiary);flex-wrap:wrap">'+badge+intLbl+status+last+'</div>';
  }).join('');
}

function renderStack(){
  renderStats();
  renderIntervalDoses();
  // JS getDay(): Sun=0, Mon=1, ..., Sat=6. Our DAYS order is Mon=0..Sun=6
  const jd=new Date().getDay();
  const todayDi=(jd+6)%7;
  // Current-week dates per column, used for cycle-window filtering below.
  // wkD(0) returns [Mon..Sun] of this week, so index matches our column index.
  const weekDates=wkD(0).map(fmD);
  const hdrCls=t=>t==='am'?'today-hdr-am':'today-hdr';
  const colCls=t=>t==='am'?'today-col-am':'today-col';
  // Glow on the "immediate" half-day: AM before noon, PM noon-onwards.
  const _hr=new Date().getHours();
  const _amImmediate=_hr<13;
  const isImmediate=(time,di)=>di===todayDi && ((time==='am')?_amImmediate:!_amImmediate);
  window._isStackImmediate=isImmediate;
  ['am','pm'].forEach(t=>{
    const hdr=g(t+'-hdr');
    hdr.innerHTML=DAYS.map((d,di)=>{
      let cls='shdc';
      if(di===todayDi) cls+=' '+hdrCls(t);
      if(isImmediate(t,di)) cls+=' immediate-hdr';
      return '<div class="'+cls+'">'+d+'</div>';
    }).join('');
  });
  function makeRows(time){
    const frag=document.createDocumentFragment();
    // v0.27.75: include interval-managed peptides via overlays (same logic as
    // weekly calendar). schedRows excludes them since v33.375-stable-vendor-post-import-review, so without this
    // pass they wouldn't show on the daily stack today-column either.
    const _packed = packRows(schedRows(time),time);
    try {
      const _wkDates = (typeof wkD === 'function') ? wkD(0) : null;
      if(_wkDates && typeof intervalOverlaysForWeek === 'function'){
        const overlays = intervalOverlaysForWeek(_wkDates, time);
        overlays.forEach(ov => {
          let placed = false;
          for(const r of _packed){ if(!r[ov.di]){ r[ov.di] = ov.name; placed = true; break; } }
          if(!placed){ const r=[null,null,null,null,null,null,null]; r[ov.di]=ov.name; _packed.push(r); }
        });
      }
    } catch(_){}
    _packed.forEach(row=>{
      const rowEl=document.createElement('div');rowEl.className='srow';
      for(let di=0;di<7;di++){
        const name=row[di];
        const cell=document.createElement('div');
        let todayClass=di===todayDi?' '+colCls(time):'';
        if(typeof isImmediate==='function' && isImmediate(time,di)) todayClass+=' immediate';
        // Hide cells outside the peptide's cycle window (logged shots don't
        // appear on this view anyway, so the "history wins" rule from the
        // calendar doesn't need a carve-out here).
        if(name&&isInCycleWindow(name,weekDates[di])){
          const c=pepColor(name);
          cell.className='sc'+todayClass;cell.style.cssText='background:'+c.bg+';color:'+c.text+';border:.5px solid '+c.border+';cursor:pointer';
          cell.dataset.pep=name;
          // v13: unified 3-line layout — peptide name on top, units in middle,
          // dose as small tertiary text. Same structure as the calendar cells
          // so users see consistent rendering across both views.
          const inv=(S.inv||[]).find(i=>!i.isSupply&&i.name===name);
          const doseTxt=inv?(fmtDose(inv.dose,inv.doseUnit||'mcg')||''):'';
          const u=schedUnits(name);
          const shortName=name.length>8?name.slice(0,7)+'…':name;
          cell.style.flexDirection='column';
          let inner='<div style="font-size:9.5px;font-weight:600;line-height:1;letter-spacing:.01em">'+escH(shortName)+'</div>';
          if(u!=null){
            inner+='<div style="line-height:1;font-weight:700;margin-top:2px">'+u+'u</div>';
            if(doseTxt) inner+='<div style="font-size:8px;font-weight:400;opacity:.65;line-height:1;margin-top:1px">'+escH(doseTxt)+'</div>';
          }else if(doseTxt){
            inner+='<div style="font-size:9px;font-weight:500;opacity:.85;line-height:1;margin-top:2px">'+escH(doseTxt)+'</div>';
          }
          cell.innerHTML=inner;
        }else{cell.className='sc e'+todayClass;cell.textContent='—';}
        rowEl.appendChild(cell);
      }
      frag.appendChild(rowEl);
    });return frag;
  }
  g('am-rows').innerHTML='';g('am-rows').appendChild(makeRows('am'));
  g('pm-rows').innerHTML='';g('pm-rows').appendChild(makeRows('pm'));
  applyStackHighlight();
}

function applyStackHighlight(){
  // --- Legend pills ---
  document.querySelectorAll('#main-legend [data-pep]').forEach(pill=>{
    const isSelected=pill.dataset.pep===stackHighlight;
    const anySelected=!!stackHighlight;
    pill.style.opacity=anySelected&&!isSelected?'0.35':'1';
    pill.style.boxShadow=isSelected?'0 0 0 2.5px currentColor':'';
    pill.style.fontWeight=isSelected?'700':'';
    pill.style.outline='';
  });
  // --- Stack AND calendar grid cells ---
  document.querySelectorAll('#pg-stack [data-pep], #pg-calendar [data-pep]').forEach(cell=>{
    if(!stackHighlight){
      cell.style.filter='';
      cell.style.boxShadow='';
    } else if(cell.dataset.pep===stackHighlight){
      const c=pepColor(cell.dataset.pep);
      cell.style.filter='';
      cell.style.boxShadow='0 0 0 2.5px '+c.border+',0 2px 6px rgba(0,0,0,.18)';
    } else {
      cell.style.filter='grayscale(1) brightness(0.65)';
      cell.style.boxShadow='';
    }
  });
}

/* ============================================================
   SECTION: Shot Log & Site Rotation
   Shot log table, peptide dose-history chart (via Chart.js), the
   numbered grid-cell injection site map (front/back body diagram),
   and the supply-tile renderer for the inventory card.
   ============================================================ */

// Shot-log site hydration: in-memory only (not persisted). Canonical owner is shot.site.
let _lgSiteUserPicked=false;
window._leDateUserEdited=false;
window._dateInputSilent=false;
let _lgSiteAutofillGuard=false;
function clearLgSiteUserPicked(){
  _lgSiteUserPicked=false;
  const siteEl=g('lg-site');
  if(siteEl)delete siteEl.dataset.resolvedSite;
}
function clearLgSiteScratchStorage(){
  try{localStorage.removeItem('tmp.lastSite');}catch(_){}
}
function saveLastInjectionSite(site){
  const v=(site||'').trim();
  if(!v)return;
  try{localStorage.setItem('tmp.lastSite',v);}catch(_){}
}
function readLastInjectionSite(){
  try{return localStorage.getItem('tmp.lastSite')||'';}catch(_){return '';}
}
function normalizeSiteForDropdown(siteValue){
  const v=(siteValue||'').trim();
  if(!v)return '';
  const siteEl=g('lg-site');
  if(!siteEl)return v;
  if([...siteEl.options].some(o=>o.value===v))return v;
  if(typeof LEGACY_SITE_MAP==='object'&&LEGACY_SITE_MAP[v])return LEGACY_SITE_MAP[v];
  const c=getSiteCell(v);
  if(c&&c.cellId&&[...siteEl.options].some(o=>o.value===c.cellId))return c.cellId;
  return v;
}

function stickLgInjectionSite(site){
  const v=(site||'').trim();
  if(!v)return;
  saveLastInjectionSite(v);
  applyLgSiteDomValue(v);
  _lgSiteUserPicked=true;
  const siteEl=g('lg-site');
  if(siteEl)siteEl.dataset.resolvedSite=v;
}
window.stickLgInjectionSite=stickLgInjectionSite;
function applyLgSiteDomValue(siteValue){
  const siteEl=g('lg-site');
  if(!siteEl)return;
  _lgSiteAutofillGuard=true;
  const v=normalizeSiteForDropdown(siteValue);
  if(v&&[...siteEl.options].some(o=>o.value===v))siteEl.value=v;
  else siteEl.selectedIndex=0;
  siteEl.dispatchEvent(new Event('change',{bubbles:true}));
  _lgSiteAutofillGuard=false;
}
window.__tmpApplyLgSite=applyLgSiteDomValue;
function wireLgSiteUserPicked(){
  const sel=document.getElementById('lg-site');
  if(!sel||sel._userPickedWired)return;
  sel._userPickedWired=true;
  sel.addEventListener('change',()=>{
    if(_lgSiteAutofillGuard)return;
    if(sel.value){
      _lgSiteUserPicked=true;
      sel.dataset.resolvedSite=sel.value;
      saveLastInjectionSite(sel.value);
    }else{
      clearLgSiteUserPicked();
    }
  });
}

// ════════════════════════════════════════════════════════════════════
// Photo-based body diagram (v4). Uses the actual injection-rotation chart
// the user uploaded. Each REGION is a rectangular hotspot positioned over
// the photo using percentage coordinates. Cell numbering matches the chart
// exactly: front 1-106, back 1-130. New shots store "front-N" or "back-N"
// in shot.site.
//
// Old shots — both legacy strings ("SQ Abdomen UL") and the previous
// build's cell IDs ("f-15") — are mapped to representative photo cells
// for diagram density. Their original site values are preserved on the
// shot record so the log table can show them as-is.
// ════════════════════════════════════════════════════════════════════

// Per-region color palette. Keyed by legacyZone (the dropdown value)
// so the dropdown options and body-diagram regions share colors. The
// stroke on each SVG rect still conveys SQ (teal) vs IM (violet) type;
// fill conveys WHICH region. Activity state (warm/hot) is shown via
// stroke override + fill-opacity bump.
const SITE_COLORS={
  'SQ Abdomen UL':'#7CD8D0','SQ Abdomen UR':'#A6D777',
  'SQ Abdomen LL':'#F5A85C','SQ Abdomen LR':'#F0A6C5',
  'SQ Thigh L':'#9C7CC8','SQ Thigh R':'#E8D86E',
  'SQ Triceps L':'#F0A878','SQ Triceps R':'#E5A4D9',
  'SQ Flank L':'#A988D9','SQ Flank R':'#D2C979',
  'IM Deltoid L':'#7CD8D0','IM Deltoid R':'#82C67D',
  'IM Glute L':'#7B7CD5','IM Glute R':'#DA836E',
  'intranasal':'#38BDF8',
  'Other':'#94A3B8'
};


// Update the color chip beside any injection-site dropdown to reflect
// the currently-selected region. Wired on DOMContentLoaded plus on
// every change event. Idempotent — safe to call multiple times.
function updateSiteChip(selectId, chipId){
  const sel=document.getElementById(selectId);
  const chip=document.getElementById(chipId);
  if(!sel||!chip)return;
  const color=SITE_COLORS[sel.value]||'var(--color-border-secondary)';
  chip.style.backgroundColor=color;
  chip.dataset.active=sel.value?'true':'false';
}
function initSiteChips(){
  ['lg-site','e-site'].forEach(id=>{
    const sel=document.getElementById(id);
    if(!sel)return;
    const chipId=id+'-chip';
    if(!document.getElementById(chipId)){
      // edit-form (e-site) chip might not be wrapped yet - add inline
      const chip=document.createElement('span');
      chip.className='site-chip';chip.id=chipId;chip.setAttribute('aria-hidden','true');
      sel.insertAdjacentElement('afterend',chip);
    }
    updateSiteChip(id,chipId);
    sel.addEventListener('change',()=>updateSiteChip(id,chipId));
  });
  wireLgSiteUserPicked();
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',initSiteChips);
} else {
  initSiteChips();
}


// ============================================================
// SQ/IM route system — helpers
// ============================================================
// Returns the configured route for a peptide name. Reads from inventory.
// Default 'both' for legacy peptides that pre-date the route field, so
// nothing breaks for users with existing data.
function pepRoute(name){
  if(!name)return 'both';
  const it=(S.inv||[]).find(p=>p.name===name);
  if(!it||!it.route)return 'both';
  return it.route;
}
// Returns true if a peptide with `route` may use a site of `type`.
// 'both' allows everything; 'SQ' only allows SQ; 'IM' only allows IM.
function routeAllows(route, type){
  if(!route||route==='both')return true;
  // Intranasal is always available regardless of SQ/IM peptide route.
  if(type==='IN'||type==='NASAL')return true;
  if(type==='SQ+IM')return route==='SQ'||route==='IM';
  return route===type;
}
// Backfill: walk through historical shots and set shot.type from the
// site name if it's missing. Idempotent — runs once per session, marked
// on S so it doesn't re-walk on every load.
function ensureShotTypes(){
  if(S._shotTypes_backfill_v1)return;
  (S.shots||[]).forEach(sh=>{
    if(!sh.type){
      // siteIsIM handles legacy strings like "IM Deltoid L" and cell IDs
      // like "f-49"; falls back to false (=> SQ) if the site is unknown.
      sh.type=siteIsIM(sh.site)?'IM':'SQ';
    }
  });
  S._shotTypes_backfill_v1=true;
}
// Read/write the peptide-form route picker.
function setPfRoute(route){
  const pick=g('pf-route-picker');
  if(!pick)return;
  pick.querySelectorAll('.rbtn').forEach(b=>{
    b.dataset.selected=(b.dataset.route===route)?'1':'0';
  });
}
function getPfRoute(){
  const pick=g('pf-route-picker');
  if(!pick)return 'both';
  const sel=pick.querySelector('.rbtn[data-selected="1"]');
  return sel?sel.dataset.route:'both';
}
// Update the small badge next to the lg-pep dropdown to reflect the
// currently-selected peptide's route. Empty route => badge hidden.
function updateRouteBadge(){
  const sel=g('lg-pep'),badge=g('lg-route-badge');
  if(!sel||!badge)return;
  const route=pepRoute(sel.value);
  badge.dataset.route=route;
  badge.textContent=route==='both'?'SQ + IM':route;
}

// Wire route-picker buttons in the peptide form (delegated click) and
// the lg-pep change handler that drives route-aware body-map filtering.
function initRouteSystem(){
  // Backfill missing shot.type from site
  if(typeof S!=='undefined'&&S){ensureShotTypes();}
  // Route picker click delegation
  const pick=g('pf-route-picker');
  if(pick&&!pick._wired){
    pick.addEventListener('click',(e)=>{
      const b=e.target.closest('.rbtn');
      if(!b)return;
      e.preventDefault();
      setPfRoute(b.dataset.route);
    });
    pick._wired=true;
  }
  // lg-pep change handler: update the route badge AND re-render the body
  // diagram so blocked regions are dimmed for the new peptide.
  const lp=g('lg-pep');
  if(lp&&!lp._routeWired){
    lp.addEventListener('change',()=>{
      updateRouteBadge();
      try{renderRotation();}catch(e){}
    });
    lp._routeWired=true;
    updateRouteBadge();  // initial badge state
  }
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',initRouteSystem);
} else {
  initRouteSystem();
}




const SITE_REGIONS=(function(){
  const regs={};
  const add=(key, side, n, label, short, type, px, py, pw, ph)=>{
    const canon=(side==='f'?'front-':'back-')+n;
    regs[key]={side,label,short,type,cells:[n],px,py,pw,ph,legacyZone:canon};
  };
  const addStack=(prefix, side, nums, x, y, w, h, labelBase, shortBase, type)=>{
    nums.forEach((n,i)=>add(prefix+n,side,n,labelBase+' #'+n,shortBase,type,x,y+i*h,w,h));
  };
  const addGrid=(prefix, side, nums, cols, x, y, w, h, labelBase, shortBase, type)=>{
    nums.forEach((n,i)=>add(prefix+n,side,n,labelBase+' #'+n,shortBase,type,x+(i%cols)*w,y+Math.floor(i/cols)*h,w,h));
  };

  // FRONT — shoulders: squares 4 and 6 removed.
  add('FLS1','f',1,'Front left shoulder #1','Front shoulder','SQ+IM',18.11,17.19,2.05,3.13);
  add('FRS3','f',3,'Front right shoulder #3','Front shoulder','SQ+IM',37.65,17.19,2.08,3.13);

  // FRONT — abdomen, lowered on the image; squares 18 and 19 removed.
  add('FA13','f',13,'Abdomen #13','Abdomen','SQ',24.37,33.375,2.15,3.03);
  add('FA14','f',14,'Abdomen #14','Abdomen','SQ',26.52,33.375,2.15,3.03);
  add('FA15','f',15,'Abdomen #15','Abdomen','SQ',28.67,33.375,2.15,3.03);
  add('FA16','f',16,'Abdomen #16','Abdomen','SQ',30.82,33.375,2.15,3.03);
  add('FA17','f',17,'Abdomen #17','Abdomen','SQ',24.37,36.53,2.15,3.03);
  add('FA20','f',20,'Abdomen #20','Abdomen','SQ',30.82,36.53,2.15,3.03);
  add('FA21','f',21,'Abdomen #21','Abdomen','SQ',24.37,39.56,2.15,3.03);
  add('FA22','f',22,'Abdomen #22','Abdomen','SQ',26.52,39.56,2.15,3.03);
  add('FA23','f',23,'Abdomen #23','Abdomen','SQ',28.67,39.56,2.15,3.03);
  add('FA24','f',24,'Abdomen #24','Abdomen','SQ',30.82,39.56,2.15,3.03);

  // FRONT — thighs, visible squares only.
  addStack('FLT','f',[29,31,33],20.78,51.95,2.41,2.93,'Front left thigh','Left thigh','SQ');
  addStack('FRT','f',[40,42,44],33.375,51.95,2.35,2.93,'Front right thigh','Right thigh','SQ');

  // BACK — shoulders: squares 4 and 6 removed.
  add('BLS1','b',1,'Back left shoulder #1','Back shoulder','SQ+IM',56.42,17.09,2.08,3.17);
  add('BRS3','b',3,'Back right shoulder #3','Back shoulder','SQ+IM',73.29,17.09,2.08,3.17);

  // BACK — lower back / love handles. Squares 9 and 11 were removed.
  add('BLB10','b',10,'Back lower left #10','Lower back','SQ',60.00,37.30,2.28,3.13);
  add('BRB12','b',12,'Back lower right #12','Lower back','SQ',67.88,37.40,2.28,3.13);

  // BACK — glutes. Squares 13 and 18.
  add('BLG13','b',13,'Left glute #13','Left glute','IM',59.22,44.34,2.35,3.13);
  add('BRG18','b',18,'Right glute #18','Right glute','IM',68.40,44.34,2.41,3.13);

  // Keep dropdown chip colors in sync for the new canonical cell values.
  Object.values(regs).forEach(r=>{
    SITE_COLORS[r.legacyZone]=r.type==='IM'?'#6D35D9':(r.type==='SQ+IM'?'#00AFA8':'#00AFA8');
  });
  return regs;
})();


// Body chart photo, embedded as base64 JPEG so the file is self-contained.
// Each region's px/py/pw/ph give a percentage bbox into this image.
// Injection-site reference photo. Was a 3.6 MB base64 data-URL embedded here,
// which made core.js ~4.2 MB and blocked parse on every load. Now an external
// asset (166 KB WebP). Original PNG kept at assets/branding/injection-site-map.png.
const SITE_PHOTO_DATA_URL='assets/branding/injection-site-map.webp';

// Flat cell list — generated lazily.
const SITE_CELLS=[];
function buildSiteCells(){
  if(SITE_CELLS.length)return;
  Object.entries(SITE_REGIONS).forEach(([rk,r])=>{
    r.cells.forEach(n=>{
      SITE_CELLS.push({
        id:r.side+'-'+n,         // e.g. "f-47"
        cellId:r.side==='f'?'front-'+n:'back-'+n,  // canonical site value
        regionKey:rk,
        number:n,
        region:Object.assign({},r,{key:rk})
      });
    });
  });
}

// Look up by canonical "front-N" / "back-N" id
function getSiteCell(id){
  if(!id)return null;
  buildSiteCells();
  // Try canonical format first
  let c=SITE_CELLS.find(c=>c.cellId===id);
  if(c)return c;
  // Try short format ("f-15" / "b-22") — matches numbering when within range
  c=SITE_CELLS.find(c=>c.id===id);
  return c||null;
}

// Legacy site values → representative cell ID. Used to color the diagram
// for old shots; the original site value is preserved on the shot record.
const LEGACY_SITE_MAP={
  'SQ Abdomen UL':'front-3',  'SQ Abdomen UR':'front-4',
  'SQ Abdomen ML':'front-5',  'SQ Abdomen MR':'front-6',
  'SQ Abdomen LL':'front-7',  'SQ Abdomen LR':'front-8',
  'SQ Abdomen':'front-5','SQ Abdomen L':'front-5','SQ Abdomen R':'front-6',
  'SQ Flank L':'front-9','SQ Flank R':'front-10',
  'SQ Thigh L':'front-13','SQ Thigh R':'front-14','SQ Thigh':'front-13',
  'SQ Triceps L':'back-17','SQ Triceps R':'back-18',
  'IM Deltoid L':'front-1','IM Deltoid R':'front-2','IM Deltoid':'front-1',
  'IM Glute L':'back-21','IM Glute R':'back-22','IM Glute':'back-21'
};

function resolveSiteToCell(site){
  if(!site)return null;
  const direct=getSiteCell(site);
  if(direct)return direct;
  const mapped=LEGACY_SITE_MAP[site];
  return mapped?getSiteCell(mapped):null;
}

// Canonical injection site for persistence — resolves dropdown, map pick, and legacy values.
function resolveInjectionSite(){
  const siteEl=g('lg-site');
  let raw=siteEl?siteEl.value:'';
  const stored=siteEl&&siteEl.dataset?siteEl.dataset.resolvedSite:'';
  if((!raw||raw==='Other')&&stored)raw=stored;
  if(!raw)return '';
  if(/^Oral$/i.test(raw))return 'Oral';
  if(/^intranasal$/i.test(raw)||/^IN\b|Intranasal/i.test(raw))return 'intranasal';
  if(/^(front|back)-\d+$/i.test(raw))return raw;
  if(typeof LEGACY_SITE_MAP==='object'&&LEGACY_SITE_MAP[raw])return LEGACY_SITE_MAP[raw];
  if(getSiteCell(raw))return raw;
  return raw;
}

// Display name for a site value. Handles all three formats:
//   "front-47"        → "Abd BR #15 (front-15)"  (kept compact)
//   "f-15" / "b-22"   → if it resolves, render via the cell; else as-is
//   "SQ Abdomen UL"   → keep as-is (already human-readable)
function siteDisplayName(site){
  if(!site)return '';
  if(/^intranasal$/i.test(site)||/^IN\b|Intranasal/i.test(site))return 'Intranasal (nose)';
  const c=getSiteCell(site);
  if(c){
    // Show region short name + cell number from the chart
    return c.region.short+' #'+c.number;
  }
  return site;
}

// Is this an IM site? Used to decide IM vs SQ syringe decrement on log.
function siteIsIM(site){
  if(!site)return false;
  if(/^intranasal$/i.test(site)||/^IN\b|Intranasal|Nasal|Nose/i.test(site))return false;
  if(/^IM\b|Deltoid|Glute|Ventrogluteal/i.test(site))return true;
  const c=getSiteCell(site);
  return !!(c&&(c.region.type==='IM'||(c.region.type==='SQ+IM'&&pepRoute(gv('lg-pep'))==='IM')));
}

function renderRotation(){
  const wrap=g('rotation-svg-wrap'),sum=g('rotation-summary');
  if(!wrap)return;
  const today=new Date();today.setHours(0,0,0,0);
  const daysSince=iso=>{const d=new Date(iso);d.setHours(0,0,0,0);return Math.floor((today-d)/86400000);};

  buildSiteCells();

  // Route filtering — read the currently-selected peptide's route. When it's
  // 'SQ' we'll block IM regions; when 'IM' we'll block SQ regions; when
  // 'both' (or no peptide chosen) nothing is blocked.
  const lpEl=g('lg-pep');
  const currentPep=lpEl?lpEl.value:'';
  const currentRoute=pepRoute(currentPep);

  // Update the explanatory note above the diagram.
  const noteEl=g('rotation-route-note');
  if(noteEl){
    if(currentRoute==='both'||!currentPep){
      noteEl.dataset.active='false';
      noteEl.innerHTML='';
    } else {
      noteEl.dataset.active='true';
      const pillCls=currentRoute==='SQ'?'#0F766E':'#5B21B6';
      noteEl.innerHTML='Showing <span class="rn-pill" style="color:'+pillCls+'">'+currentRoute+'</span> sites for <strong>'+escH(currentPep)+'</strong>. Sites for the other route are dimmed.';
    }
  }

  // Per-cell shot data — for activity rollup at the region level
  const cellData={};
  SITE_CELLS.forEach(c=>{cellData[c.cellId]={lastDays:null,count:0};});
  (S.shots||[]).forEach(sh=>{
    const c=resolveSiteToCell(sh.site);
    if(!c)return;
    const d=daysSince(sh.date);
    cellData[c.cellId].count++;
    if(cellData[c.cellId].lastDays===null||d<cellData[c.cellId].lastDays){
      cellData[c.cellId].lastDays=d;
    }
  });

  const regionStatus=(rk)=>{
    const r=SITE_REGIONS[rk];
    let recentCount=0,usedCount=0,minDays=null;
    r.cells.forEach(n=>{
      const cid=r.side==='f'?'front-'+n:'back-'+n;
      const cd=cellData[cid];
      if(!cd)return;
      if(cd.count>0)usedCount++;
      if(cd.lastDays!==null){
        if(cd.lastDays<3)recentCount++;
        if(minDays===null||cd.lastDays<minDays)minDays=cd.lastDays;
      }
    });
    return {recentCount,usedCount,minDays,total:r.cells.length};
  };
  const activityFor=(st)=>{
    if(st.recentCount>=3)return {a:'hot',label:'Heavy use (3+ in last 3d)'};
    if(st.recentCount>0) return {a:'warm',label:'Recent use'};
    if(st.usedCount>0)   return {a:'rested',label:'Some history'};
    return {a:'unused',label:'Unused'};
  };

  // Currently-selected region (from log form dropdown). Multiple regions
  // can match if the legacyZone covers more than one (e.g. "SQ Thigh L"
  // → both upper and lower viewer's left thigh).
  const selectedSite=(g('lg-site')&&g('lg-site').value)||'';
  const selectedRegions=new Set();
  Object.entries(SITE_REGIONS).forEach(([rk,r])=>{
    if(r.disabled)return;
    if(r.legacyZone===selectedSite)selectedRegions.add(rk);
  });

  // ===== Rotation recommender — computed BEFORE body diagram render
  // so per-region rendering can reference recRank without a TDZ error.
  // Compute zone-level rotation suggestions. For each legacy dropdown zone,
  // aggregate the days-since-most-recent-use across all regions that map
  // to it (e.g. "SQ Thigh L" includes both upper and back-of-thigh).
  const zoneStats={};
  Object.entries(SITE_REGIONS).forEach(([rk,r])=>{
    if(r.disabled)return;  // skip non-recommended sites from rotation suggestions
    const z=r.legacyZone||'Other';
    if(!zoneStats[z])zoneStats[z]={lastDays:null,count:0,zone:z};
    r.cells.forEach(n=>{
      const cid=r.side==='f'?'front-'+n:'back-'+n;
      const cd=cellData[cid];
      if(!cd)return;
      zoneStats[z].count+=cd.count;
      if(cd.lastDays!==null&&(zoneStats[z].lastDays===null||cd.lastDays<zoneStats[z].lastDays)){
        zoneStats[z].lastDays=cd.lastDays;
      }
    });
  });
  // Look up readable label from the dropdown for display
  const zoneLabel=zone=>{
    const sel=g('lg-site');
    if(sel){
      const opt=Array.from(sel.options).find(o=>o.value===zone);
      if(opt)return opt.textContent;
    }
    return zone;
  };
  // Find the top 3 zones to recommend. Filtering rules:
  //  - Skip 'Other' (no body location)
  //  - Skip zones whose type doesn't match the selected peptide's route
  //    (so an SQ peptide won't be told to use Glute L)
  // Ranking priority (most-rested first within each tier):
  //   1. rested >=7d
  //   2. never used (count===0)
  //   3. most-rested available
  // We compute a single ordered list and take the first 3.
  const zoneType=(zone)=>{
    const r=Object.values(SITE_REGIONS).find(rr=>rr.legacyZone===zone&&!rr.disabled);
    return r?r.type:'';
  };
  const allowedZone=(zone)=>{
    if(currentRoute==='both'||!currentPep)return true;
    const t=zoneType(zone);
    return !t||routeAllows(currentRoute,t);
  };
  const zones=Object.values(zoneStats)
    .filter(z=>z.zone!=='Other')
    .filter(z=>allowedZone(z.zone));
  // Score each zone for ranking. Higher score = better next pick.
  // Rested>=7d gets a flat priority bump; unused gets a smaller bump;
  // within each tier, more-rested wins. Score is a single number so we
  // can sort once and slice the top 3.
  const scoreZone=(z)=>{
    if(z.lastDays!==null&&z.lastDays>=7)return 10000+z.lastDays;
    if(z.count===0)return 5000;  // unused but not necessarily 'rested'
    return (z.lastDays??0);       // most-rested-but-recent
  };
  const ranked=zones.slice().sort((a,b)=>scoreZone(b)-scoreZone(a));
  const topPicks=ranked.slice(0,3);
  // Map: legacyZone -> rank (1, 2, 3) for body-diagram highlighting
  const recRank={};
  topPicks.forEach((z,i)=>{recRank[z.zone]=i+1;});
  // Backward-compat: keep nextBestZone variable in scope for the rest of
  // the function (rendering the original single-pill UI block, even though
  // we replace it below).
  const nextBestZone=topPicks[0]||null;

  // Build the body diagram: a single <img> of the chart photo with one
  // absolutely-positioned <div> hotspot per region. The photo is 991x764
  // and contains FRONT (left half) + BACK (right half); SITE_REGIONS.px,
  // py, pw, ph are percentages of the *full* image width/height for the
  // bounding box of each region's colored cells. The img preserves aspect
  // ratio; positioning the hotspots in % of the wrapper means they scale
  // with the image at any viewport width.
  const photoWrapExisting=wrap.querySelector('#rotation-photo-wrap');
  const reusePhoto=!!(photoWrapExisting&&photoWrapExisting.querySelector('img[src]'));
  let overlayParts='';
  Object.entries(SITE_REGIONS).forEach(([rk,r])=>{
    const st=regionStatus(rk);
    const act=activityFor(st);
    const isSelected=selectedRegions.has(rk);
    const isDisabled=!!r.disabled;
    const cellRange=r.cells.join(', ');
    const summary=st.usedCount>0
      ? st.usedCount+'/'+st.total+' used \u00b7 '+(st.minDays===null?'':(st.minDays===0?'today':st.minDays+'d ago'))
      : 'unused';
    const tip=isDisabled
      ? r.label+' \u2014 not a recommended injection site (sciatic nerve risk)'
      : '['+r.type+'] '+r.label+' (cells '+cellRange+') \u2014 '+act.label+' \u00b7 '+summary;
    const style='left:'+r.px+'%;top:'+r.py+'%;width:'+r.pw+'%;height:'+r.ph+'%';
    // Route-blocked: this region's type doesn't match the peptide's route.
    // Stays in the DOM (so users see the full chart) but isn't clickable.
    const isRouteBlocked=!isDisabled&&!routeAllows(currentRoute,r.type);
    // Recommendation rank: 1, 2, or 3 if this region is in a top-3 zone,
    // otherwise empty. Disabled and route-blocked regions never get a
    // rank — would be meaningless if you can't use them.
    const recRankNum=(!isDisabled&&!isRouteBlocked&&recRank[r.legacyZone])||0;
    const tipFinal=isRouteBlocked
      ? r.label+' \u2014 not used for '+(currentRoute==='SQ'?'subcutaneous':'intramuscular')+' peptides'
      : (recRankNum?'★ RECOMMENDED #'+recRankNum+' \u00b7 '+tip:tip);
    overlayParts+='<div class="rot-hot" '
      +'data-region="'+rk+'" '
      +'data-type="'+r.type+'" '
      +'data-activity="'+act.a+'" '
      +'data-selected="'+(isSelected?'true':'false')+'" '
      +'data-disabled="'+(isDisabled?'true':'false')+'" '
      +'data-route-blocked="'+(isRouteBlocked?'true':'false')+'" '
      +'data-recommended="'+(recRankNum||'')+'" '
      +'title="'+escH(tipFinal)+'" '
      +'style="'+style+'">'
      +''
      +'</div>';
  });
  // Fixed green marker rings around visible cells 1, 3, 13, and 18.
  Object.entries(SITE_REGIONS).forEach(([rk,r])=>{
    const n=(r.cells&&r.cells.length===1)?r.cells[0]:null;
    if(![1,3,13,18].includes(n))return;
    const scale=2/3;
    const rw=r.pw*scale, rh=r.ph*scale;
    const rx=r.px+(r.pw-rw)/2, ry=r.py+(r.ph-rh)/2;
    overlayParts+='<div class="marker-ring" data-ring-cell="'+n+'" style="left:'+rx+'%;top:'+ry+'%;width:'+rw+'%;height:'+rh+'%"></div>';
  });
  if(reusePhoto){
    photoWrapExisting.querySelectorAll('.rot-hot,.marker-ring').forEach(el=>el.remove());
    photoWrapExisting.insertAdjacentHTML('beforeend',overlayParts);
  }else{
    wrap.innerHTML='<div id="rotation-photo-wrap"><img src="'+SITE_PHOTO_DATA_URL+'" alt="Injection-site reference chart" draggable="false">'+overlayParts+'</div>';
  }

  // Click handlers — sync the dropdown to the clicked region. Skip both
  // sciatic-disabled regions and route-blocked regions (the peptide's route
  // doesn't match the region's type).
  wrap.querySelectorAll('.rot-hot').forEach(el=>{
    if(el.dataset.disabled==='true')return;
    if(el.dataset.routeBlocked==='true')return;
    el.addEventListener('click',()=>{
      const rk=el.dataset.region;
      const r=SITE_REGIONS[rk];
      const select=g('lg-site');
      if(!select)return;
      const target=r.legacyZone||'Other';
      const exists=Array.from(select.options).find(o=>o.value===target);
      select.value=exists?target:'Other';
      // Trigger change so the color chip beside the dropdown updates too
      select.dispatchEvent(new Event('change',{bubbles:true}));
      renderRotation();
      try{select.scrollIntoView({behavior:'smooth',block:'nearest'});}catch(e){}
    });
  });


  const totalShots=(S.shots||[]).length;
  const usedCells=SITE_CELLS.filter(c=>cellData[c.cellId]&&cellData[c.cellId].count>0);
  const recentCells=SITE_CELLS.filter(c=>{const cd=cellData[c.cellId];return cd&&cd.lastDays!==null&&cd.lastDays<3;});

  const rows=[];
  // ===== Summary / next-best recommendation rendering =====
  // (Computation already done above; this block just builds the pills.)
  if(topPicks.length){
    // Render up to 3 ranked pills. #1 is filled green; #2 and #3 are
    // lighter green outlines. Each pill is clickable and selects that
    // zone in the dropdown (same behavior as before).
    const pillsHtml=topPicks.map((z,i)=>{
      const rank=i+1;
      const restStr=z.lastDays===null?'never used':z.lastDays===0?'today':z.lastDays+'d rest';
      const typeLabel=zoneType(z.zone);
      const labelTxt=zoneLabel(z.zone);
      return '<button class="rec-pill vl-row-pick" data-rank="'+rank+'" data-zone="'+escH(z.zone)+'" '
        +'title="Pick '+escH(labelTxt)+' \u2014 '+escH(restStr)+'">'
        +'<span class="rec-rank">'+rank+'</span>'
        +escH(labelTxt)
        +(typeLabel?'<span class="rec-type-tag">'+typeLabel+'</span>':'')
        +'<span class="rec-rest">'+escH(restStr)+'</span>'
        +'</button>';
    }).join('');
    const headLabel=topPicks.length===1?'Next best':'Next best — ranked';
    rows.push(
      '<div class="rec-row">'
        +'<span class="rec-label">'+headLabel+'</span>'
        +pillsHtml
      +'</div>'
    );
  } else if(currentPep&&currentRoute!=='both'){
    // No zones match the route — surface the reason instead of going silent
    rows.push(
      '<div style="text-align:center;padding:4px 0;font-size:11px;color:var(--color-text-tertiary)">'
        +'No '+currentRoute+' zones available for recommendation.'
      +'</div>'
    );
  }
  // Stats
  rows.push(
    '<div style="padding-top:4px;text-align:center;font-size:11px;display:flex;gap:14px;justify-content:center;flex-wrap:wrap">'
    +'<span><strong style="color:#059669">Cells used:</strong> '+usedCells.length+'/'+SITE_CELLS.length+'</span>'
    +(recentCells.length?'<span><strong style="color:var(--accent-red-fg)">Recent (&lt;3d):</strong> '+recentCells.length+'</span>':'')
    +'<span><strong style="color:var(--color-text-tertiary)">Total shots:</strong> '+totalShots+'</span>'
    +'</div>'
  );
  rows.push(
    '<div style="padding-top:6px;margin-top:4px;border-top:.5px dashed rgba(14,116,144,.22);font-size:10.5px;color:var(--accent-cyan-fg);text-align:center;line-height:1.5">'
      +'Click any numbered square on the chart to set the exact Site dropdown option. '
      +'<em>Educational aid — not a substitute for clinical training.</em>'
    +'</div>'
  );
  if(sum)sum.innerHTML=rows.join('');
  // Wire the next-best pill — sets the legacy zone on the dropdown
  if(sum)sum.querySelectorAll('[data-zone]').forEach(el=>{
    el.addEventListener('click',()=>{
      const z=el.dataset.zone;
      const select=g('lg-site');
      if(!select)return;
      const exists=Array.from(select.options).find(o=>o.value===z);
      if(exists)select.value=z;
      renderRotation();
    });
  });

  const countEl=g('rotation-shot-count');
  if(countEl){
    const n=(S.shots||[]).length;
    countEl.textContent=n?'Tracking '+n+' shot'+(n!==1?'s':''):'No shots logged yet';
  }
}

function renderLogShotRows(){
  let shotRows=[...S.shots];
  const s=shotRows.sort((a,b)=>{
    // Descending by date, then by recency within the same date (last-logged-first).
    // id is monotonic (S.nS++), so newer shots have higher ids regardless of time field.
    const d=b.date.localeCompare(a.date);
    return d!==0?d:(b.id||0)-(a.id||0);
  });
  // Known side-effect tag labels. Unknown tags (user-custom) fall through to `t` and MUST be escaped.
  const TAG_LBL={'energy':'⚡ Energy','sleep':'💤 Sleep','appetite-down':'↓ Appetite','appetite-up':'↑ Appetite','mood':'🙂 Mood','nausea':'🤢 Nausea','fatigue':'😴 Fatigue','headache':'🤕 Headache','flush':'🔥 Flush','joints':'🦴 Joints','recovery':'💪 Recovery','site-irritation':'📍 Site'};
  const rowHtml=(x,ri)=>{
    const c=pepColor(x.peptide);
    const pepSafe=escH(x.peptide);
    const siteSafe=escH(siteDisplayName(x.site)||'');
    const dateSafe=escH(x.date||'');
    const notesSafe=escH(x.notes||'');
    const pb='<button class="lg-pep-btn" data-pep="'+pepSafe+'" title="View dose history chart" style="font-size:10px;padding:2px 7px;border-radius:6px;font-weight:500;background:'+c.bg+';color:'+c.text+';border:.5px solid '+c.border+';cursor:pointer;font-family:inherit">'+pepSafe+'</button>';
    // v33.375-stable-vendor-post-import-review: per-row checkbox + Delete button
    const _chk='<input type="checkbox" class="lg-row-chk" data-sid="'+x.id+'" title="Select for bulk delete" style="cursor:pointer">';
    const _del='<button type="button" class="lg-row-del" data-sid="'+x.id+'" title="Delete this shot" style="background:transparent;border:none;color:#A32D2D;font-size:14px;cursor:pointer;padding:1px 5px;font-family:inherit">🗑</button>';
    const tb=x.time==='am'
      ?'<span style="font-size:10px;padding:2px 6px;border-radius:3px;background:#FAEEDA;color:var(--accent-amber-fg)">AM</span>'
      :'<span style="font-size:10px;padding:2px 6px;border-radius:3px;background:#EEEDFE;color:#534AB7">PM</span>';
    const noteMark=x.notes?'<span title="'+notesSafe+'" style="margin-right:6px;cursor:help">📝</span>':'';
    const vu=x.volumeUnit||'mL';
    const isPill=(x.doseUnit||'')==='pill'||vu==='pill';
    const vt=isPill
      ?'<span style="color:var(--color-text-tertiary)">—</span>'
      :(vu==='units'?Math.round(x.volume)+' '+vu:x.volume.toFixed(2)+' '+vu);
    const dt=fmtDose(x.dose,x.doseUnit||'mcg')||(x.dose+' '+(x.doseUnit||'mcg'));
    const sevChip=x.severity
      ?'<span class="shot-tag" style="background:#FEF3C7;color:var(--accent-amber-fg);border-color:#FCD34D">Sev '+parseInt(x.severity)+'</span>'
      :'';
    const tagChips=(x.tags&&x.tags.length)
      // Known tags map to a safe label; unknown (user-custom) strings go through escH.
      ?x.tags.map(t=>'<span class="shot-tag">'+(TAG_LBL[t]||escH(t))+'</span>').join('')
      :'';
    const tagsRow=(tagChips||sevChip)?'<div class="shot-tags">'+tagChips+sevChip+'</div>':'';
    // Type chip: SQ / IM tag derived from the shot. ensureShotTypes() sets
    // x.type for legacy shots; new shots get it at log time.
    const shotType=x.type||(siteIsIM(x.site)?'IM':'SQ');
    const typeChip='<span class="shot-route-chip" data-type="'+shotType+'" title="'+(shotType==='IM'?'Intramuscular':'Subcutaneous')+'">'+shotType+'</span>';
    const rowCls=(ri%2===0?'lg-row-even':'lg-row-odd')+(x.time==='am'?' lg-am':' lg-pm');return'<tr class="'+rowCls+'"><td style="width:24px;text-align:center">'+_chk+'</td><td>'+typeChip+dateSafe+tagsRow+'</td><td>'+tb+'</td><td>'+pb+'</td><td style="font-weight:600;color:#1D5E93">'+dt+'</td><td style="color:var(--color-text-secondary)">'+vt+'</td><td style="font-size:11px">'+siteSafe+'</td><td style="white-space:nowrap">'+noteMark+'<button class="btn" style="padding:3px 8px;font-size:11px;color:var(--accent-blue-fg);margin-right:4px" data-sid="'+parseInt(x.id)+'">Edit</button>'+_del+'</td></tr>';
  };
  const emptyRow='<tr><td colspan="8" class="empty-state" style="padding:2rem 1rem"><div class="empty-state-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20.91 8.84 8.56 21.2a4.5 4.5 0 1 1-6.36-6.36l12.35-12.36a3 3 0 1 1 4.24 4.24L6.44 18.92a1.5 1.5 0 1 1-2.12-2.12l10.6-10.61"/></svg></div><h4>No shots logged yet</h4><p>Fill in the form above to log your first shot. It\'ll appear here with dose, site, tags, and any notes you add.</p></td></tr>';
  // RX-LOG-ROWS-R1: merge Rx takes (S.rxLog, from the weekly Rx card's
  // Taken-today checkbox / + Log button) into the shot log as read-only rows
  // with a 💊 Rx chip, so pills like Fin/Min show alongside injections.
  const rxRowHtml=(e,ri)=>{
    const nameSafe=escH(e.name||'');
    const dateSafe=escH(e.date||'');
    const timeSafe=escH(e.time||'');
    const _low=String(e.name||'').trim().toLowerCase();
    const med=(S.rx||[]).find(r=>r&&String(r.name||'').trim().toLowerCase()===_low);
    const doseTxt=(med&&med.dose)?escH(med.dose):'—';
    const hr=parseInt(String(e.time||'').slice(0,2),10);
    const isAm=isNaN(hr)?true:hr<12;
    const tb=isAm
      ?'<span style="font-size:10px;padding:2px 6px;border-radius:3px;background:#FAEEDA;color:var(--accent-amber-fg)">AM</span>'
      :'<span style="font-size:10px;padding:2px 6px;border-radius:3px;background:#EEEDFE;color:#534AB7">PM</span>';
    const timeSm=timeSafe?'<div style="font-size:9.5px;color:var(--color-text-tertiary);margin-top:2px">'+timeSafe+'</div>':'';
    const typeChip='<span class="shot-route-chip" title="Prescription (Rx card)" style="background:#CCFBF1;color:#0F766E;border-color:#5EEAD4">💊 Rx</span>';
    const pb='<span style="font-size:10px;padding:2px 7px;border-radius:6px;font-weight:600;background:#F0FDFA;color:#0F766E;border:.5px solid #5EEAD4">'+nameSafe+'</span>';
    const _del='<button type="button" class="lg-rx-del" data-rxname="'+nameSafe+'" data-rxdate="'+dateSafe+'" data-rxtime="'+timeSafe+'" title="Delete this Rx entry" style="background:transparent;border:none;color:#A32D2D;font-size:14px;cursor:pointer;padding:1px 5px;font-family:inherit">🗑</button>';
    const rowCls=(ri%2===0?'lg-row-even':'lg-row-odd')+(isAm?' lg-am':' lg-pm');
    return '<tr class="'+rowCls+'"><td style="width:24px;text-align:center"></td><td>'+typeChip+dateSafe+'</td><td>'+tb+timeSm+'</td><td>'+pb+'</td><td style="font-weight:600;color:#0F766E">'+doseTxt+'</td><td style="color:var(--color-text-tertiary)">—</td><td style="font-size:11px;color:var(--color-text-tertiary)">oral</td><td style="white-space:nowrap">'+_del+'</td></tr>';
  };
  const merged=[
    ...s.map(x=>({kind:'shot',x})),
    ...((S.rxLog||[]).filter(e=>e&&e.date&&e.name).map(e=>({kind:'rx',e})))
  ].sort((A,B)=>{
    const da=(A.kind==='shot'?A.x.date:A.e.date)||'';
    const db=(B.kind==='shot'?B.x.date:B.e.date)||'';
    const d=db.localeCompare(da);if(d!==0)return d;
    if(A.kind!==B.kind)return A.kind==='shot'?-1:1;
    if(A.kind==='shot')return (B.x.id||0)-(A.x.id||0);
    return String(B.e.time||'').localeCompare(String(A.e.time||''));
  });
  const tbody=g('lg-tbody');
  if(tbody)tbody.innerHTML=merged.length?merged.map((m,i)=>m.kind==='shot'?rowHtml(m.x,i):rxRowHtml(m.e,i)).join(''):emptyRow;
}
// RX-LOG-ROWS-R1: delegated delete for Rx rows in the shot log.
if(!window._lgRxDelWired){
  window._lgRxDelWired=true;
  document.addEventListener('click',function(e){
    const b=e.target&&e.target.closest&&e.target.closest('.lg-rx-del');
    if(!b)return;
    if(!window.S||!Array.isArray(S.rxLog))return;
    if(!confirm('Delete this Rx entry ("'+(b.dataset.rxname||'')+'" on '+(b.dataset.rxdate||'')+')?'))return;
    const i=S.rxLog.findIndex(x=>x&&x.name===b.dataset.rxname&&x.date===b.dataset.rxdate&&String(x.time||'')===String(b.dataset.rxtime||''));
    if(i<0)return;
    S.rxLog.splice(i,1);
    try{save()}catch(_){}
    try{renderLogShotRows()}catch(_){}
    try{renderCal()}catch(_){}
    try{window.renderRx&&renderRx()}catch(_){}
  });
}
function scheduleRenderLogHeavy(){
  if(window._renderLogHeavyQueued)return;
  window._renderLogHeavyQueued=true;
  const run=()=>{
    window._renderLogHeavyQueued=false;
    try{renderRotation();renderLogShotRows();}catch(_){}
  };
  if(typeof requestIdleCallback==='function')requestIdleCallback(run,{timeout:400});
  else setTimeout(run,0);
}
function refreshLogAfterShotChange(){
  try{renderLogShotRows();}catch(_){}
  try{scheduleRenderLogHeavy();}catch(_){}
}
// Shot Log dose unit when inventory/last-shot has none. Prefer mg (not mcg/units).
const SHOT_LOG_DEFAULT_DOSE_UNIT='mg';
function normalizeShotLogDoseUnit(unit){
  const u=String(unit||'').trim().toLowerCase();
  if(u==='mg'||u==='mcg'||u==='pill'||u==='iu') return u;
  // "units"/mL/iu are volume-ish — never use them as the dose unit default.
  return SHOT_LOG_DEFAULT_DOSE_UNIT;
}
function applyCalcLastToShotLogForm(resolved,last){
  if(!last||last.over||!resolved||!resolved.pep) return false;
  const pepSelectEl=g('lg-pep'),doseEl=g('lg-dose'),doseUnitEl=g('lg-dose-unit'),volEl=g('lg-vol'),volUnitEl=g('lg-vol-unit');
  if(!pepSelectEl||!doseEl||!doseUnitEl||!volEl||!volUnitEl) return false;
  clearLgSiteUserPicked();
  document.querySelectorAll('#lg-tag-row .tag-chip:not([data-custom]), #lg-severity .sev-chip').forEach(c=>c.classList.remove('on'));
  document.querySelectorAll('#lg-tag-row .tag-chip[data-custom]').forEach(c=>c.remove());
  const notesEl=g('lg-notes');if(notesEl)notesEl.value='';
  const customInput=g('lg-tag-custom');if(customInput)customInput.value='';
  const loadedPep=resolved.pep;
  const sel=g('lg-pep');
  if(loadedPep&&sel&&[...sel.options].some(o=>o.value===loadedPep.name)){
    sel.value=loadedPep.name;
    autofillShotLogForPep(loadedPep.name);
  }else{
    applyLgSiteDomValue('');
  }
  sv('lg-dose',last.dose);
  sv('lg-dose-unit',normalizeShotLogDoseUnit(last.doseUnit));
  // Shot Log volume always defaults to mL (U-100: 100 units = 1 mL).
  sv('lg-vol-unit','mL');
  if(last.volMl>0){
    sv('lg-vol',last.volMl.toFixed(3).replace(/\.?0+$/,''));
  }else if(last.units!=null&&!isNaN(last.units)){
    sv('lg-vol',(Number(last.units)/100).toFixed(3).replace(/\.?0+$/,''));
  }
  // Calc → log is always "log what I just drew now." Never inherit a leftover
  // calendar focus day (e.g. user tapped Wednesday earlier, then logged from calc).
  const dateEl=g('lg-date');if(dateEl)dateEl.value=td();
  const timeEl=g('lg-time');
  if(timeEl){
    const hr=new Date().getHours();
    const ampm=hr<12?'am':'pm';
    if([...timeEl.options].some(o=>o.value===ampm))timeEl.value=ampm;
  }
  return true;
}
function renderLog(opts){
  // Keep the peptide picker in sync with current inventory (fridge items sorted first)
  popSel();
  if(!_lgSiteUserPicked){
    const _siteEl=g('lg-site');
    const _lastSite=readLastInjectionSite();
    if(_siteEl&&_lastSite&&(!_siteEl.value||_siteEl.value===''))applyLgSiteDomValue(_lastSite);
  }
  const fd=readFocusDate();
  if(fd)applyFocusDateToForms(fd);
  if(opts&&opts.formOnly){
    scheduleRenderLogHeavy();
    return;
  }
  renderRotation();
  renderLogShotRows();
}

// Switch to the Shot Log page and pre-fill the form for a peptide. Used by:
//  - clicking a peptide cell in the Daily Stack
//  - the "Log shot" tile in the calendar action popup
// Pre-fills: peptide name, AM/PM (based on current hour), today's date, and
// typical dose / volume from the inventory item. Skips silently if the peptide
// is filtered out of the dropdown (e.g. isPeptide:false).
function deepLinkLogShotForPep(pepName){
  if(!pepName)return;
  document.querySelectorAll('#nav button, .hdr-tab-btn').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('.page').forEach(p=>p.style.display='none');
  const navBtn=document.querySelector('#nav [data-pg="log"]');
  if(navBtn)navBtn.classList.add('on');
  g('pg-log').style.display='block';
  const tb=document.querySelector('.top-bar');if(tb)tb.style.display='';
  rememberCurrentPage('log');
  renderLog({formOnly:true});
  // Defer prefill one tick so the browser can paint the log form before heavy work.
  setTimeout(()=>{
    clearLgSiteUserPicked();
    // Clear stale state from any previous shot draft
    document.querySelectorAll('#lg-tag-row .tag-chip:not([data-custom]), #lg-severity .sev-chip').forEach(c=>c.classList.remove('on'));
    document.querySelectorAll('#lg-tag-row .tag-chip[data-custom]').forEach(c=>c.remove());
    const notesEl=g('lg-notes');if(notesEl)notesEl.value='';
    const customInput=g('lg-tag-custom');if(customInput)customInput.value='';
    // Select peptide if it's in the (filtered) dropdown.
    // CAL-LOG-PRELOAD-R1: don't require isPeptide!==false here — oil items like
    // TC 200/250 are isPeptide:false yet present in the dropdown; the option
    // check below is the real gate.
    const sel=g('lg-pep');
    const pep=(S.inv||[]).find(p=>!p.isSupply&&p.name===pepName);
    if(sel&&pep&&[...sel.options].some(o=>o.value===pep.name)){
      sel.value=pep.name;
      // Autofill dose/vol/site from the last shot of this peptide (or fall
      // back to inventory's planned dose if no shots exist yet).
      autofillShotLogForPep(pep.name);
    }
    // AM/PM from current hour
    const timeEl=g('lg-time');
    if(timeEl){
      const hr=new Date().getHours();
      const ampm=hr<12?'am':'pm';
      if([...timeEl.options].some(o=>o.value===ampm))timeEl.value=ampm;
    }
    // Focus date from calendar, else today
    const dateEl=g('lg-date');if(dateEl)dateEl.value=readFocusDate()||td();
    // Land the user on the form
    const lgBtn=g('lg-btn');
    if(lgBtn)lgBtn.scrollIntoView({behavior:'smooth',block:'center'});
  },80);
}

let _chartInstance=null;
// Track the element that had focus before the chart modal opened, so we can restore it on close.
let _chartLastFocused=null;
function hidePeptideChart(){
  const m=g('chart-modal');
  if(m){
    m.style.display='none';
    m.setAttribute('aria-hidden','true');
  }
  if(_chartInstance){try{_chartInstance.destroy();}catch(e){}_chartInstance=null;}
  if(_chartLastFocused&&typeof _chartLastFocused.focus==='function'){_chartLastFocused.focus();}
  _chartLastFocused=null;
}
function showPeptideChart(name){
  const shots=(S.shots||[]).filter(s=>s.peptide===name).sort((a,b)=>a.date.localeCompare(b.date));
  const modal=g('chart-modal');
  const title=g('chart-title');
  const wrap=g('chart-wrap');
  const empty=g('chart-empty');
  const summary=g('chart-summary');
  title.textContent=name+' — dose history';
  _chartLastFocused=document.activeElement;
  modal.style.display='flex';
  modal.setAttribute('aria-hidden','false');
  // Move focus to the close button so keyboard users land somewhere meaningful inside the dialog.
  setTimeout(()=>{const btn=g('chart-close');if(btn)btn.focus();},0);
  if(_chartInstance){try{_chartInstance.destroy();}catch(e){}_chartInstance=null;}
  if(!shots.length){
    wrap.style.display='none';
    summary.textContent='';
    empty.style.display='block';
    empty.textContent='No shots logged yet for '+name+'.';
    return;
  }
  empty.style.display='none';
  wrap.style.display='block';
  // Normalize every dose to mcg so mixed units can be compared
  const toMcg=s=>{const _du=(s.doseUnit||'mcg');return (_du==='mg'||_du==='iu')?(Number(s.dose)||0)*1000:(Number(s.dose)||0);};
  // Pick a display unit for the axis/summary: mg if every shot is mg, otherwise mcg
  const allMg=shots.length>0&&shots.every(s=>(s.doseUnit||'mcg')==='mg');
  const axisUnit=allMg?'mg':'mcg';
  const labels=shots.map(s=>s.date);
  const data=shots.map(s=>{const m=toMcg(s);return allMg?m/1000:m;});
  const c=pepColor(name);
  // Pull current theme-aware text color so the chart reads in both light and dark mode
  const textColor=getComputedStyle(document.documentElement).getPropertyValue('--color-text-secondary').trim()||'#6b6b67';
  const gridColor=getComputedStyle(document.documentElement).getPropertyValue('--color-border-tertiary').trim()||'#ebebea';
  _chartInstance=new Chart(g('chart-canvas').getContext('2d'),{
    type:'line',
    data:{labels:labels,datasets:[{
      label:name,
      data:data,
      borderColor:c.border,
      backgroundColor:c.bg,
      pointBackgroundColor:c.border,
      pointRadius:4,
      pointHoverRadius:6,
      tension:0.2,
      fill:true
    }]},
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{
          label:function(item){
            const s=shots[item.dataIndex];
            const vu=s.volumeUnit||'mL';
            const vt=vu==='units'?Math.round(s.volume)+' '+vu:s.volume.toFixed(2)+' '+vu;
            const bits=[s.dose+' '+(s.doseUnit||'mcg'),vt,s.site,(s.time||'').toUpperCase()];
            if(s.notes)bits.push('"'+s.notes+'"');
            return bits.filter(Boolean);
          }
        }}
      },
      scales:{
        x:{ticks:{font:{size:10},color:textColor,maxRotation:45,minRotation:0},grid:{color:gridColor}},
        y:{beginAtZero:true,title:{display:true,text:'Dose ('+axisUnit+')',font:{size:11},color:textColor},ticks:{font:{size:10},color:textColor},grid:{color:gridColor}}
      }
    }
  });
  const totalMcg=shots.reduce((a,s)=>a+toMcg(s),0);
  const totalDisplay=allMg?(totalMcg/1000):totalMcg;
  summary.textContent=shots.length+(shots.length===1?' shot · ':' shots · ')+'total '+totalDisplay.toLocaleString()+' '+axisUnit+' · '+shots[0].date+' → '+shots[shots.length-1].date;
}

// Render supply consumables (syringes, BAC water, alcohol pads) as tile cards in
// the dedicated supplies card. One tile per supply kind — large qty number,
// colored icon, inline warning badges, edit button. Runs from renderInv.
function renderSupplyTiles(supplies){
  const grid=g('supplies-grid');
  if(!grid)return;
  const escHtml=escH;  // was a local duplicate; now aliases the top-level helper
  const themeMap={
    sq:{icon:'💉',label:'SQ syringes',bg:'#DBEAFE',accent:'#1E40AF',border:'#93C5FD'},
    im:{icon:'🩸',label:'IM syringes',bg:'#E0E7FF',accent:'#3730A3',border:'#A5B4FC'},
    bac:{icon:'💧',label:'BAC water',bg:'#CFFAFE',accent:'#0E7490',border:'#67E8F9'},
    pad:{icon:'🧼',label:'Alcohol pads',bg:'#FEF3C7',accent:'#92400E',border:'#FCD34D'}
  };
  // Dynamic layout: balance tiles across 1-3 rows so the section doesn't expand
  // vertically without bound. Compute rows/columns to spread evenly.
  const count=supplies.length;
  let perRow;
  if(count<=4)perRow=4;          // 4 cols, 1 row  — default look
  else if(count<=6)perRow=count; // 5-6 cols, 1 row — shrink to fit
  else if(count<=12)perRow=Math.ceil(count/2);  // 2 rows balanced
  else perRow=Math.ceil(count/3);                // 3 rows balanced
  grid.style.gridTemplateColumns='repeat('+perRow+',1fr)';
  grid.style.gap=perRow>=6?'6px':perRow>=5?'8px':'10px';
  // Compact mode kicks in once tiles narrow past the "default" 4-per-row state
  const c=count>4;              // compact
  const cc=count>=6;             // extra-compact (hide SUPPLY label, inline badges smaller)
  const tilePad=cc?'9px 10px':c?'10px 12px':'12px 14px';
  const iconSz=cc?24:c?28:36;
  const iconFs=cc?12:c?14:18;
  const iconR=cc?7:c?8:10;
  const nameFs=cc?12:c?12.5:13;
  const qtyFs=cc?20:c?22:28;
  const qtyGap=cc?2:c?3:4;
  const unitFs=cc?10:11;
  const editPad=cc?'2px 6px':c?'2px 7px':'3px 8px';
  const editFs=cc?9.5:c?10:10.5;
  const hdrMb=cc?6:c?8:10;
  const badgeFs=cc?9:10;
  const badgePad=cc?'1px 5px':'2px 7px';
  grid.innerHTML=supplies.map(s=>{
    const kind=s.supplyKind||'sq';
    const theme=themeMap[kind]||{icon:'📦',label:s.name,bg:'#F3F4F6',accent:'#4B5563',border:'#D1D5DB'};
    const qty=s.dk||0;
    const nd=s.nd||0;
    const critical=qty<=1;
    const low=qty<=5&&qty>1;
    const qtyColor=critical?'#B91C1C':low?'#B45309':theme.accent;
    const statusLabel=critical
      ? '<span style="font-size:'+badgeFs+'px;font-weight:700;color:var(--accent-red-fg);background:#FEE2E2;padding:'+badgePad+';border-radius:6px;border:.5px solid #FCA5A5;white-space:nowrap">'+(cc?'⚠':'⚠ Critical')+'</span>'
      : low
        ? '<span style="font-size:'+badgeFs+'px;font-weight:700;color:var(--accent-amber-fg);background:#FEF3C7;padding:'+badgePad+';border-radius:6px;border:.5px solid #FCD34D;white-space:nowrap">Low</span>'
        : qty>0
          ? '<span style="font-size:'+badgeFs+'px;font-weight:600;color:'+theme.accent+';background:'+theme.bg+';padding:'+badgePad+';border-radius:6px;border:.5px solid '+theme.border+';white-space:nowrap">'+(cc?'OK':'Stocked')+'</span>'
          : '<span style="font-size:'+badgeFs+'px;color:var(--color-text-tertiary);background:rgba(0,0,0,.04);padding:'+badgePad+';border-radius:6px;white-space:nowrap">Out</span>';
    const orderFlag=(s.cn||s.us)?'<span style="font-size:'+badgeFs+'px;font-weight:600;color:var(--accent-amber-fg);background:#FEF3C7;padding:'+badgePad+';border-radius:6px;border:.5px solid #FCD34D;margin-left:4px;white-space:nowrap" title="'+((s.cn?'CN: '+s.cn:'')+(s.cn&&s.us?' · ':'')+(s.us?'US: '+s.us:'')).replace(/"/g,'&quot;')+'">'+(cc?'Ord':'On order')+'</span>':'';
    const buyFlag=nd>0?'<span style="font-size:'+badgeFs+'px;font-weight:600;color:var(--accent-red-fg);background:#FEE2E2;padding:'+badgePad+';border-radius:6px;border:.5px solid #FCA5A5;margin-left:4px;white-space:nowrap" title="Need to buy: '+nd+'">Buy</span>':'';
    const unit=s.customUnit||(kind==='bac'?'mL':'ct');
    const supplyLbl=cc?'':'<div style="font-size:10px;color:var(--color-text-tertiary);letter-spacing:.06em;text-transform:uppercase;margin-top:1px">SUPPLY</div>';
    return '<div style="background:#fff;border:.5px solid '+theme.border+';border-radius:12px;padding:'+tilePad+';position:relative;overflow:hidden;min-width:0">'
      +'<div style="position:absolute;top:0;left:0;width:'+(cc?3:4)+'px;height:100%;background:'+theme.accent+'"></div>'
      +'<div style="display:flex;align-items:center;gap:'+(cc?7:10)+'px;margin-bottom:'+hdrMb+'px">'
        +'<div style="width:'+iconSz+'px;height:'+iconSz+'px;border-radius:'+iconR+'px;background:'+theme.bg+';display:flex;align-items:center;justify-content:center;font-size:'+iconFs+'px;flex-shrink:0">'+theme.icon+'</div>'
        +'<div style="flex:1;min-width:0">'
          +'<div style="font-weight:600;font-size:'+nameFs+'px;color:var(--color-text-primary);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+escHtml(s.name)+'">'+escHtml(s.name)+'</div>'
          +supplyLbl
        +'</div>'
        +'<button class="btn inv-edit-btn" data-eid="'+s.id+'" title="Edit supply count" style="padding:'+editPad+';font-size:'+editFs+'px;color:'+theme.accent+';flex-shrink:0">Edit</button>'
      +'</div>'
      +'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:6px;flex-wrap:wrap">'
        +'<div style="display:flex;align-items:baseline;gap:'+qtyGap+'px">'
          +'<span style="font-size:'+qtyFs+'px;font-weight:700;color:'+qtyColor+';font-variant-numeric:tabular-nums;line-height:1">'+qty+'</span>'
          +'<span style="font-size:'+unitFs+'px;color:var(--color-text-tertiary);font-weight:500">'+unit+'</span>'
        +'</div>'
        +'<div style="display:flex;gap:3px;flex-wrap:wrap;justify-content:flex-end">'+statusLabel+orderFlag+buyFlag+'</div>'
      +'</div>'
    +'</div>';
  }).join('');
}

/* ============================================================
   SECTION: Inventory
   Peptide vial inventory (freezer/fridge counts, recon dates,
   days-supply math), the +Add/Edit peptide modal, supply items,
   and cross-view refresh after inventory changes.
   ============================================================ */

// v0.27.64: bulletproof inventory Delete that bypasses event delegation.
// The button's inline onclick calls this directly; it cannot be intercepted
// by the inv-tbody listener, swap mode, or any family-rollup handler.
window.ptInvDelete = function(idStr){
  if(!window.S || !Array.isArray(S.inv)) return;
  const id = parseInt(idStr, 10);
  if(isNaN(id)) return;
  const it = S.inv.find(i => i && i.id === id);
  if(!it) { alert('Inventory entry not found.'); return; }
  if(!confirm('Delete "' + (it.name || 'this peptide') + '" from inventory?\n\nThis also clears scheduled doses and shot-log entries for it. The action can be undone via Save backup.')) return;
  const nm = it.name;
  S.inv = S.inv.filter(x => x.id !== id);
  if(nm){
    S.shots = (S.shots || []).filter(s => s && s.peptide !== nm);
    for(let di = 0; di < 7; di++){
      try { delete S.sched[sk(nm, 'am', di)]; delete S.sched[sk(nm, 'pm', di)]; } catch(_){}
    }
  }
  try { typeof rebuildCM === 'function' && rebuildCM(); } catch(_){}
  try { typeof buildLegend === 'function' && buildLegend(); } catch(_){}
  try { typeof save === 'function' && save(); } catch(_){}
  try { typeof popSel === 'function' && popSel(); } catch(_){}
  try { typeof renderInv === 'function' && renderInv(); } catch(_){}
  try { typeof rr === 'function' && rr(); } catch(_){}
};

let _invRenderCoalesce=false;
let _invRenderTimer=null;

function renderInv(force){
  if(!force&&vialFormIsOpen())return;
  if(!force){
    if(_invRenderCoalesce)return;
    _invRenderCoalesce=true;
    clearTimeout(_invRenderTimer);
    _invRenderTimer=setTimeout(()=>{
      _invRenderCoalesce=false;
      _invRenderTimer=null;
      if(vialFormIsOpen())return;
      renderInv(true);
    },20);
    return;
  }
  clearTimeout(_invRenderTimer);
  _invRenderCoalesce=false;
  const escHtml=escH;  // aliases top-level helper (was a local duplicate)
  try{performance.mark('inv-filter-start');}catch(_){}
  const q=((g('inv-search')&&g('inv-search').value)||'').trim().toLowerCase();
  const allItems=q?S.inv.filter(i=>((i.name||'')+' '+(i.cn||'')+' '+(i.us||'')).toLowerCase().includes(q)):S.inv;
  try{
    performance.mark('inv-filter-end');
    performance.measure('inv-filter-duration','inv-filter-start','inv-filter-end');
  }catch(_){}
  const peptides=allItems.filter(i=>!i.isSupply);
  // v7: hide archived peptides from the inventory table unless
  // 'Show archived' toggle is on.
  const _showArchInv = (typeof tmpShowArchived === 'function') && tmpShowArchived();
  const _peptidesVisible = _showArchInv ? peptides : peptides.filter(p=>!p.archived);
  // Supplies render as tiles in their own card ABOVE the peptide table — always show
  // them regardless of the search filter so the user can always see their consumables.
  const supplies=(S.inv||[]).filter(i=>i.isSupply);
  const supplyOrder={sq:1,im:2,pad:3,bac:4};
  supplies.sort((a,b)=>(supplyOrder[a.supplyKind]||99)-(supplyOrder[b.supplyKind]||99));
  renderSupplyTiles(supplies);
  const items=_peptidesVisible;
  const _pepColorCache=new Map();
  const pepColorCached=n=>{
    if(_pepColorCache.has(n))return _pepColorCache.get(n);
    const c=pepColor(n);
    _pepColorCache.set(n,c);
    return c;
  };
  const rendered = items.map((i,idx)=>{
    const fz=i.fz||0,fr=i.fr||0,dk=i.dk||0,nd=i.nd||0;
    const t=fz+fr+dk;
    // Pill helpers used by peptide rows.
    const pill=(v,bg,tc,sub)=>v>0
      ?'<span style="display:inline-block;min-width:22px;padding:2px 7px;border-radius:20px;background:'+bg+';color:'+tc+';font-weight:700;font-size:11px;text-align:center;letter-spacing:-.01em">'+v+(sub?'<span style="font-weight:400;font-size:9px;opacity:.75"> ×'+sub+'</span>':'')+'</span>'
      :'<span style="color:var(--color-text-tertiary);font-size:12px">—</span>';
    const stockPill=v=>pill(v,'#DBEAFE','#1E3A8A',fmtVialMgSuffix(i.vialMg,i.vialMgDisplayUnit));
    const needPill =v=>pill(v,'#FEE2E2','#991B1B',null);
    const dosePill =v=>v&&v!=='—'?'<span style="display:inline-block;padding:2px 8px;border-radius:20px;background:#F0FDF4;color:var(--accent-green-fg);font-weight:600;font-size:11px;border:.5px solid #BBF7D0">'+v+'</span>':'<span style="color:var(--color-text-tertiary)">—</span>';
    const orderTag=v=>v?'<span style="display:inline-block;padding:2px 7px;border-radius:5px;background:var(--color-background-secondary);color:var(--color-text-secondary);font-size:10px;border:.5px solid var(--color-border-secondary)">'+v+'</span>':'<span style="color:var(--color-text-tertiary)">—</span>';
    // Status — compose multiple badges when the reality is multi-state.
    // Reconstituted vials live in the fridge; fridge > 0 means in use.
    // Stocked = freezer or desk has sealed/unopened vials.
    const badges=[];
    if(fr>0)badges.push('<span class="bdg" style="background:#DBEAFE;color:var(--accent-blue-fg);border:.5px solid #93C5FD" title="Reconstituted vial in fridge">In use</span>');
    if(fz>0||dk>0)badges.push('<span class="bdg bt" title="Freezer '+fz+' · Desk '+dk+'">Stocked</span>');
    if(i.cn||i.us)badges.push('<span class="bdg ba" title="'+((i.cn?'CN: '+i.cn:'')+(i.cn&&i.us?' · ':'')+(i.us?'US: '+i.us:'')).replace(/"/g,'&quot;')+'">On order</span>');
    if(nd>0)badges.push('<span class="bdg br2" title="Need to buy: '+nd+'">Buy</span>');
    if(!badges.length)badges.push('<span class="bdg" style="color:var(--color-text-tertiary)">Out</span>');
    const st='<div style="display:flex;gap:3px;flex-wrap:wrap">'+badges.join('')+'</div>';
    const c=pepColorCached(i.name);
    // Production date subtitle — shown under the peptide name, with age calculated.
    // Gives a quick visual for "how old is this batch?"
    let prodSub='';
    if(i.productionDate){
      const prodMs=new Date(i.productionDate).getTime();
      if(!isNaN(prodMs)){
        const days=Math.floor((Date.now()-prodMs)/(24*60*60*1000));
        let ageStr;
        if(days<30)ageStr=days+'d old';
        else if(days<365)ageStr=Math.floor(days/30)+' mo old';
        else ageStr=(days/365).toFixed(1)+' yr old';
        // Color-code by age — reference: most peptides stable 1-2 years refrigerated
        const ageColor=days<180?'var(--color-text-tertiary)':days<365?'#92400E':'#A32D2D';
        prodSub='<div style="font-size:10px;color:'+ageColor+';margin-top:2px">📅 '+i.productionDate+' <span style="opacity:.75">· '+ageStr+'</span></div>';
      }
    }
    const pb='<span title="'+escH(i.name)+'" style="font-size:13px;padding:3px 11px;border-radius:6px;font-weight:700;letter-spacing:-.01em;background:'+c.bg+';color:'+c.text+';border:1px solid '+c.text+';display:inline-block;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle">'+escH(i.name)+'</span>'+prodSub;
    const doseStr=fmtDose(i.dose,i.doseUnit)||'—';
    // Expiry badge: calculate days remaining if reconstitution date is set
    let expiryBadge='';
    if(i.reconDate){
      const expDays=i.reconExpDays||28;
      const reconMs=new Date(i.reconDate).getTime();
      const expMs=reconMs+expDays*24*60*60*1000;
      const daysLeft=Math.ceil((expMs-Date.now())/(24*60*60*1000));
      if(daysLeft<0){
        expiryBadge='<div style="font-size:10px;font-weight:600;color:#fff;background:#DC2626;border-radius:4px;padding:1px 6px;margin-top:2px;text-align:center">Expired</div>';
      } else if(daysLeft<=3){
        expiryBadge='<div style="font-size:10px;font-weight:600;color:#7C2D12;background:#FED7AA;border-radius:4px;padding:1px 6px;margin-top:2px;text-align:center">'+daysLeft+'d left</div>';
      } else if(daysLeft<=7){
        expiryBadge='<div style="font-size:10px;color:var(--accent-amber-fg);background:#FEF9C3;border-radius:4px;padding:1px 6px;margin-top:2px;text-align:center">'+daysLeft+'d left</div>';
      } else {
        expiryBadge='<div style="font-size:10px;color:var(--accent-green-fg);background:#DCFCE7;border-radius:4px;padding:1px 6px;margin-top:2px;text-align:center">'+daysLeft+'d left</div>';
      }
    }
    const days=countSchedDays(i.name);
    const freqBadge=days>0?'<span style="font-size:9px;padding:1px 5px;border-radius:4px;background:var(--color-background-secondary);color:var(--color-text-tertiary);margin-left:4px">'+days+'d</span>':'';
    const isSwap=swapId===i.id;
    const swapHint=isSwap?'<span style="font-size:10px;color:var(--color-text-secondary);margin-left:8px">↕ tap another row to swap</span>':'';
    const rowStyle=(isSwap?'cursor:pointer;background:'+c.bg+';outline:2px solid '+c.border+';outline-offset:-2px':'cursor:pointer')+';border-left:3px solid '+c.border+';';
    const actions=delConfirmId===i.id
      ?'<span style="font-size:11px;color:var(--color-text-secondary);margin-right:4px">Delete '+escH(i.name)+'?</span>'
       +'<button class="btn inv-del-yes" data-did="'+i.id+'" style="padding:3px 8px;font-size:11px;background:#A32D2D;color:#fff;border-color:var(--accent-red-fg);margin-right:4px">Yes</button>'
       +'<button class="btn inv-del-no" style="padding:3px 8px;font-size:11px">Cancel</button>'
      :(fz>0&&(i.fr||0)===0?'<button class="btn inv-recon-btn" data-rid="'+i.id+'" style="padding:3px 8px;font-size:11px;color:var(--accent-green-fg);margin-right:4px" title="Reconstitute: move one vial from Freezer → Fridge, stamp today as recon date">🧪 Recon</button>':'')
       +(fr>0?'<button class="btn inv-used-btn" data-uid="'+i.id+'" style="padding:3px 8px;font-size:11px;color:var(--accent-amber-fg);margin-right:4px" title="Mark the fridge vial as depleted (Fridge -1, clears recon date)">✓ Used</button>':'')
       +'<button class="btn inv-chart-btn" data-cid="'+i.id+'" style="padding:3px 8px;font-size:11px;margin-right:4px" title="View dose history" aria-label="View dose history">📈</button>'
       +'<button class="btn inv-edit-btn" data-eid="'+i.id+'" style="padding:3px 8px;font-size:11px;color:var(--accent-blue-fg);margin-right:4px">Edit</button>'
       +'<button type="button" class="btn inv-del-btn" data-did="'+i.id+'" onclick="event.stopPropagation();window.ptInvDeleteRouter&amp;&amp;window.ptInvDeleteRouter(parseInt(this.dataset.did));" style="padding:3px 8px;font-size:11px;color:var(--accent-red-fg)">Delete</button>';
    return'<tr data-iid="'+i.id+'" style="'+rowStyle+'">'
      +'<td><span class="inv-name-cell"><span class="inv-fam-slot" style="display:inline-block;width:20px;vertical-align:middle"></span>'+pb+freqBadge+swapHint+'</span></td>'
      +'<td>'+dosePill(doseStr)+expiryBadge+'</td>'
      +'<td>'+stockPill(fz)+'</td><td>'+stockPill(fr)+'</td><td>'+stockPill(dk)+'</td><td>'+needPill(nd)+'</td>'
      +'<td>'+orderTag(i.cn||'')+'</td>'
      +'<td style="font-size:11px;color:var(--color-text-secondary)">'+(i.us||'—')+'</td>'
      +'<td>'+st+'</td>'
      +'<td style="white-space:nowrap;text-align:right">'+actions+'</td>'
    +'</tr>';
  });
  // v0.27.12: family rollup. Group items by first-2-letter prefix; in
  // each family of 2+ items, pick an "in-use" primary and hide the rest
  // under it with a +N expand badge on the primary row.
  const _rowByIid = new Map();
  rendered.forEach(html => {
    const m = html.match(/data-iid="(\d+)"/);
    if(m) _rowByIid.set(parseInt(m[1]), html);
  });
  // Group by family
  const _famBuckets = new Map();
  items.forEach(i => {
    const fk = _invFamilyKey(i.name);
    let b = _famBuckets.get(fk);
    if(!b){ b = {key:fk, items:[]}; _famBuckets.set(fk, b); }
    b.items.push(i);
  });
  // Order: sort families alphabetically, single-item families bubble naturally
  const _famOrder = [..._famBuckets.values()].sort((a,b) => a.key.localeCompare(b.key));
  let __tableHtml = '';
  if(items.length){
    _famOrder.forEach(fam => {
      if(fam.items.length === 1){
        // Single-item family — render flat, no badge needed
        const html = _rowByIid.get(fam.items[0].id);
        if(html) __tableHtml += html;
        return;
      }
      // v0.27.46: chevron INLINE on the in-use primary row's name cell.
      // No separate toggle row. The primary row IS the group header — same
      // pattern as vials card (AD5/IP10/KL80 chevron rows).
      const sorted = [...fam.items].sort((a,b) => _invInUseScore(b) - _invInUseScore(a));
      const primary = sorted[0];
      const others = sorted.slice(1);
      const isExpanded = _invFamExpanded.has(fam.key);
      const cFam = (typeof pepColor==='function')?pepColor(primary.name):{bg:'#F3F4F6',text:'#374151',border:'#D1D5DB'};
      // v0.27.50: polished SVG chevron, deep purple (matches vials accent).
      const famBadge = '<span class="inv-fam-toggle inv-fam-arrow" data-famkey="'+fam.key+'" aria-expanded="'+isExpanded+'" '
        + 'title="'+(isExpanded?'Hide':'Show')+' '+others.length+' more variant'+(others.length===1?'':'s')+'" '
        + 'role="button" tabindex="0" '
        + 'style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:20px;height:14px;vertical-align:middle;color:#7C3AED;transition:transform .18s ease,color .15s ease;'+(isExpanded?'transform:rotate(90deg)':'')+'" '
        + 'onmouseover="this.style.color=\'#5B21B6\'" onmouseout="this.style.color=\'#7C3AED\'">'
        + '<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block">'
        + '<polyline points="3.5 2.5 7.5 5.5 3.5 8.5"></polyline>'
        + '</svg>'
        + '</span>';
      // Render primary row with chevron badge injected at start of name cell
      let primaryHtml = _rowByIid.get(primary.id);
      if(primaryHtml){
        primaryHtml = primaryHtml.replace('data-iid="'+primary.id+'"', 'data-iid="'+primary.id+'" data-famkey="'+fam.key+'" data-fam-primary="1"');
        primaryHtml = primaryHtml.replace('<span class="inv-fam-slot" style="display:inline-block;width:20px;vertical-align:middle"></span>', '<span class="inv-fam-slot" style="display:inline-block;width:20px;vertical-align:middle">'+famBadge+'</span>');
        __tableHtml += primaryHtml;
      }
      // Other variant rows — hidden when collapsed
      others.forEach(o => {
        let html = _rowByIid.get(o.id);
        if(!html) return;
        html = html.replace('data-iid="'+o.id+'"', 'data-iid="'+o.id+'" data-famkey="'+fam.key+'"');
        if(!isExpanded){
          html = html.replace('style="', 'style="display:none;');
        }
        __tableHtml += html;
      });
    });
    g('inv-tbody').innerHTML = __tableHtml;
  } else {
    g('inv-tbody').innerHTML = '<tr><td colspan="10" class="empty-state" style="padding:2rem 1rem">'+(q
    ? '<div class="empty-state-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div><h4>No matches</h4><p>No peptides match "'+q.replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]))+'". Try a different search term.</p>'
    : '<div class="empty-state-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M10.5 20.5 21 10l-10.5-.5L10 21"/><path d="M10 20.5 3 13.5l3.5-3.5L13 17"/></svg></div><h4>No peptides yet</h4><p>Use the <b>+ Add / Edit</b> button above to add your first peptide. You can set dose, amount per unit (mg or g for bulk), stock counts, and schedule in one place.</p>'
    )+'</td></tr>';
  }
}

// v0.27.9: helpers for inventory table grouping by stack assignment.
function _invStackOf(name){
  const sched = (window.S && S.sched) || {};
  let hasAm = false, hasPm = false;
  for(let di = 0; di < 7; di++){
    if(sched[name+'/am/'+di]) hasAm = true;
    if(sched[name+'/pm/'+di]) hasPm = true;
  }
  if(hasAm && hasPm) return 'both';
  if(hasAm) return 'am';
  if(hasPm) return 'pm';
  return 'none';
}
let _invCollapsed = (function(){
  try { return new Set(JSON.parse(localStorage.getItem('tmp.invCollapsed')||'[]')); }
  catch(_) { return new Set(); }
})();
function _invIsCollapsed(key){ return _invCollapsed.has(key); }
function _invSaveCollapse(){
  try { localStorage.setItem('tmp.invCollapsed', JSON.stringify([..._invCollapsed])); } catch(_){}
}
// v0.27.11: peptide-name sub-grouping. Strip "<num><unit>" suffix so
// "Ipamorelin 5mg", "Ipamorelin 10mg", "Ipamorelin" all share base "Ipamorelin".
function _invBaseName(name){
  if(!name) return '';
  const stripped = name.replace(/\s+\d+(?:\.\d+)?\s*(mg|mcg|μg|ug|iu|units|g)\b.*/i,'').trim();
  return stripped || name.trim();
}
let _invSubCollapsed = (function(){
  try { return new Set(JSON.parse(localStorage.getItem('tmp.invSubCollapsed')||'[]')); }
  catch(_) { return new Set(); }
})();
function _invSubIsCollapsed(key){ return _invSubCollapsed.has(key); }
function _invSubSaveCollapse(){
  try { localStorage.setItem('tmp.invSubCollapsed', JSON.stringify([..._invSubCollapsed])); } catch(_){}
}
// v0.27.12: family rollup helpers — group by alphabetic prefix and
// pick the "in-use" primary in each family.
// v0.27.15: family key is now the alphabetic+symbol prefix BEFORE any
// trailing digits. "Cagri2" → "CAGRI", "CARTALAX" → "CARTALAX" (no digits),
// "IP10"/"IP5" → "IP", "MOTS-C10" → "MOTS-C". Singletons (no trailing digits)
// never merge into letter-prefix groups.
function _invFamilyKey(name){
  if(!name) return 'ZZ';
  const trimmed = name.trim();
  // Capture the leading non-digit portion. If there are no trailing digits,
  // the whole name is the key (so it'll only group with an exact match).
  const m = trimmed.match(/^(.*?)(\d+)\s*$/);
  if(m && m[1]){
    return m[1].trim().toUpperCase();
  }
  return trimmed.toUpperCase();
}
function _invShotCount(item){
  if(!window.S || !Array.isArray(S.shots)) return 0;
  return S.shots.filter(s => s.peptideName === item.name).length;
}
function _invInUseScore(item){
  let score = 0;
  if((item.fr||0) > 0) score += 100000;   // fridge active = highest priority
  if((item.fz||0) > 0) score += 1000;
  if((item.dk||0) > 0) score += 1000;
  score += _invShotCount(item);
  // Tiebreaker: alphabetical name (negate so earlier names win)
  score -= ((item.name||'').charCodeAt(0) || 0) * 0.001;
  return score;
}
let _invFamExpanded = (function(){
  try { return new Set(JSON.parse(localStorage.getItem('tmp.invFamExpanded')||'[]')); }
  catch(_) { return new Set(); }
})();
function _invFamSaveExpanded(){
  try { localStorage.setItem('tmp.invFamExpanded', JSON.stringify([..._invFamExpanded])); } catch(_){}
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Vials card UI (renderVials + form helpers)
// ═══════════════════════════════════════════════════════════════════════════════
// Paints the "Individual Vials" list under the inventory table. Each row is one
// physical vial with a depleting bar, location chip, expiry chip, and per-row
// actions (Recon/Used/Edit/Delete). Filters: search, location, peptide, and a
// "Show history" toggle that surfaces depleted/discarded vials. The Add/Edit
// form is the inline #vl-form card managed by openVialForm/closeVialForm.

// v0.27.16: count active un-reconstituted (freezer) vials for a peptide,
// optionally excluding one vial by id. Used to show the "Pool wizard?" hint
// before single-vial recon when multiple un-reconned siblings exist.
function _ptCountReconCandidates(peptideName, excludeId){
  if(!window.S || !Array.isArray(S.vials)) return 0;
  const wanted = (peptideName || '').trim().toLowerCase();
  if(!wanted) return 0;
  return S.vials.filter(v =>
    v && v.id !== excludeId
    && v.status === 'active'
    && v.location === 'freezer'
    && (v.peptideName || '').trim().toLowerCase() === wanted
  ).length;
}

let _vlEditingId=null;       // id of vial being edited; null = add mode
let _vlShowDepleted=false;   // toggled by the "Show history" button
let _vlConfirmDelId=null;    // inline-confirm "Delete this vial?" target
let _vlShotCounts=null;      // per-renderVials cache: vialId -> shot count
let _vlSearchDebounceTimer=null;
let _vlListPaintScheduled=false;
let _vlPendingHtml=null;
let _vlPendingPaintForce=false;
let _invSearchDebounceTimer=null;
let _invVialRefreshScheduled=false;
let _invPendingForce=false;
let _vlSaving=false;
let _vlFormActive=false;
const _VL_SHOT_SCAN_MAX=250;

function vialFormIsOpen(){
  if(_vlFormActive)return true;
  if(_vlEditingId!=null)return true;
  const form=g('vl-form');
  return !!(form&&form.style.display==='block');
}
// v0.27.5: collapsed state for vials grouped by peptide.
// Persisted as a flat array of peptide names that the user has explicitly
// toggled. The default-collapse rule (groups >5 vials) applies only when a
// peptide is NOT in the explicit set on either side.
let _vlCollapsed = (function(){
  try { return new Set(JSON.parse(localStorage.getItem('tmp.vlCollapsed')||'[]')); }
  catch(_) { return new Set(); }
})();
let _vlExpanded = (function(){
  try { return new Set(JSON.parse(localStorage.getItem('tmp.vlExpanded')||'[]')); }
  catch(_) { return new Set(); }
})();
function _vlSaveCollapse(){
  try {
    localStorage.setItem('tmp.vlCollapsed', JSON.stringify([..._vlCollapsed]));
    localStorage.setItem('tmp.vlExpanded', JSON.stringify([..._vlExpanded]));
  } catch(_){}
}
function _vlIsCollapsed(name, count, isBatch){
  if(_vlExpanded.has(name)) return false;     // user-forced open
  if(_vlCollapsed.has(name)) return true;     // user-forced closed
  // v0.27.8: batches get a tighter threshold than peptides
  return isBatch ? (count > 3) : (count > 5);
}

function refreshVialFormDatalists(formOnly){
  const all=S.vials||[];
  const hint=g('vl-count-hint');
  if(hint){
    const activeCount=all.filter(v=>v.status==='active').length;
    hint.textContent=activeCount===0?'No vials yet — click + Add vial(s) to start':activeCount+' active vial'+(activeCount===1?'':'s');
  }
  if(formOnly||vialFormIsOpen())return;
  const venDl=g('vl-vendor-dl');
  if(venDl){
    const vendors=[...new Set([...(S.vendors||[]),...all.map(v=>v.vendor).filter(Boolean)])].sort();
    venDl.innerHTML=vendors.map(v=>'<option value="'+escA(v)+'">').join('');
  }
  const pepDl=g('vl-pep-dl');
  if(pepDl){
    const pepNames=(S.inv||[]).filter(i=>!i.isSupply&&!i.isBlend).map(i=>i.name).sort();
    pepDl.innerHTML=pepNames.map(n=>'<option value="'+escA(n)+'">').join('');
  }
  const pepSel=g('vl-filter-pep');
  if(pepSel){
    const cur=pepSel.value;
    const peps=[...new Set(all.map(v=>v.peptideName).filter(Boolean))].sort();
    pepSel.innerHTML='<option value="">All peptides</option>'+peps.map(p=>'<option value="'+escA(p)+'"'+(cur===p?' selected':'')+'>'+escH(p)+'</option>').join('');
  }
}

function scheduleVialListPaint(html,force){
  _vlPendingHtml=html;
  if(force)_vlPendingPaintForce=true;
  if(_vlListPaintScheduled)return;
  _vlListPaintScheduled=true;
  requestAnimationFrame(()=>{
    _vlListPaintScheduled=false;
    const paintForce=_vlPendingPaintForce;
    _vlPendingPaintForce=false;
    if(!paintForce&&vialFormIsOpen())return;
    const list=g('vl-list');
    if(!list||_vlPendingHtml==null)return;
    list.innerHTML=_vlPendingHtml;
    _vlPendingHtml=null;
  });
}

function scheduleInventoryVialRefresh(forceVials){
  if(forceVials)_invPendingForce=true;
  if(_invVialRefreshScheduled)return;
  _invVialRefreshScheduled=true;
  requestAnimationFrame(()=>{
    _invVialRefreshScheduled=false;
    const force=_invPendingForce;
    _invPendingForce=false;
    if(!force&&vialFormIsOpen())return;
    requestAnimationFrame(()=>{
      renderInv(!!force);
      requestAnimationFrame(()=>{
        try{renderVials(!!force);}catch(_){}
        if(_invPendingForce)scheduleInventoryVialRefresh(true);
      });
    });
  });
}

function debouncedRenderVials(){
  clearTimeout(_vlSearchDebounceTimer);
  _vlSearchDebounceTimer=setTimeout(()=>renderVials(false),120);
}

function debouncedRenderInv(){
  clearTimeout(_invSearchDebounceTimer);
  _invSearchDebounceTimer=setTimeout(()=>renderInv(),120);
}

function renderVials(force){
  if(!force&&vialFormIsOpen())return;
  const card=g('vials-card');if(!card)return;
  const list=g('vl-list');if(!list)return;
  const all=S.vials||[];
  const q=((g('vl-search')&&g('vl-search').value)||'').trim().toLowerCase();
  const fLoc=(g('vl-filter-loc')&&g('vl-filter-loc').value)||'';
  const fPep=(g('vl-filter-pep')&&g('vl-filter-pep').value)||'';
  // Status filter: by default hide depleted/discarded/gifted. Show history flips this.
  let rows=all.filter(v=>{
    if(!_vlShowDepleted&&v.status!=='active')return false;
    if(fLoc&&v.location!==fLoc)return false;
    if(fPep&&v.peptideName!==fPep)return false;
    if(q){
      const hay=(v.peptideName+' '+(v.vendor||'')+' '+(v.batchId||'')+' '+(v.orderId||'')+' '+(v.notes||'')).toLowerCase();
      if(hay.indexOf(q)<0)return false;
    }
    return true;
  });
  // Sort: active first, then peptide A–Z, then batch/vendor/id within peptide.
  rows.sort((a,b)=>{
    if(a.status!==b.status)return a.status==='active'?-1:1;
    const pn=(a.peptideName||'').localeCompare(b.peptideName||'',undefined,{sensitivity:'base'});
    if(pn!==0)return pn;
    const ba=(a.batchId||'').trim(), bb=(b.batchId||'').trim();
    if(!ba&&bb)return 1;
    if(ba&&!bb)return -1;
    if(ba!==bb){const bc=ba.localeCompare(bb,undefined,{sensitivity:'base'});if(bc)return bc;}
    const vn=(a.vendor||'').localeCompare(b.vendor||'',undefined,{sensitivity:'base'});
    if(vn)return vn;
    return (a.id||0)-(b.id||0);
  });

  _vlShotCounts=null;
  const _shotN=(S.shots||[]).length;
  if(_shotN&&_shotN<=_VL_SHOT_SCAN_MAX){
    _vlShotCounts=new Map();
    (S.shots||[]).forEach(s=>{
      if(!s||s.vialId==null)return;
      const id=+s.vialId;
      _vlShotCounts.set(id,(_vlShotCounts.get(id)||0)+1);
    });
  }

  refreshVialFormDatalists();

  if(!rows.length){
    scheduleVialListPaint('<div class="empty-state" style="padding:1.5rem 1rem;background:rgba(255,255,255,.55);border-radius:10px;border:.5px dashed #C4B5FD"><div style="font-size:24px;text-align:center;margin-bottom:6px">🧪</div><h4 style="margin:0 0 4px;font-size:13px;text-align:center;color:#5B21B6">No vials match</h4><p style="margin:0;font-size:11.5px;text-align:center;color:#6D28D9">'+(q||fLoc||fPep?'Try clearing the filters above.':'Click <b>+ Add vial(s)</b> to track your first vial.')+'</p></div>',!!force);
    return;
  }

  // v0.27.5: group rows by peptide name. Single-vial peptides render flat
  // (no header overhead). Multi-vial peptides get a collapsible header.
  const groups = [];
  const groupIndex = new Map();
  for(const v of rows){
    const k = v.peptideName || '?';
    let bucket = groupIndex.get(k);
    if(!bucket){ bucket = {name:k, vials:[]}; groupIndex.set(k, bucket); groups.push(bucket); }
    bucket.vials.push(v);
  }
  groups.sort((a,b)=>(a.name||'').localeCompare(b.name||'',undefined,{sensitivity:'base'}));
  const html = groups.map(grp => {
    if(grp.vials.length <= 1){
      // No grouping needed — single vial renders flat.
      return grp.vials.map(v => renderOneVial(v)).join('');
    }
    const collapsed = _vlIsCollapsed(grp.name, grp.vials.length);
    const c = pepColor(grp.name);
    // Aggregate stats for the header
    const activeCount = grp.vials.filter(v => v.status==='active').length;
    const totalRem = grp.vials.reduce((s,v)=> s + (v.status==='active' ? (v.remainingMcg||0) : 0), 0);
    const totalRemStr = totalRem >= 1000
      ? (totalRem/1000).toFixed(totalRem%1000===0?0:2)+'mg'
      : Math.round(totalRem)+'mcg';
    const locs = [...new Set(grp.vials.filter(v=>v.status==='active').map(v=>v.location))];
    const locDots = locs.map(l => {
      const ic = l==='freezer'?'🧊':(l==='fridge'?'<svg viewBox="0 0 12 16" width="12" height="13" style="vertical-align:-2px;display:inline-block"><rect x="1" y="1" width="10" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="1" y1="5.5" x2="11" y2="5.5" stroke="currentColor" stroke-width="1.4"/><line x1="9" y1="2.5" x2="9" y2="3.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="9" y1="7.5" x2="9" y2="9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>':(l==='desk'?'🗄️':'?'));
      return '<span style="font-size:11px">'+ic+'</span>';
    }).join('');
    const arrow = '<span class="vl-group-arrow" style="font-size:10px;color:#6D28D9;transition:transform .18s ease;display:inline-block;'+(collapsed?'':'transform:rotate(90deg)')+'">▶</span>';
    const pepPill = '<span style="font-size:11.5px;padding:2px 9px;border-radius:6px;font-weight:600;background:'+c.bg+';color:'+c.text+';border:.5px solid '+c.border+'">'+escH(grp.name)+'</span>';
    const countTxt = '<span style="font-size:11px;color:#5B21B6;font-weight:600">'+grp.vials.length+' vial'+(grp.vials.length===1?'':'s')+(activeCount!==grp.vials.length?' ('+activeCount+' active)':'')+'</span>';
    const remTxt = activeCount>0 ? '<span style="font-size:11px;color:var(--color-text-secondary);font-feature-settings:\'tnum\' 1">· <b style="color:var(--color-text-primary)">'+totalRemStr+'</b> remaining</span>' : '';
    const header = '<button type="button" class="vl-group-header" data-grp="'+escA(grp.name)+'" aria-expanded="'+(!collapsed)+'" '
      +'style="width:100%;display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(255,255,255,.7);border:.5px solid #DDD6FE;border-radius:10px;cursor:pointer;font-family:inherit;text-align:left;margin-bottom:6px;transition:background .15s">'
      +arrow + pepPill + countTxt + remTxt
      +'<span style="margin-left:auto;display:flex;gap:3px">'+locDots+'</span>'
      +'</button>';
    // v0.27.8: split this peptide group's vials by batch when 2+ batches
    // are present. Single-batch (or all-no-batch) groups render flat.
    const batchBuckets = new Map();
    let batchOrder = [];
    for(const v of grp.vials){
      const bk = (v.batchId && v.batchId.trim()) ? v.batchId.trim() : '__nobatch__';
      let b = batchBuckets.get(bk);
      if(!b){
        b = {key: bk, label: bk === '__nobatch__' ? 'No batch' : bk, vials: []};
        batchBuckets.set(bk, b);
        batchOrder.push(b);
      }
      b.vials.push(v);
    }
    batchOrder.sort((a,b)=>{
      if(a.key==='__nobatch__')return 1;
      if(b.key==='__nobatch__')return -1;
      return a.label.localeCompare(b.label,undefined,{sensitivity:'base'});
    });
    let bodyInner = '';
    if(batchBuckets.size <= 1){
      bodyInner = grp.vials.map(v => renderOneVial(v)).join('');
    } else {
      bodyInner = batchOrder.map(b => {
        const compositeKey = grp.name + '::' + b.key;
        const batchCollapsed = _vlIsCollapsed(compositeKey, b.vials.length, true);
        const batchActive = b.vials.filter(v => v.status==='active').length;
        const batchRemMcg = b.vials.reduce((s,v) => s + (v.status==='active' ? (v.remainingMcg||0) : 0), 0);
        const batchRemStr = batchRemMcg >= 1000
          ? (batchRemMcg/1000).toFixed(batchRemMcg%1000===0?0:2)+'mg'
          : Math.round(batchRemMcg)+'mcg';
        // Production-date range (earliest if available)
        const prodDates = b.vials.map(v=>v.productionDate).filter(Boolean).sort();
        const dateChip = prodDates.length
          ? '<span style="font-size:10.5px;color:var(--color-text-tertiary);font-feature-settings:\'tnum\' 1">· 📅 '+(prodDates[0]===prodDates[prodDates.length-1]?prodDates[0]:(prodDates[0]+'→'+prodDates[prodDates.length-1]))+'</span>'
          : '';
        const arrow = '<span class="vl-batch-arrow" style="font-size:9px;color:#6D28D9;transition:transform .18s ease;display:inline-block;'+(batchCollapsed?'':'transform:rotate(90deg)')+'">▶</span>';
        const lbl = b.key === '__nobatch__'
          ? '<span style="font-size:11px;color:var(--color-text-tertiary);font-style:italic">No batch</span>'
          : '<span style="font-size:11px;color:#5B21B6;font-weight:600">📦 '+escH(b.label)+'</span>';
        const cnt = '<span style="font-size:10.5px;color:var(--color-text-secondary)">· '+b.vials.length+' vial'+(b.vials.length===1?'':'s')+(batchActive!==b.vials.length?' ('+batchActive+' active)':'')+'</span>';
        const rem = batchActive>0 ? '<span style="font-size:10.5px;color:var(--color-text-secondary);font-feature-settings:\'tnum\' 1">· <b style="color:var(--color-text-primary)">'+batchRemStr+'</b> rem</span>' : '';
        const bHdr = '<button type="button" class="vl-batch-header" data-batchkey="'+escA(compositeKey)+'" aria-expanded="'+(!batchCollapsed)+'" '
          +'style="width:100%;display:flex;align-items:center;gap:7px;padding:5px 10px;background:rgba(245,243,255,.55);border:.5px solid #E9E5FB;border-radius:8px;cursor:pointer;font-family:inherit;text-align:left;margin:.35rem 0 .25rem;transition:background .15s">'
          +arrow + lbl + cnt + rem + dateChip
          +'</button>';
        const bBody = '<div class="vl-batch-body" data-batchkey="'+escA(compositeKey)+'" style="'+(batchCollapsed?'display:none;':'')+'padding-left:6px">'
          + b.vials.map(v => renderOneVial(v)).join('')
          + '</div>';
        return '<div class="vl-batch" data-batchkey="'+escA(compositeKey)+'">' + bHdr + bBody + '</div>';
      }).join('');
    }
    const body = '<div class="vl-group-body" data-grp="'+escA(grp.name)+'" style="'+(collapsed?'display:none;':'')+'padding-left:6px;border-left:2px solid '+c.border+';margin:0 0 .85rem 4px">'
      + bodyInner
      + '</div>';
    return '<div class="vl-group" data-grp="'+escA(grp.name)+'">' + header + body + '</div>';
  }).join('');
  scheduleVialListPaint(html,!!force);
}

// Build the HTML for a single vial row. Self-contained so renderVials stays readable.
function renderOneVial(v){
  const c=pepColor(v.peptideName);
  const pct=vialPct(v);
  // Bar color: green when fresh, amber as it gets low, red near empty.
  // Depleted/inactive renders in a gray "ghost" style.
  let barFg='#10B981',barBg='#D1FAE5';
  if(v.status!=='active'){barFg='#9CA3AF';barBg='#E5E7EB';}
  else if(pct<25){barFg='#DC2626';barBg='#FEE2E2';}
  else if(pct<50){barFg='#D97706';barBg='#FEF3C7';}
  // Remaining text — show mcg or mg whichever reads cleaner
  const remStr=v.remainingMcg>=1000?(v.remainingMcg/1000).toFixed(v.remainingMcg%1000===0?0:2)+'mg':Math.round(v.remainingMcg)+'mcg';
  const totStr=v.totalMcg>=1000?(v.totalMcg/1000).toFixed(v.totalMcg%1000===0?0:1)+'mg':v.totalMcg+'mcg';
  // Location chip
  const locChips={
    freezer:{ic:'🧊',bg:'#DBEAFE',fg:'#1E40AF',label:'Freezer'},
    fridge:{ic:'<svg viewBox="0 0 12 16" width="12" height="13" style="vertical-align:-2px;display:inline-block"><rect x="1" y="1" width="10" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="1" y1="5.5" x2="11" y2="5.5" stroke="currentColor" stroke-width="1.4"/><line x1="9" y1="2.5" x2="9" y2="3.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="9" y1="7.5" x2="9" y2="9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',bg:'#CFFAFE',fg:'#155E75',label:'Fridge'},
    desk:{ic:'🗄️',bg:'#EDE9FE',fg:'#5B21B6',label:'Desk'}
  };
  const lc=locChips[v.location]||{ic:'?',bg:'#F3F4F6',fg:'#6B7280',label:v.location||'?'};
  const locChip='<span style="display:inline-block;padding:2px 7px;border-radius:5px;background:'+lc.bg+';color:'+lc.fg+';font-size:10.5px;font-weight:600">'+lc.ic+' '+lc.label+'</span>';
  // Status chip when not active
  const statusChips={depleted:{bg:'#F3F4F6',fg:'#6B7280',label:'Depleted'},discarded:{bg:'#FEE2E2',fg:'#991B1B',label:'Discarded'},gifted:{bg:'#FEF3C7',fg:'#92400E',label:'Gifted'}};
  const stChip=v.status!=='active'?'<span style="display:inline-block;padding:2px 7px;border-radius:5px;background:'+statusChips[v.status].bg+';color:'+statusChips[v.status].fg+';font-size:10.5px;font-weight:600;margin-left:4px">'+statusChips[v.status].label+'</span>':'';
  // Expiry chip — only relevant for active fridge vials
  let expChip='';
  if(v.status==='active'&&v.location==='fridge'&&v.reconDate){
    const expDays=v.reconExpDays||28;
    const expMs=new Date(v.reconDate).getTime()+expDays*24*60*60*1000;
    const daysLeft=Math.ceil((expMs-Date.now())/(24*60*60*1000));
    if(daysLeft<0)expChip='<span style="display:inline-block;padding:2px 7px;border-radius:5px;background:#DC2626;color:#fff;font-size:10.5px;font-weight:600;margin-left:4px">Expired</span>';
    else if(daysLeft<=3)expChip='<span style="display:inline-block;padding:2px 7px;border-radius:5px;background:#FED7AA;color:#7C2D12;font-size:10.5px;font-weight:600;margin-left:4px">'+daysLeft+'d left</span>';
    else if(daysLeft<=7)expChip='<span style="display:inline-block;padding:2px 7px;border-radius:5px;background:#FEF9C3;color:#92400E;font-size:10.5px;font-weight:600;margin-left:4px">'+daysLeft+'d left</span>';
    else expChip='<span style="display:inline-block;padding:2px 7px;border-radius:5px;background:#DCFCE7;color:#065F46;font-size:10.5px;font-weight:600;margin-left:4px">'+daysLeft+'d left</span>';
  }
  // Provenance line: vendor · batch · order · prod date
  const provBits=[];
  if(v.vendor)provBits.push(escH(v.vendor));
  if(v.batchId)provBits.push('Batch '+escH(v.batchId));
  if(v.orderId)provBits.push('Order '+escH(v.orderId));
  if(v.productionDate)provBits.push('📅 '+escH(v.productionDate));
  const provLine=provBits.length?'<div style="font-size:10.5px;color:#6D28D9;margin-top:3px">'+provBits.join(' · ')+'</div>':'<div style="font-size:10.5px;color:#A78BFA;margin-top:3px;font-style:italic">No vendor/batch — click Edit to add</div>';
  // Cost-per-mcg line, if cost is known
  let costLine='';
  if(v.cost>0&&v.labelMg>0){
    const perMg=(v.cost/v.labelMg).toFixed(2);
    costLine=' · $'+v.cost.toFixed(2)+' ($'+perMg+'/mg)';
  }
  // Action buttons — only show what's relevant for the vial's current state
  const isConfirmingDel=_vlConfirmDelId===v.id;
  let actions;
  if(isConfirmingDel){
    actions='<span style="font-size:11px;color:var(--color-text-secondary);margin-right:4px">Delete this vial?</span>'
      +'<button class="btn vl-row-del-yes" data-vid="'+v.id+'" style="padding:3px 8px;font-size:11px;background:#A32D2D;color:#fff;border-color:var(--accent-red-fg);margin-right:4px">Yes</button>'
      +'<button class="btn vl-row-del-no" style="padding:3px 8px;font-size:11px">Cancel</button>';
  }else if(v.status!=='active'){
    actions='<button class="btn vl-row-edit" data-vid="'+v.id+'" style="padding:3px 8px;font-size:11px;color:var(--accent-blue-fg);margin-right:4px">Edit</button>'
      +'<button class="btn vl-row-del" data-vid="'+v.id+'" style="padding:3px 8px;font-size:11px;color:var(--accent-red-fg)">Delete</button>';
  }else{
    const reconBtn=v.location==='freezer'?'<button class="btn vl-row-recon" data-vid="'+v.id+'" style="padding:3px 8px;font-size:11px;color:var(--accent-green-fg);margin-right:4px" title="Reconstitute this vial: move to fridge, stamp recon date">🧪 Recon</button>':'';
    const usedBtn=v.location==='fridge'?'<button class="btn vl-row-used" data-vid="'+v.id+'" style="padding:3px 8px;font-size:11px;color:var(--accent-amber-fg);margin-right:4px" title="Mark this vial fully used">✓ Used</button>':'';
    const discBtn=v.status==='active'?'<button class="btn vl-row-discard" data-vid="'+v.id+'" style="padding:3px 8px;font-size:11px;color:var(--accent-red-fg);margin-right:4px" title="Discard (bad recon, contaminated, etc.) — keeps history but removes from active inventory">⊘ Discard</button>':'';
    actions=reconBtn+usedBtn+discBtn
      +'<button class="btn vl-row-edit" data-vid="'+v.id+'" style="padding:3px 8px;font-size:11px;color:var(--accent-blue-fg);margin-right:4px">Edit</button>'
      +'<button class="btn vl-row-del" data-vid="'+v.id+'" style="padding:3px 8px;font-size:11px;color:var(--accent-red-fg)">Delete</button>';
  }

  // Per-vial shot count (informational): how many shots have referenced this vial.
  const shotsHere=_vlShotCounts?(_vlShotCounts.get(v.id)||0):0;
  const shotCount=shotsHere?'<span style="font-size:10px;color:#6D28D9;margin-left:6px;opacity:.85">· '+shotsHere+' shot'+(shotsHere===1?'':'s')+' logged</span>':'';

  // Bar shows remaining %; below it, "X / Y · 75%" textual summary
  const barRow='<div style="margin-top:6px"><div style="height:8px;background:'+barBg+';border-radius:4px;overflow:hidden"><div style="height:100%;width:'+pct.toFixed(1)+'%;background:'+barFg+';transition:width .3s ease"></div></div><div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:3px;font-size:11px;color:var(--color-text-secondary)"><span><b style="color:var(--color-text-primary);font-feature-settings:\'tnum\' 1">'+remStr+'</b> / '+totStr+'</span><span>'+pct.toFixed(0)+'% remaining'+costLine+'</span></div></div>';

  const pepPill='<span style="font-size:11px;padding:2px 8px;border-radius:6px;font-weight:600;background:'+c.bg+';color:'+c.text+';border:.5px solid '+c.border+'">'+escH(v.peptideName||'?')+'</span>';
  const idTag='<span style="font-size:9.5px;color:var(--color-text-tertiary);margin-left:6px;font-feature-settings:\'tnum\' 1">#'+v.id+'</span>';
  const notesLine=v.notes?'<div style="font-size:10.5px;color:var(--color-text-secondary);margin-top:4px;font-style:italic">📝 '+escH(v.notes)+'</div>':'';

  return '<div class="vl-row" data-vid="'+v.id+'" style="background:#fff;border:.5px solid #DDD6FE;border-left:3px solid '+c.border+';border-radius:10px;padding:.7rem .9rem;margin-bottom:.5rem;'+(v.status!=='active'?'opacity:.65':'')+'">'
    +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">'
      +'<div style="flex:1;min-width:160px">'
        +pepPill+idTag+(v.labelMg?' <span style="font-size:10.5px;color:var(--color-text-secondary)">· '+v.labelMg+'mg vial</span>':'')+shotCount
        +provLine
        +notesLine
      +'</div>'
      +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">'
        +'<div>'+locChip+stChip+expChip+'</div>'
      +'</div>'
    +'</div>'
    +barRow
    +'<div style="display:flex;justify-content:flex-end;margin-top:6px;flex-wrap:wrap;gap:2px">'+actions+'</div>'
  +'</div>';
}

// Open the vial-add/edit form in `vl-form`. Pass a vial object for edit mode,
// or null/undefined for add mode (resets to blank, qty=1).
function openVialForm(vial){
  const form=g('vl-form');if(!form)return;
  _vlSaving=false;
  _vlFormActive=true;
  _vlEditingId=vial?vial.id:null;
  form.style.display='block';
  const vlList=g('vl-list');if(vlList)vlList.style.display='none';
  (function(){
    const pepIn=g('vl-pep'),venIn=g('vl-vendor');
    if(pepIn&&pepIn.hasAttribute('list')){pepIn.dataset.vlList=pepIn.getAttribute('list');pepIn.removeAttribute('list');}
    if(venIn&&venIn.hasAttribute('list')){venIn.dataset.vlList=venIn.getAttribute('list');venIn.removeAttribute('list');}
  })();
  g('vl-form-title').textContent=vial?'Edit vial #'+vial.id:'Add vials';
  g('vl-msg').textContent='';
  requestAnimationFrame(()=>{
  g('vl-qty').disabled=!!vial;
  g('vl-qty').value=vial?1:1;
  // Hide bulk-add hint when editing; the field is locked anyway
  // Show Delete button only in edit mode
  g('vl-del').style.display=vial?'':'none';
  // v4: show 'Delete all of this peptide' only when there are 2+ vials of this peptide.
  (function(){
    const allBtn=g('vl-del-all');
    if(!allBtn)return;
    if(!vial){allBtn.style.display='none';allBtn.dataset.armed='0';allBtn.textContent='Delete all of this peptide';return;}
    const cnt=(S.vials||[]).filter(x=>x.peptideName===vial.peptideName).length;
    if(cnt>=2){
      allBtn.style.display='inline-flex';
      allBtn.dataset.armed='0';
      allBtn.textContent='Delete all '+cnt+' '+vial.peptideName+' vials';
    } else {
      allBtn.style.display='none';
    }
  })();
  // Populate fields
  sv('vl-pep',vial?vial.peptideName||'':'');
  sv('vl-vendor',vial?vial.vendor||'':'');
  sv('vl-mg',vial?vial.labelMg||'':'');
  sv('vl-loc',vial?vial.location||'freezer':'freezer');
  sv('vl-order',vial?vial.orderId||'':'');
  sv('vl-batch',vial?vial.batchId||'':'');
  sv('vl-prod',vial?vial.productionDate||'':'');
  sv('vl-stored',vial?vial.storedDate||'':'');
  sv('vl-cost',vial?(vial.cost||''):'');
  sv('vl-recondate',vial?vial.reconDate||'':'');
  sv('vl-rexp',vial?vial.reconExpDays||'':'');
  sv('vl-rbac',vial?vial.reconBacMl||'':'');
  sv('vl-notes',vial?vial.notes||'':'');
  syncVialReconFields();
  // v0.27.13: build the sibling-context strip when editing
  (function(){
    const strip = g('vl-form-siblings');
    if(!strip) return;
    if(!vial){ strip.style.display = 'none'; strip.innerHTML = ''; return; }
    // Find other ACTIVE vials of the same peptide (case-insensitive),
    // excluding the one currently being edited.
    const wanted = (vial.peptideName || '').trim().toLowerCase();
    const siblings = (S.vials || []).filter(v =>
      v.id !== vial.id
      && v.status === 'active'
      && (v.peptideName || '').trim().toLowerCase() === wanted
    );
    if(!siblings.length){
      strip.style.display = 'block';
      strip.innerHTML = '<span style="color:var(--color-text-tertiary)">🧪 Editing <b style="color:#5B21B6">#'+vial.id+'</b> · no other active '+(vial.peptideName||'')+' vials</span>';
      return;
    }
    // Group siblings by location: fridge first, then desk, then freezer
    const order = {fridge:0, desk:1, freezer:2};
    siblings.sort((a,b) => {
      const ao = order[a.location] ?? 9, bo = order[b.location] ?? 9;
      if(ao !== bo) return ao - bo;
      return (a.id||0) - (b.id||0);
    });
    const locIc = {fridge:'<svg viewBox="0 0 12 16" width="12" height="13" style="vertical-align:-2px;display:inline-block"><rect x="1" y="1" width="10" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="1" y1="5.5" x2="11" y2="5.5" stroke="currentColor" stroke-width="1.4"/><line x1="9" y1="2.5" x2="9" y2="3.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="9" y1="7.5" x2="9" y2="9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>', desk:'🗄️', freezer:'🧊'};
    // Cluster by location for readable rendering
    const clusters = [];
    let cur = null;
    siblings.forEach(s => {
      if(!cur || cur.loc !== s.location){
        cur = {loc: s.location, vials: []};
        clusters.push(cur);
      }
      cur.vials.push(s);
    });
    const clusterStrs = clusters.map(c => {
      const ic = locIc[c.loc] || '?';
      const ids = c.vials.map(v =>
        '<a href="#" class="vl-sibling-link" data-sibvid="'+v.id+'" style="color:#5B21B6;font-weight:600;text-decoration:none;border-bottom:.5px dashed #C4B5FD" title="'+(v.labelMg||0)+'mg · '+(v.location||'')+(v.batchId?(' · batch '+v.batchId):'')+(v.reconDate?(' · recon '+v.reconDate):'')+'">#'+v.id+'</a>'
      ).join('<span style="color:var(--color-text-tertiary)">,</span> ');
      return ic + ' ' + ids;
    }).join('<span style="color:var(--color-text-tertiary);margin:0 4px"> · </span>');
    strip.style.display = 'block';
    strip.innerHTML = '🧪 Editing <b style="color:#5B21B6">#'+vial.id+'</b> · <span style="color:var(--color-text-tertiary)">'+siblings.length+' other '+(vial.peptideName||'')+' active:</span> ' + clusterStrs;
    // Wire up click handlers on sibling links
    strip.querySelectorAll('.vl-sibling-link').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const sid = parseInt(a.dataset.sibvid);
        const sv = (S.vials || []).find(v => v.id === sid);
        if(sv) openVialForm(sv);
      });
    });
  })();
  setTimeout(()=>{try{g('vl-pep').focus();form.scrollIntoView({behavior:'smooth',block:'nearest'});}catch(e){}},50);
  });
}

function closeVialForm(){
  _vlFormActive=false;
  _vlEditingId=null;
  const form=g('vl-form');if(form)form.style.display='none';
  g('vl-msg').textContent='';
  const vlList=g('vl-list');if(vlList)vlList.style.display='';
  (function(){
    const pepIn=g('vl-pep'),venIn=g('vl-vendor');
    if(pepIn&&pepIn.dataset.vlList){pepIn.setAttribute('list',pepIn.dataset.vlList);delete pepIn.dataset.vlList;}
    if(venIn&&venIn.dataset.vlList){venIn.setAttribute('list',venIn.dataset.vlList);delete venIn.dataset.vlList;}
  })();
}

// v0.26.10: recon fields are always visible in edit mode (since the vial may
// have been reconstituted earlier and stored its reconBacMl regardless of current
// location). In add mode, fridge-only as before.
function syncVialReconFields(){
  const loc=gv('vl-loc');
  const block=g('vl-recon-fields');
  if(!block)return;
  const editing = !!_vlEditingId;
  block.style.display = (editing || loc==='fridge') ? 'block' : 'none';
  if(loc==='fridge'){
    if(!gv('vl-recondate'))sv('vl-recondate',td());
    if(!gv('vl-rexp'))sv('vl-rexp','28');
  }
}

// Save handler: in add mode spawns N vials (vl-qty); in edit mode updates one.
// Returns true on success so the caller can close the form.
function saveVialForm(){
  if(_vlSaving)return false;
  const m=g('vl-msg');
  const peptideName=gv('vl-pep').trim();
  const labelMg=parseFloat(gv('vl-mg'));
  const location=gv('vl-loc');
  const qty=Math.max(1,parseInt(gv('vl-qty'))||1);
  if(!peptideName){m.textContent='Pick a peptide.';m.style.color='#A32D2D';return false;}
  if(isNaN(labelMg)||labelMg<=0){m.textContent='Label mg must be greater than 0.';m.style.color='#A32D2D';return false;}
  _vlSaving=true;
  // Auto-create a barebones inv item if user typed a peptide name we don't know
  let inv=S.inv.find(i=>!i.isSupply&&i.name.toLowerCase()===peptideName.toLowerCase());
  if(!inv){
    inv={id:S.nI++,name:peptideName,fz:0,fr:0,dk:0,nd:0,cn:'',us:'',dose:0,doseUnit:'mg',days:[],vialMg:labelMg};
    S.inv.push(inv);
    setTimeout(()=>{try{rebuildCM();}catch(_){}},0);
  }
  const baseFields={
    peptideName:inv.name, // use canonical casing from inv
    vendor:gv('vl-vendor').trim().toUpperCase(),  // v17
    orderId:gv('vl-order').trim(),
    batchId:gv('vl-batch').trim(),
    labelMg:labelMg,
    totalMcg:labelMg*1000,
    location:location,
    storedDate:gv('vl-stored').trim()||'',
    reconDate:location==='fridge'?(gv('vl-recondate').trim()||''):'',
    reconExpDays:location==='fridge'?(parseInt(gv('vl-rexp'))||28):0,
    reconBacMl:location==='fridge'?(parseFloat(gv('vl-rbac'))||0):0,
    productionDate:gv('vl-prod').trim()||'',
    cost:parseFloat(gv('vl-cost'))||0,
    notes:gv('vl-notes').trim(),
    sourceType:'purchased',
    status:'active'
  };
  if(_vlEditingId){
    // Edit mode: preserve id, remainingMcg (clamped if labelMg shrinks)
    const v=S.vials.find(x=>x.id===_vlEditingId);
    if(!v){m.textContent='Vial vanished — refresh.';m.style.color='#A32D2D';_vlSaving=false;return false;}
    Object.assign(v,baseFields);
    v.remainingMcg=Math.min(v.remainingMcg,v.totalMcg); // don't let edit balloon remaining
    if(v.remainingMcg<0)v.remainingMcg=0;
    recomputeStockFromVials(v.peptideName);
  }else{
    if(!Array.isArray(S.vials))S.vials=[];
    // Add mode: spawn `qty` rows. Each gets its own id.
    for(let i=0;i<qty;i++){
      S.vials.push(Object.assign({id:S.nV++,remainingMcg:baseFields.totalMcg},baseFields));
    }
    recomputeStockFromVials(inv.name);
    // Add the vendor to S.vendors if it's new — feeds the price-comparison page
    if(baseFields.vendor&&!S.vendors.includes(baseFields.vendor)){
      S.vendors.push(baseFields.vendor);
    }
  }
  S._hadSaved=true;
  try{save();}catch(e){console.error('vial save failed:',e);}
  try{if(typeof window.tmpRequestBackupReminder==='function')window.tmpRequestBackupReminder('vial');}catch(_){}
  closeVialForm();
  _vlSaving=false;
  requestAnimationFrame(()=>{try{scheduleInventoryVialRefresh(true);}catch(_){}});
  return true;
}

// --- PEPTIDE MANAGER ---
function ppSel(){return[...g('daypick').querySelectorAll('.dbtn.on')].map(b=>parseInt(b.dataset.d));}
function setDayPickSelection(days){
  const box=g('daypick');
  if(!box)return;
  const set=new Set((days||[]).map(d=>parseInt(d,10)));
  box.querySelectorAll('.dbtn').forEach(b=>b.classList.toggle('on',set.has(parseInt(b.dataset.d,10))));
}
const PF_DAY_PRESETS={mwf:[0,2,4],tuthsat:[1,3,5],all:[0,1,2,3,4,5,6]};
// Sched cells stay under the saved peptide name until Save — not the in-progress rename.
function pfSchedName(){
  if(pepEId){
    const ex=(S.inv||[]).find(i=>i.id===pepEId);
    if(ex&&ex.name) return ex.name;
  }
  return (gv('pf-nm')||'').trim();
}
// Map legacy am/pm/both and meal-lane stack values to a sched side.
function pfStackSlot(stk){
  if(!stk||stk==='none') return 'none';
  if(stk==='am'||stk==='breakfast'||stk==='lunch') return 'am';
  if(stk==='pm'||stk==='dinner') return 'pm';
  if(stk==='both'||stk==='bedtime') return 'both';
  return 'none';
}
function pfStackActive(stk){return pfStackSlot(stk)!=='none';}
function updateDayPicker(){
  const stk=gv('pf-stk');
  const nm=pfSchedName();
  if(!nm)return;
  const amDays=[0,1,2,3,4,5,6].filter(di=>S.sched[sk(nm,'am',di)]);
  const pmDays=[0,1,2,3,4,5,6].filter(di=>S.sched[sk(nm,'pm',di)]);
  const slot=pfStackSlot(stk);
  let days=[];
  if(slot==='am') days=amDays;
  else if(slot==='pm') days=pmDays;
  else if(slot==='both') days=[...new Set([...amDays,...pmDays])];
  g('daypick').querySelectorAll('.dbtn').forEach(b=>b.classList.toggle('on',days.includes(parseInt(b.dataset.d))));
}
function setColorSwatch(ci){
  g('pf-colorpick').querySelectorAll('.cbtn').forEach(b=>{
    const sel=parseInt(b.dataset.ci)===ci;
    b.dataset.selected=sel?'1':'0';
    b.style.outline=sel?'2.5px solid var(--color-text-primary)':'none';
    b.style.outlineOffset='2px';
  });
}
function fillPF(it){
  sv('pf-nm',it.name);sv('pf-fz',it.fz||0);sv('pf-fr',it.fr||0);sv('pf-dk',it.dk||0);sv('pf-nd',it.nd||0);sv('pf-ds',it.dose||0);sv('pf-du',it.doseUnit||'mg');sv('pf-cn',it.cn||'');sv('pf-us',it.us||'');sv('pf-cat',it.cat||'');refreshPfCatList();
  // v14a: load half-life. If stored on the peptide, pick the most
  // readable unit; otherwise leave blank (auto-suggest from PEPTIDE_REF
  // hooks in via updatePepRefCard when the name matches a known peptide).
  if(typeof it.halfLifeHours==='number' && it.halfLifeHours>0){
    if(it.halfLifeHours>=24){
      sv('pf-hl', Math.round(it.halfLifeHours/24*100)/100);
      sv('pf-hl-unit','days');
    }else{
      sv('pf-hl', it.halfLifeHours);
      sv('pf-hl-unit','hours');
    }
  } else {
    sv('pf-hl','');
    sv('pf-hl-unit','hours');
  }
sv('pf-recon',it.reconDate||'');sv('pf-rexp',it.reconExpDays||'');sv('pf-rbac',it.reconBacMl||'');(function(){const u=it.vialMgDisplayUnit||'mg';sv('pf-vmu',u==='g'?'g':'mg');if(it.vialMg!=null&&it.vialMg>0)sv('pf-vmg',u==='g'?it.vialMg/1000:it.vialMg);else sv('pf-vmg','');})();sv('pf-intv',it.interval||'');sv('pf-prod',it.productionDate||'');sv('pf-cstart',it.cycleStart||'');sv('pf-cend',it.cycleEnd||'');  const amDays=[0,1,2,3,4,5,6].filter(di=>S.sched[sk(it.name,'am',di)]);
  const pmDays=[0,1,2,3,4,5,6].filter(di=>S.sched[sk(it.name,'pm',di)]);
  const inAm=amDays.length>0,inPm=pmDays.length>0;
  let stackVal=it.stackLane;
  const mealInstalled=!!(g('pf-stk')&&g('pf-stk').dataset.gptMealStackInstalled==='1');
  if(!stackVal||stackVal==='am'||stackVal==='pm'||stackVal==='both'){
    stackVal=!inAm&&!inPm?'none':inAm&&inPm?'both':inPm?'pm':'am';
    if(mealInstalled){
      if(stackVal==='am') stackVal='breakfast';
      else if(stackVal==='pm') stackVal='dinner';
      else if(stackVal==='both') stackVal='bedtime';
    }
  }
  sv('pf-stk',stackVal);
  updateDayPicker();
  setColorSwatch(typeof it.colorOverride==='number'?it.colorOverride:-1);
  g('pep-dbox').style.display='none';g('pf-msg').textContent='';
  // Drift guard: when this peptide has vials, the fz/fr/dk count fields are
  // computed views — letting the user type into them just lets recomputeStock-
  // FromVials silently clobber the input on the next vial mutation. Disable
  // them and surface the explanation. Same reasoning for reconDate / reconExp /
  // reconBacMl: those track per-vial state now and editing them at the
  // peptide level would fight the per-vial values.
  const hasV=hasVials(it.name);
  ['pf-fz','pf-fr','pf-dk','pf-recon','pf-rexp','pf-rbac'].forEach(id=>{
    const el=g(id);if(!el)return;
    el.disabled=hasV;
    el.style.opacity=hasV?'.55':'';
    el.style.cursor=hasV?'not-allowed':'';
    if(hasV)el.title='Managed via the Vials card on the Inventory page';
    else el.title='';
  });
  // Add (or remove) a small note above the Stock section explaining the lock.
  let lockNote=g('pf-vial-lock-note');
  if(hasV){
    if(!lockNote){
      const fzInput=g('pf-fz');
      const stockSection=fzInput?fzInput.closest('.form-section'):null;
      if(stockSection){
        lockNote=document.createElement('div');
        lockNote.id='pf-vial-lock-note';
        lockNote.style.cssText='margin-bottom:8px;padding:6px 10px;background:#F5F3FF;border:.5px solid #DDD6FE;border-radius:6px;font-size:11px;color:#5B21B6;line-height:1.45';
        lockNote.innerHTML='🧪 <b>This peptide has individual vials</b> — stock counts and recon dates are managed on the Inventory page\u2019s Vials card. Amount per unit (mg or g) and Production date below still apply to new vials.';
        stockSection.insertBefore(lockNote,stockSection.querySelector('.form-section-head').nextSibling);
      }
    }
  }else if(lockNote){
    lockNote.remove();
  }
  // Blend hydration — must happen before updatePepRefCard so refreshBlendUI
  // can suppress the (meaningless) ref card for blend names.
  const cb=g('pf-is-blend');
  const host=g('pf-blend-components');
  if(cb&&host){
    host.innerHTML='';
    cb.checked=!!it.isBlend;
    if(it.isBlend&&Array.isArray(it.components)){
      it.components.forEach(c=>host.appendChild(buildCompositionRow(c)));
    }
    refreshBlendUI();
    // After refreshBlendUI swaps the unit dropdown, restore the saved dose unit
    // (blend mode rebuilds the options so `sv('pf-du', ...)` above was set
    // against the old options and may have been dropped).
    if(it.doseUnit)sv('pf-du',it.doseUnit);
  }
  updatePepRefCard();
  // isPeptide checkbox: default true when field is absent (legacy items pre-date the field)
  const ipCb=g('pf-is-peptide');
  if(ipCb)ipCb.checked=it.isPeptide!==false;
  // Route picker: legacy items pre-date the field — default 'both' so users
  // with old data keep seeing the full body diagram until they pick a route.
  setPfRoute(it.route||'both');
}
function clrPF(){pepEId=null;['pf-nm','pf-cn','pf-us','pf-recon','pf-prod','pf-cstart','pf-cend','pf-cat'].forEach(id=>sv(id,''));refreshPfCatList();['pf-fz','pf-fr','pf-dk','pf-nd','pf-ds','pf-rexp','pf-rbac','pf-vmg','pf-intv','pf-hl'].forEach(id=>sv(id,0));sv('pf-hl-unit','hours');sv('pf-du','mg');sv('pf-vmu','mg');sv('pf-stk','none');g('daypick').querySelectorAll('.dbtn').forEach(b=>b.classList.remove('on'));setColorSwatch(-1);g('pep-dbox').style.display='none';g('pf-msg').textContent='';g('ptf-btn').textContent='+ Add new';buildPFA(false);const cb=g('pf-is-blend');if(cb)cb.checked=false;const ipCb=g('pf-is-peptide');if(ipCb)ipCb.checked=true;const host=g('pf-blend-components');if(host)host.innerHTML='';refreshBlendUI();updatePepRefCard();setPfRoute('SQ');}
function buildPFA(e){const el=g('pf-acts');el.innerHTML='';if(e){const d=document.createElement('button');d.className='btn bro';d.textContent='Delete peptide';d.addEventListener('click',()=>{if(typeof tmpShowPepDelete==='function'&&pepEId){tmpShowPepDelete(pepEId);}else if(pepEId){g('pep-dbox').style.display='block';}});el.appendChild(d);(function(){var __it=(window.S&&S.inv||[]).find(x=>x.id===pepEId);if(__it&&__it.archived){var u=document.createElement('button');u.id='tmp-unarchive-btn';u.className='btn';u.textContent='♻ Unarchive this peptide';u.addEventListener('click',()=>{if(pepEId){tmpUnarchivePep(pepEId);if(typeof clrPF==='function')clrPF();if(typeof swPT==='function')swPT('list');}});el.appendChild(u);}})();const c=document.createElement('button');c.className='btn';c.textContent='Cancel';c.addEventListener('click',()=>swPT('list'));el.appendChild(c);const sv2=document.createElement('button');sv2.className='btn bb';sv2.textContent='Save';sv2.addEventListener('click',savePep);el.appendChild(sv2);}else{const c=document.createElement('button');c.className='btn';c.textContent='Cancel';c.addEventListener('click',()=>swPT('list'));el.appendChild(c);const a=document.createElement('button');a.className='btn bg';a.textContent='Add peptide';a.addEventListener('click',addPep);el.appendChild(a);}_buildPFATopBar(e);try{if(typeof window.tmpHookPfFormButtons==='function')window.tmpHookPfFormButtons();}catch(_){}try{updateDayPicker();}catch(_){}}
// Top Save/Cancel bar mirror — keeps Save reachable without scrolling.
function _buildPFATopBar(e){
  const el=g('pf-top-acts');if(!el)return;
  el.innerHTML='';
  const c=document.createElement('button');
  c.className='btn';c.textContent='Cancel';c.style.padding='5px 14px';c.style.fontSize='12.5px';
  c.addEventListener('click',()=>swPT('list'));
  el.appendChild(c);
  const sv=document.createElement('button');
  sv.className=e?'btn bb':'btn bg';sv.textContent=e?'💾 Save':'＋ Add peptide';
  sv.style.padding='5px 14px';sv.style.fontSize='12.5px';sv.style.fontWeight='600';
  sv.addEventListener('click', e ? savePep : addPep);
  el.appendChild(sv);
}
// Refresh the pf-cat datalist with deduped base-names from S.prices keys.
// Called whenever the form opens so the suggestion list stays current.
function refreshPfCatList(){
  const dl = g('pf-cat-list'); if(!dl) return;
  if(!S.prices || typeof S.prices!=='object'){ dl.innerHTML=''; return; }
  const stripDose = name => String(name||'').replace(/\s+\d+(?:\.\d+)?\s*(mg|mcg|μg|ug|ml|iu|units)\b.*/i,'').trim();
  const set = new Set();
  Object.keys(S.prices).forEach(k=>{
    set.add(k);                  // full key (with dose)
    const b = stripDose(k);
    if(b && b!==k) set.add(b);  // base name (no dose)
  });
  const sorted = [...set].filter(s=>s && s.trim()).sort((a,b)=>a.localeCompare(b));
  const MAX_CAT=400;
  const list=sorted.length>MAX_CAT?sorted.slice(0,MAX_CAT):sorted;
  dl.innerHTML = list.map(v=>'<option value="'+String(v).replace(/"/g,'&quot;')+'">').join('');
}

// Auto-fill pf-cat from a name input when the cat field is still empty,
// using PEPTIDE_REF's findPeptideRef to map e.g. "Retatrutide" → catalog name.
function autoDetectCatFromName(){
  const catEl = g('pf-cat'); if(!catEl) return;
  if(catEl.value && catEl.value.trim()) return; // user-set value wins
  const nm = gv('pf-nm');
  if(!nm) return;
  try {
    const ref = (typeof findPeptideRef==='function') ? findPeptideRef(nm) : null;
    if(ref && ref.n){
      // Only auto-set if ref.n actually matches something in S.prices base names
      const stripDose = name => String(name||'').replace(/\s+\d+(?:\.\d+)?\s*(mg|mcg|μg|ug|ml|iu|units)\b.*/i,'').trim().toLowerCase();
      const refLow = ref.n.toLowerCase();
      const hit = Object.keys(S.prices||{}).some(k=>stripDose(k)===refLow);
      if(hit) catEl.value = ref.n;
    }
  } catch(_) {}
}

function getPV(){
  const selBtn=g('pf-colorpick').querySelector('.cbtn[data-selected="1"]');
  const ci=selBtn?parseInt(selBtn.dataset.ci):-1;
  const isBlend=g('pf-is-blend')?g('pf-is-blend').checked:false;
  const vmu=gv('pf-vmu')||'mg';
  const vmraw=parseFloat(gv('pf-vmg'));
  let vialMg,vialMgDisplayUnit;
  if(!isNaN(vmraw)&&vmraw>0){vialMg=vmu==='g'?vmraw*1000:vmraw;vialMgDisplayUnit=vmu==='g'?'g':'mg';}
  else{vialMg=undefined;vialMgDisplayUnit=undefined;}
  const v={name:gv('pf-nm').trim(),fz:+gv('pf-fz')||0,fr:+gv('pf-fr')||0,dk:+gv('pf-dk')||0,nd:+gv('pf-nd')||0,dose:+gv('pf-ds')||0,doseUnit:gv('pf-du')||'mg',cn:gv('pf-cn').trim(),us:gv('pf-us').trim(),cat:gv('pf-cat').trim()||undefined,days:ppSel(),colorOverride:ci>=0?ci:undefined,reconDate:gv('pf-recon').trim()||undefined,reconExpDays:+gv('pf-rexp')||undefined,reconBacMl:+gv('pf-rbac')||undefined,vialMg:vialMg,vialMgDisplayUnit:vialMgDisplayUnit,interval:+gv('pf-intv')||undefined,productionDate:gv('pf-prod').trim()||undefined,cycleStart:gv('pf-cstart').trim()||undefined,cycleEnd:gv('pf-cend').trim()||undefined};
  if(isBlend){v.isBlend=true;v.components=readComposition();}
  // isPeptide: only persist explicitly when unchecked. Default-true means absent
  // is interpreted as "yes, peptide" — keeps storage clean for the common case.
  const ipCb=g('pf-is-peptide');
  if(ipCb&&!ipCb.checked)v.isPeptide=false;
  // Injection route — 'SQ', 'IM', or 'both'. Stored on the peptide so the
  // log form can filter the body diagram + dropdown to compatible sites.
  v.route=getPfRoute()||'both';
  // v14a: persist half-life in canonical hours regardless of UI unit.
  const hlRaw=parseFloat(gv('pf-hl'));
  if(!isNaN(hlRaw) && hlRaw>0){
    const hlUnit=gv('pf-hl-unit')||'hours';
    v.halfLifeHours = hlUnit==='days' ? hlRaw*24 : hlRaw;
  }
  return v;
}
function addPep(){
  const v=getPV();const m=g('pf-msg');
  if(!v.name){m.textContent='Enter name.';m.style.color='#A32D2D';return;}
  if(S.inv.find(i=>i.name.toLowerCase()===v.name.toLowerCase())){m.textContent='Already exists. Use Edit to modify it.';m.style.color='#A32D2D';return;}
  const rawStk=pfMealLaneFromForm()||gv('pf-stk');
  const stk=pfStackSlot(rawStk);
  if(pfStackActive(rawStk)&&v.days.length===0){m.textContent='Select at least one scheduled day, or choose "No stack".';m.style.color='#A32D2D';return;}
  if(v.cycleStart&&v.cycleEnd&&v.cycleStart>v.cycleEnd){m.textContent='Cycle end date must be on or after start date.';m.style.color='#A32D2D';return;}
  if(v.isBlend){
    if(!v.components||v.components.length===0){m.textContent='A blend needs at least one component. Click "+ Add component" in the Composition section.';m.style.color='#A32D2D';return;}
    // Every component must resolve to a non-blend inventory item.
    const missing=v.components.filter(c=>!S.inv.find(i=>i.name===c.peptide&&!i.isBlend));
    if(missing.length){m.textContent='These components aren\'t in your inventory: '+missing.map(c=>c.peptide).join(', ')+'. Add them as standalone peptides first.';m.style.color='#A32D2D';return;}
  }
  tmpAllowCalSched(v.name);
  // Clear any existing cells (safety), then add new
  for(let di=0;di<7;di++){delete S.sched[sk(v.name,'am',di)];delete S.sched[sk(v.name,'pm',di)];}
  if(stk==='am'||stk==='both')v.days.forEach(di=>{S.sched[sk(v.name,'am',di)]=true;});
  if(stk==='pm'||stk==='both')v.days.forEach(di=>{S.sched[sk(v.name,'pm',di)]=true;});
  if(['breakfast','lunch','dinner','bedtime'].includes(rawStk))v.stackLane=rawStk;
  S.inv.push({id:S.nI++,...v});
  rebuildCM();buildLegend();save();popSel();
  try{window.tmpInventoryToast('✓ Added "' + v.name + '" to inventory & calendar');}catch(_){}
  try{if(typeof window.tmpRequestBackupReminder==='function')window.tmpRequestBackupReminder('inventory');}catch(_){}
  m.textContent='Added!';m.style.color='#0F6E56';setTimeout(()=>swPT('list'),700);rr();
}
function savePep(){
  const v=getPV();const m=g('pf-msg');
  if(!v.name){m.textContent='Enter name.';m.style.color='#A32D2D';return;}
  const ex=S.inv.find(i=>i.id===pepEId);if(!ex)return;
  const oldName=ex.name;
  if(S.inv.find(i=>i.name.toLowerCase()===v.name.toLowerCase()&&i.id!==pepEId)){m.textContent='Name taken.';m.style.color='#A32D2D';return;}
  const rawStk=pfMealLaneFromForm()||gv('pf-stk');
  const stk=pfStackSlot(rawStk);
  if(pfStackActive(rawStk)&&v.days.length===0){m.textContent='Select at least one scheduled day, or choose "No stack".';m.style.color='#A32D2D';return;}
  if(v.cycleStart&&v.cycleEnd&&v.cycleStart>v.cycleEnd){m.textContent='Cycle end date must be on or after start date.';m.style.color='#A32D2D';return;}
  if(v.isBlend){
    if(!v.components||v.components.length===0){m.textContent='A blend needs at least one component. Click "+ Add component" in the Composition section.';m.style.color='#A32D2D';return;}
    const missing=v.components.filter(c=>!S.inv.find(i=>i.name===c.peptide&&!i.isBlend&&i.id!==pepEId));
    if(missing.length){m.textContent='These components aren\'t in your inventory: '+missing.map(c=>c.peptide).join(', ')+'. Add them as standalone peptides first.';m.style.color='#A32D2D';return;}
    // If this peptide is currently used as a component in another blend, it
    // can't become a blend itself (we don't allow nesting). Block the switch.
    if(!ex.isBlend){
      const nested=blendsUsing(oldName);
      if(nested.length){m.textContent='Can\'t convert to a blend — '+oldName+' is a component in: '+nested.map(b=>b.name).join(', ')+'. Remove it from those blends first.';m.style.color='#A32D2D';return;}
    }
  }
  Object.assign(ex,v);
  if(['breakfast','lunch','dinner','bedtime'].includes(rawStk)) ex.stackLane=rawStk;
  else if(rawStk==='none') delete ex.stackLane;
  tmpAllowCalSched(v.name);
  // Drift guard mirror: when this peptide has vials, the form's fz/fr/dk and
  // recon* fields are disabled in fillPF, but a save still ships their last-
  // loaded values via getPV. Restore the authoritative numbers from the vials
  // so we don't write stale counts. Same for reconDate / reconExpDays /
  // reconBacMl, which are now per-vial values.
  if(hasVials(ex.name)){
    recomputeStockFromVials(ex.name);
    // recomputeStockFromVials sets fz/fr/dk and reconDate/reconExpDays from
    // the most recent fridge vial — that's correct. reconBacMl on the inv
    // item is just the default for new vials; preserve whatever was there.
    if(typeof ex.reconBacMl==='undefined'&&typeof v.reconBacMl!=='undefined')ex.reconBacMl=v.reconBacMl;
  }
  // If the peptide was renamed, update vial back-references so they stay
  // attached after the rename. Same idea as the shot/blend rename below.
  if(oldName!==v.name){
    (S.vials||[]).forEach(vi=>{if(vi.peptideName===oldName)vi.peptideName=v.name;});
  }
  // If the item is no longer a blend, strip the blend-only fields so stale
  // composition doesn't linger in storage.
  if(!v.isBlend){delete ex.isBlend;delete ex.components;}
  // Same pattern for isPeptide: getPV only sets it when unchecked, so a
  // previously-false item that gets re-checked needs the field stripped.
  if(v.isPeptide!==false)delete ex.isPeptide;
  // The Stack dropdown (am / pm / both / none) declares the complete post-save
  // schedule state for this peptide. Always clear BOTH AM and PM under the old
  // name, then write only what the dropdown says. Previously this cleared only
  // the "matching" side (e.g. switching PM → AM cleared AM and left PM alone),
  // which produced orphan cells — the peptide would show up on both AM and PM
  // after switching. The Stack dropdown is single-select, so there's no UI flow
  // where preserving the "other" side is what the user asked for.
  for(let di=0;di<7;di++){
    delete S.sched[sk(oldName,'am',di)];
    delete S.sched[sk(oldName,'pm',di)];
  }
  // Rename: migrate shot-log references AND blend-component references in
  // other inv items. Schedule cells were just cleared above, so there's
  // nothing left under oldName to move — the new schedule gets written under
  // v.name by the two lines further down.
  if(oldName!==v.name){
    S.shots.forEach(s=>{if(s.peptide===oldName)s.peptide=v.name;});
    S.inv.forEach(it=>{
      if(it.isBlend&&Array.isArray(it.components)){
        it.components.forEach(c=>{if(c.peptide===oldName)c.peptide=v.name;});
      }
    });
  }
  if(stk==='am'||stk==='both')v.days.forEach(di=>{S.sched[sk(v.name,'am',di)]=true;});
  if(stk==='pm'||stk==='both')v.days.forEach(di=>{S.sched[sk(v.name,'pm',di)]=true;});
  rebuildCM();buildLegend();save();popSel();
  try{window.tmpInventoryToast('✓ Saved "' + v.name + '" — calendar updated');}catch(_){}
  try{if(typeof window.tmpRequestBackupReminder==='function')window.tmpRequestBackupReminder('inventory');}catch(_){}
  m.textContent='Saved!';m.style.color='#0F6E56';
  closePepMgr();
}
function delPep(){
  if(!pepEId)return;
  const it=S.inv.find(i=>i.id===pepEId);if(!it)return;
  const nm=it.name;
  // Guard: if this peptide is a component in one or more blends, warn the
  // user before deleting — the blends will be left with orphaned references.
  if(!it.isBlend){
    const usedIn=blendsUsing(nm);
    if(usedIn.length){
      const msg=nm+' is a component in '+usedIn.length+' blend'+(usedIn.length===1?'':'s')+' ('+usedIn.map(b=>b.name).join(', ')+'). Those blends will show "'+nm+' (not in inventory)" until you fix them. Delete anyway?';
      if(!confirm(msg))return;
    }
  }
  S.inv=S.inv.filter(i=>i.id!==pepEId);
  if(nm){S.shots=S.shots.filter(s=>s.peptide!==nm);for(let di=0;di<7;di++){delete S.sched[sk(nm,'am',di)];delete S.sched[sk(nm,'pm',di)];}}
  rebuildCM();buildLegend();save();popSel();pepEId=null;g('pep-dbox').style.display='none';swPT('list');rr();
}
function rlPL(){
  const todayIso=td();
  // v7: filter archived peptides unless 'Show archived' toggle is on.
  const _showArch = (typeof tmpShowArchived === 'function') && tmpShowArchived();
  const _list = (S.inv||[]).filter(i => _showArch || !i.archived);
  // v0.27.1: sort favorites first, then by user-defined rank, then alpha
  _list.sort((a,b) => {
    const af = a.fav ? 0 : 1, bf = b.fav ? 0 : 1;
    if(af !== bf) return af - bf;
    const ar = (typeof a.rank === 'number') ? a.rank : (a.id || 0);
    const br = (typeof b.rank === 'number') ? b.rank : (b.id || 0);
    if(ar !== br) return ar - br;
    return (a.name||'').localeCompare(b.name||'');
  });
  g('peplist').innerHTML=_list.length?_list.map(i=>{
    const t=(i.fz||0)+(i.fr||0)+(i.dk||0);
    const amDays=[0,1,2,3,4,5,6].filter(di=>S.sched[sk(i.name,'am',di)]);
    const pmDays=[0,1,2,3,4,5,6].filter(di=>S.sched[sk(i.name,'pm',di)]);
    const inAm=amDays.length>0,inPm=pmDays.length>0;
    const stklbl=inAm&&inPm?'AM+PM':inAm?'AM':inPm?'PM':'inv only';
    const allDays=[...new Set([...amDays,...pmDays])];
    const dy=allDays.length?DAYS.filter((_,x)=>allDays.includes(x)).join(', '):'No schedule';
    const c=pepColor(i.name);
    // Cycle status pill: shows current state relative to today so users can
    // see at a glance which peptides are mid-cycle, upcoming, or finished.
    let cyclePill='';
    if(i.cycleStart||i.cycleEnd){
      const s=i.cycleStart,e=i.cycleEnd;
      const fmt=iso=>{const d=new Date(iso+'T12:00:00');return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});};
      let label,bg,fg;
      if(e&&todayIso>e){label='Ended '+fmt(e);bg='#F3F4F6';fg='#6B7280';}
      else if(s&&todayIso<s){label='Starts '+fmt(s);bg='#EFF6FF';fg='#1E40AF';}
      else if(e){
        const daysLeft=Math.round((new Date(e+'T12:00:00')-new Date(todayIso+'T12:00:00'))/86400000);
        label='Ends '+fmt(e)+(daysLeft>=0?' ('+daysLeft+'d)':'');
        bg=daysLeft<=3?'#FEF3C7':'#D1FAE5';fg=daysLeft<=3?'#92400E':'#065F46';
      } else {label='Since '+fmt(s);bg='#D1FAE5';fg='#065F46';}
      cyclePill=' <span style="font-size:9.5px;font-weight:500;padding:1px 6px;border-radius:999px;background:'+bg+';color:'+fg+';margin-left:4px;white-space:nowrap">'+label+'</span>';
    }
    // Blend badge: surfaces that this item is a multi-peptide mix so it reads
    // differently from single peptides in the inventory list at a glance.
    let blendPill='';
    if(i.isBlend){
      const n=Array.isArray(i.components)?i.components.length:0;
      blendPill=' <span style="font-size:9.5px;font-weight:600;padding:1px 6px;border-radius:999px;background:#EDE9FE;color:#5B21B6;margin-left:4px;white-space:nowrap">🧪 '+n+'-peptide blend</span>';
    }
    const _isFav = !!i.fav;
    const _favIco = _isFav ? '★' : '☆';
    const _favColor = _isFav ? '#F59E0B' : 'var(--color-text-tertiary)';
    const _favTitle = _isFav ? 'Unfavorite' : 'Mark as favorite (bumps to top)';
    return'<div class="pli'+(i.archived?' tmp-archived':'')+'" data-pid="'+i.id+'"><span class="pli-grip" title="Drag to reorder" style="cursor:grab;user-select:none;color:var(--color-text-tertiary);font-size:14px;line-height:1;padding:0 4px;flex-shrink:0">⋮⋮</span><span style="width:10px;height:10px;border-radius:3px;background:'+c.bg+';border:.5px solid '+c.border+';flex-shrink:0;display:inline-block"></span><button type="button" class="pli-fav" data-fid="'+i.id+'" title="'+_favTitle+'" style="background:transparent;border:none;cursor:pointer;font-size:14px;line-height:1;padding:0 4px;color:'+_favColor+';flex-shrink:0">'+_favIco+'</button><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500;color:var(--color-text-primary)">'+escH(i.name)+' <span style="font-size:10px;font-weight:400;color:var(--color-text-tertiary)">'+stklbl+'</span>'+blendPill+cyclePill+'</div><div style="font-size:11px;color:var(--color-text-secondary)">Stock: '+t+' · '+dy+'</div></div><button class="plid" data-xid="'+i.id+'">Delete</button></div>';
  }).join(''):'<div class="empty">No peptides yet</div>';
  // v0.27.1: wire drag-and-drop reorder + ⭐ fav toggle on rendered rows.
  (function(){
    const host = g('peplist');
    if(!host) return;
    let dragId = null;
    host.querySelectorAll('.pli').forEach(row => {
      row.draggable = true;
      row.addEventListener('dragstart', e => {
        dragId = parseInt(row.dataset.pid);
        row.style.opacity = '.45';
        try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(dragId)); } catch(_){}
      });
      row.addEventListener('dragend', () => {
        row.style.opacity = '';
        host.querySelectorAll('.pli').forEach(r => r.style.outline = '');
      });
      row.addEventListener('dragover', e => {
        e.preventDefault();
        if(dragId != null && parseInt(row.dataset.pid) !== dragId){
          row.style.outline = '2px dashed #6366F1';
        }
      });
      row.addEventListener('dragleave', () => { row.style.outline = ''; });
      row.addEventListener('drop', e => {
        e.preventDefault();
        row.style.outline = '';
        const targetId = parseInt(row.dataset.pid);
        if(dragId == null || dragId === targetId) return;
        ptInvMoveTo(dragId, targetId);
        dragId = null;
      });
    });
    host.querySelectorAll('.pli-fav').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        const id = parseInt(b.dataset.fid);
        ptInvToggleFavorite(id);
      });
    });
  })();
}

function ptInvToggleFavorite(id){
  const it = (S.inv||[]).find(x => x.id === id);
  if(!it) return;
  it.fav = !it.fav;
  try { save && save(); } catch(_){}
  try { rlPL(); } catch(_){}
  try { renderInv && renderInv(); } catch(_){}
}
function ptInvMoveTo(dragId, targetId){
  const arr = S.inv || [];
  const di = arr.findIndex(x => x.id === dragId);
  if(di < 0) return;
  const [item] = arr.splice(di, 1);
  const newTi = arr.findIndex(x => x.id === targetId);
  if(newTi < 0){ arr.push(item); }
  else { arr.splice(newTi, 0, item); }
  arr.forEach((x, idx) => { x.rank = idx; });
  try { save && save(); } catch(_){}
  try { rlPL(); } catch(_){}
  try { renderInv && renderInv(); } catch(_){}
  try { renderStack && renderStack(); } catch(_){}
}
window.ptInvToggleFavorite = ptInvToggleFavorite;
window.ptInvMoveTo = ptInvMoveTo;
function swPT(t){
  const iL=t==='list', iI=t==='inv';
  g('pt-list').style.display=iL?'block':'none';
  g('pt-form').style.display=(!iL&&!iI)?'block':'none';
  const invPanel=g('pt-inv-add');if(invPanel)invPanel.style.display=iI?'block':'none';
  g('ptl-btn').classList.toggle('on',iL);
  g('ptf-btn').classList.toggle('on',!iL&&!iI);
  const piBtn=g('pti-btn');if(piBtn)piBtn.classList.toggle('on',iI);
  if(iL){pepEId=null;rlPL();}
  else if(iI){popInvAdd();}
  else if(!pepEId)clrPF();
  if(!iL){
    setTimeout(()=>{
      const target = iI ? g('pt-inv-add') : g('pt-form');
      if(!target) return;
      try { target.scrollIntoView({behavior:'smooth', block:'start'}); } catch(_){}
      target.classList.remove('pt-pepmgr-focus-pulse');
      void target.offsetWidth;
      target.classList.add('pt-pepmgr-focus-pulse');
      setTimeout(()=>target.classList.remove('pt-pepmgr-focus-pulse'), 900);
    }, 60);
  }
}
function closePepMgr(){
  window._pepMgrClosing = true;
  const mgr=g('pepmgr');
  if(mgr) mgr.style.display='none';
  try{swPT('list');}catch(err){console.error('closePepMgr swPT:',err);}
  setTimeout(function(){
    try{rr();}catch(err){console.error('closePepMgr rr:',err);}
    window._pepMgrClosing = false;
  }, 0);
}
window.closePepMgr=closePepMgr;
function openPepEditor(it){
  if(!it)return;
  window._pepFormBusy=true;
  try{
    pepEId=it.id;
    const mgr=g('pepmgr');
    if(mgr) mgr.style.display='block';
    swPT('form');
    fillPF(it);
    const tabBtn=g('ptf-btn');
    if(tabBtn) tabBtn.textContent='Editing: '+it.name;
    buildPFA(true);
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        const form=g('pt-form')||mgr;
        if(form){
          try{form.scrollIntoView({behavior:'smooth',block:'start'});}catch(_){
            try{form.scrollIntoView({block:'start'});}catch(__){}
          }
        }
        const nameInput=g('pf-nm');
        if(nameInput){
          try{nameInput.focus({preventScroll:true});}catch(_){try{nameInput.focus();}catch(__){}}
        }
        window._pepFormBusy=false;
      });
    });
  }catch(err){
    window._pepFormBusy=false;
    console.error('openPepEditor failed:',err);
  }
}
window.openPepEditor=openPepEditor;
window.openPepEdit=function(id){const it=(S.inv||[]).find(i=>i.id===parseInt(id,10));if(it)openPepEditor(it);};
function popSel(){
  const el=g('lg-pep');if(!el)return;
  const prev=el.value;
  // Sort: fridge-active (fr>0) first, then the rest; both groups alphabetical
  // Filter: must have a name, must not be a supply, and must not be flagged
  // as non-peptide (isPeptide:false). Belt-and-suspenders — supplies should
  // already have isPeptide:false, but the !isSupply guard protects users
  // whose data predates the backfill migration.
  const list=[...(S.inv||[])].filter(p=>{
    if(!p.name||p.isSupply||p.archived) return false;
    if(p.isPeptide!==false) return true;
    if(typeof window.calcLooksLikeOil!=='function') return false;
    return !!(window.calcLooksLikeOil(p.name)||window.calcLooksLikeOil(p.cat||''));
  });
  list.sort((a,b)=>{
    const aA=(a.fr||0)>0?0:1,bA=(b.fr||0)>0?0:1;
    if(aA!==bA)return aA-bA;
    return a.name.localeCompare(b.name);
  });
  el.innerHTML=list.map(i=>{
    const active=(i.fr||0)>0;
    const parts=[];
    if(active)parts.push('🧊×'+i.fr);
    else if((i.fz||0)>0)parts.push('❄ freezer only');
    if(i.dose)parts.push(i.dose+normalizeShotLogDoseUnit(i.doseUnit));
    const tag=parts.length?' — '+parts.join(' · '):'';
    return '<option value="'+i.name.replace(/"/g,'&quot;')+'">'+i.name+tag+'</option>';
  }).join('');
  if(list.find(i=>i.name===prev))el.value=prev;
  // Auto-fill dose/volume/site when the user picks a different peptide on the
  // shot log. The actual fill logic lives in autofillShotLogForPep so it can
  // be reused by deep-link entry points (clicking a peptide in Daily Stack,
  // calendar log-shot tiles, etc.). The calc-to-log deep-link bypasses this
  // by setting el.value without dispatching change, so calc-derived dose/vol
  // are never overwritten.
  if(!el._autoFillWired){
    el.addEventListener('change',()=>{
      clearLgSiteUserPicked();
      autofillShotLogForPep(el.value);
    });
    el._autoFillWired=true;
  }
}

// Persist a chosen/logged dose onto the inventory peptide for future auto-fill
// (calculator Load from inventory + shot-log peptide picker).
function rememberPepDose(pepName, dose, doseUnit, freq){
  try{
    if(!pepName) return;
    const n=parseFloat(dose);
    if(!(n>0)) return;
    const pep=(S.inv||[]).find(p=>p&&!p.isSupply&&p.name===pepName);
    if(!pep) return;
    const unit=normalizeShotLogDoseUnit(doseUnit);
    pep.dose=n;
    pep.doseUnit=unit;
    const patch={dose:n, doseUnit:unit};
    if(freq!=null && String(freq).trim()!==''){
      patch.freq=String(freq);
      pep.doseFreq=String(freq);
    }
    pep.lastCalc=Object.assign({}, pep.lastCalc||{}, patch);
  }catch(_){}
}
window._rememberPepDose=rememberPepDose;

// Populate the shot-log form fields from the most recent shot of `pepName`,
// falling back to the inventory's planned dose/recon when no prior shots
// exist. Notes/tags/severity are NEVER carried forward — those are
// observation data tied to a specific shot, not defaults for the next one.
function autofillShotLogForPep(pepName){
  if(!pepName)return;
  const shots=(S.shots||[]).filter(s=>s.peptide===pepName);
  // Sort most-recent first: by date desc, then by id desc as a tiebreaker
  // (id increments on every logged shot)
  const lastShot=shots.length
    ? shots.slice().sort((a,b)=>{
        if(a.date!==b.date)return a.date<b.date?1:-1;
        return (b.id||0)-(a.id||0);
      })[0]
    : null;
  // Prefer remembered / inventory dose, then last shot (volume/site still come from last shot).
  const pepInv=(S.inv||[]).find(i=>i.name===pepName);
  const rememberedDose=(pepInv&&pepInv.lastCalc&&pepInv.lastCalc.dose>0)
    ? {dose:pepInv.lastCalc.dose, doseUnit:normalizeShotLogDoseUnit(pepInv.lastCalc.doseUnit)}
    : (pepInv&&pepInv.dose>0 ? {dose:pepInv.dose, doseUnit:normalizeShotLogDoseUnit(pepInv.doseUnit)} : null);
  if(lastShot){
    if(rememberedDose){
      sv('lg-dose',rememberedDose.dose);
      sv('lg-dose-unit',rememberedDose.doseUnit);
    }else if(lastShot.dose!=null){
      sv('lg-dose',lastShot.dose);
      sv('lg-dose-unit',normalizeShotLogDoseUnit(lastShot.doseUnit));
    }else{
      sv('lg-dose-unit',SHOT_LOG_DEFAULT_DOSE_UNIT);
    }
    if(lastShot.volume!=null&&lastShot.volumeUnit!=='pill'){
      // Always prefer mL on Shot Log (convert U-100 syringe units → mL).
      sv('lg-vol-unit','mL');
      const v=Number(lastShot.volume)||0;
      sv('lg-vol', (lastShot.volumeUnit==='units')
        ? (v/100).toFixed(3).replace(/\.?0+$/,'')
        : lastShot.volume);
    }else{
      sv('lg-vol-unit','mL');
    }
    if(!_lgSiteUserPicked){
      const siteFromLast=lastShot?(lastShot.site||''):'';
      const globalSite=readLastInjectionSite();
      applyLgSiteDomValue(globalSite||siteFromLast);
    }
    return;
  }
  // No prior shot — fall back to remembered / inventory planned dose
  if(!pepInv){
    sv('lg-dose-unit',SHOT_LOG_DEFAULT_DOSE_UNIT);
    sv('lg-vol-unit','mL');
    return;
  }
  if(rememberedDose){
    sv('lg-dose',rememberedDose.dose);
    sv('lg-dose-unit',rememberedDose.doseUnit);
  }else{
    sv('lg-dose-unit',SHOT_LOG_DEFAULT_DOSE_UNIT);
  }
  // Fresh peptide: always start volume in mL (not insulin units).
  sv('lg-vol-unit','mL');
  if(pepInv.vialMg>0&&pepInv.reconBacMl>0&&pepInv.dose>0){
    const doseMg=(normalizeShotLogDoseUnit(pepInv.doseUnit)==='mg')?pepInv.dose:pepInv.dose/1000;
    const volMl=doseMg/(pepInv.vialMg/pepInv.reconBacMl);
    sv('lg-vol',Math.round(volMl*1000)/1000);
  }
  if(!_lgSiteUserPicked)applyLgSiteDomValue(readLastInjectionSite());
}
function rr(){const p=document.querySelector('#nav button.on')?.dataset.pg;if(p==='calendar')renderCal();if(p==='inventory')scheduleInventoryVialRefresh(true);if(p==='stack')renderStack();}

/* ============================================================
   SECTION: Price Comparison
   The peptide × vendor price matrix: filter/sort state, cell
   editing, vendor add/rename/delete, and rendering. Shares the
   PEPTIDE_CATALOG category map; imports arrive via the
   Price Importer Subsystem near end of file.
   ============================================================ */

let vci=null;
let editingCell=null; // {pep, vendor}
let editingVendor=null; // original vendor name being edited

// Price table view state (session-only; resets on refresh)
let priceView={search:'',category:'',vendor:'',sort:'name-asc',topN:false,topMetric:'vendors'};

// Look up a peptide's catalog category by name (strips any trailing dose).
// Returns a category string like "GLP-1", "Healing" etc., or null if unmapped.
function getPeptideCategoryFromName(name){
  const cleaned=(name||'').replace(/\s+\d+(?:\.\d+)?\s*(mg|mcg|μg|ug|ml|iu|units)\b/i,'').trim();
  const normed=_normPepStr(cleaned);
  for(const entry of PEPTIDE_CATALOG){
    if(_normPepStr(entry[0])===normed)return entry[3];
    for(const a of entry[1]||[]){if(_normPepStr(a)===normed)return entry[3];}
  }
  return null;
}

// Apply the current priceView state (search / category / vendor / sort) to a peptide name array.
function applyPriceView(peps){
  try{performance.mark('vp-filter-start');}catch(_){}
  let out=peps.slice();
  if(priceView.search){
    const q=priceView.search.toLowerCase();
    out=out.filter(p=>p.toLowerCase().includes(q));
  }
  if(priceView.category){
    out=out.filter(p=>(getPeptideCategoryFromName(p)||'Uncategorized')===priceView.category);
  }
  if(priceView.vendor){
    out=out.filter(p=>(S.prices[p]||{})[priceView.vendor]!=null);
  }
  // Memoize per-peptide computed metrics so the sort comparator stays O(n log n) on rows, not O(n² vendors)
  const meta={};
  const getMeta=p=>{
    if(meta[p])return meta[p];
    const pr=Object.values(S.prices[p]||{}).filter(x=>x!=null&&isFinite(+x));
    const min=pr.length?Math.min(...pr):Infinity;
    const max=pr.length?Math.max(...pr):0;
    return meta[p]={min,max,count:pr.length,spread:max-min};
  };
  const cmp={
    'name-asc':(a,b)=>a.localeCompare(b),
    'name-desc':(a,b)=>b.localeCompare(a),
    'price-asc':(a,b)=>{const d=getMeta(a).min-getMeta(b).min;return d!==0?d:a.localeCompare(b);},
    'price-desc':(a,b)=>{const d=getMeta(b).min-getMeta(a).min;return d!==0?d:a.localeCompare(b);},
    'vendors':(a,b)=>{const d=getMeta(b).count-getMeta(a).count;return d!==0?d:a.localeCompare(b);},
    'spread':(a,b)=>{const d=getMeta(b).spread-getMeta(a).spread;return d!==0?d:a.localeCompare(b);}
  }[priceView.sort]||((a,b)=>a.localeCompare(b));
  // Top-N filter: when enabled, crop to the top 20 by the chosen metric
  // first, THEN apply the user's user-visible sort below.
  if(priceView.topN){
    if(priceView.topMetric==='recommended'){
      // Recommended: score by user activity (cal/inv/shots/vials/packages),
      // mapped from inv.cat → S.prices keys. Hide rows with score=0.
      const recScores = computeRecommendedScores();
      out = out.filter(p => (recScores.get(p)||0) > 0);
      out = out.slice().sort((a,b)=>{
        const d=(recScores.get(b)||0)-(recScores.get(a)||0);
        return d!==0?d:a.localeCompare(b);
      }).slice(0,20);
    } else {
      const metricCmp={
        'vendors':(a,b)=>{const d=getMeta(b).count-getMeta(a).count;return d!==0?d:getMeta(a).min-getMeta(b).min;},
        'cheapest':(a,b)=>{const d=getMeta(a).min-getMeta(b).min;return d!==0?d:a.localeCompare(b);},
        'spread':(a,b)=>{const d=getMeta(b).spread-getMeta(a).spread;return d!==0?d:a.localeCompare(b);}
      }[priceView.topMetric]||((a,b)=>getMeta(b).count-getMeta(a).count);
      out=out.slice().sort(metricCmp).slice(0,20);
    }
  }
  out.sort(cmp);
  try{
    performance.mark('vp-filter-end');
    performance.measure('vp-filter-duration','vp-filter-start','vp-filter-end');
  }catch(_){}
  return out;
}

// Compute relevance score per S.prices key based on inv item activity.
// Uses inv.cat (catalog/price-table name) to map nicknames to price-table rows.
// Returns a Map<priceKey, score>. Rows with score 0 are unmapped/unused.
function computeRecommendedScores(){
  const out = new Map();
  if(!S.prices || typeof S.prices!=='object') return out;
  const stripDose = name => String(name||'').replace(/\s+\d+(?:\.\d+)?\s*(mg|mcg|μg|ug|ml|iu|units)\b.*/i,'').trim();
  const norm = s => stripDose(s).toLowerCase();
  const hasDose = s => /\d+(?:\.\d+)?\s*(mg|mcg|μg|ug|ml|iu|units)\b/i.test(s||'');
  const priceKeys = Object.keys(S.prices);
  // Per-inv activity score
  function activityScore(inv){
    if(inv.archived) return 0;
    let s = 5; // base for being active in inventory
    // Scheduled (S.sched keys: "name/time/day")
    let sched=0;
    Object.keys(S.sched||{}).forEach(k=>{
      if(k.split('/')[0]===inv.name) sched++;
    });
    if(sched>0) s += Math.min(sched, 7);
    // Recent shots (last 30 days)
    const cutoff = Date.now() - 30*24*3600*1000;
    let shots=0;
    (S.shots||[]).forEach(sh=>{
      if(sh.peptide!==inv.name) return;
      const ts = sh.date ? new Date(sh.date+'T00:00').getTime() : NaN;
      if(!isNaN(ts) && ts>=cutoff) shots++;
    });
    s += Math.min(shots*0.5, 5);
    // Active vials (any non-empty)
    const vials = (S.vials||[]).filter(v=>v.peptideName===inv.name);
    const liveVials = vials.filter(v=>(v.remainingMcg||0)>0 || (v.totalMcg||0)>0);
    if(liveVials.length) s += Math.min(liveVials.length*0.5, 3);
    // Recent packages mentioning this peptide name (or its cat) in items text
    const pkgRe = new RegExp('\\b'+inv.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i');
    const pkgHits = (S.packages||[]).filter(p=>pkgRe.test(String(p.items||'')));
    if(pkgHits.length) s += 3;
    return s;
  }
  // For each inv item with cat set, distribute its score to matching price keys
  (S.inv||[]).forEach(inv=>{
    if(inv.isSupply) return;
    if(!inv.cat) return;
    const score = activityScore(inv);
    if(score<=0) return;
    const catRaw = String(inv.cat).trim();
    const catLow = catRaw.toLowerCase();
    const catBase = norm(catRaw);
    const catHasDose = hasDose(catRaw);
    if(!catBase) return;
    priceKeys.forEach(key=>{
      const keyLow = key.toLowerCase();
      if(catHasDose){
        // Specific match — full key equals user's cat
        if(keyLow === catLow){
          out.set(key, Math.max(out.get(key)||0, score));
        }
      } else {
        // Base match — strip dose from key, compare
        const keyBase = norm(key);
        if(keyBase === catBase){
          out.set(key, Math.max(out.get(key)||0, score));
        }
      }
    });
  });
  return out;
}

function _vendorPricingPageVisible(){
  var pg=g('pg-prices');
  if(!pg)return false;
  if(getComputedStyle(pg).display==='none')return false;
  return true;
}

function renderPrices(){
  // Normalize vendor-key casing in S.prices to match the canonical S.vendors list,
  // so prices imported under a case variant (e.g. "jeep") still show under "JEEP".
  if(S.prices&&S.vendors&&S.vendors.length){
    const canonicalByLower={};
    S.vendors.forEach(v=>{canonicalByLower[v.toLowerCase()]=v;});
    Object.keys(S.prices).forEach(p=>{
      const row=S.prices[p];if(!row||typeof row!=='object')return;
      Object.keys(row).forEach(k=>{
        const canonical=canonicalByLower[k.toLowerCase()];
        if(canonical&&canonical!==k){
          if(row[canonical]==null)row[canonical]=row[k];
          delete row[k];
        }
      });
    });
  }
  // ── VP off-page deferral (OLD-PERF-VP-1 + VP-1-fix) ──
  // Skip heavy DOM/table rebuild when Vendor Pricing page is not visible.
  // The vendor-key normalization above still runs (cheap, ensures data integrity).
  // VP-1-fix: robust visibility check + force flag + flush tracking + applyPricesLayout.
  var _vpForce=!!window.__renderPricesForceNext;
  window.__renderPricesForceNext=false;
  if(!_vpForce&&!_vendorPricingPageVisible()){
    window._renderPricesNeedsFlush=true;
    return;
  }
  window._renderPricesNeedsFlush=false;
  applyPricesLayout();
  // ── end deferral guard ──
  const allPeps=Object.keys(S.prices);
  const vendors=S.vendors;
  // Populate the category dropdown with distinct categories actually present in the table.
  // Preserve the current selection if it's still valid after this refresh.
  const catSet=new Set();
  allPeps.forEach(p=>{catSet.add(getPeptideCategoryFromName(p)||'Uncategorized');});
  const cats=[...catSet].sort();
  const catSel=g('pv-category');
  if(catSel){
    const prev=priceView.category;
    catSel.innerHTML='<option value="">All categories</option>'+cats.map(c=>'<option value="'+escA(c)+'">'+escH(c)+'</option>').join('');
    if(cats.indexOf(prev)>=0)catSel.value=prev;else{priceView.category='';catSel.value='';}
  }
  const venSel=g('pv-vendor');
  if(venSel){
    const prev=priceView.vendor;
    venSel.innerHTML='<option value="">All vendors</option>'+vendors.map(v=>'<option value="'+escA(v)+'">'+escH(v)+'</option>').join('');
    if(vendors.indexOf(prev)>=0)venSel.value=prev;else{priceView.vendor='';venSel.value='';}
  }
  // Apply filter + sort
  const peps=applyPriceView(allPeps);
  const countEl=g('pv-count');
  if(countEl){
    const total=allPeps.length;
    const filtered=peps.length;
    if(filtered===total)countEl.textContent=total+' peptide'+(total===1?'':'s');
    else countEl.textContent=filtered+' of '+total+' shown';
  }
  // Header row: styled vendor chips
  g('pt-head').innerHTML='<tr style="background:#F8FBFF">'
    +'<th class="pep-sticky-head" style="font-size:11px;font-weight:700;color:var(--accent-blue-fg);padding:5px 6px">Peptide</th>'
    +vendors.map(v=>'<th class="vendor-col" title="'+v.replace(/"/g,'&quot;')+'" style="text-align:center;padding:2px 2px"><span class="v-hdr" data-v="'+v.replace(/"/g,'&quot;')+'" title="'+v.replace(/"/g,'&quot;')+'" style="display:inline-block;background:#DBEAFE;color:var(--accent-blue-fg);padding:2px 6px;border-radius:6px;font-size:10.5px;font-weight:600;cursor:pointer;white-space:nowrap;border:.5px solid #93C5FD">'+escH(v)+'</span></th>').join('')
    +'</tr>';
  // Body rows
  // v19a: warehouse-aware cell rendering. Each cell value can be either a
  // legacy number (treated as CN) or the new {warehouse:price} object. Best-
  // price highlight (mn) is computed across all visible warehouse-prices in
  // the row; second-best (mn2) is the next-lowest. Filter set is global.
  const _whFilter = (typeof tmpGetWarehouseFilter==='function') ? tmpGetWarehouseFilter() : new Set(['US','CN','CA','EU']);
  const _whOrder = ['US','CN','CA','EU'];  // display order in multi-warehouse cells
  const _whFlag  = { US:'🇺🇸', CN:'🌏', CA:'🇨🇦', EU:'🇪🇺' };
  function _cellPriceMap(p, v){
    const row = S.prices[p]; if (!row) return null;
    const cell = row[v]; if (cell == null) return null;
    if (typeof cell === 'number') return { CN: cell };  // legacy fallback
    if (typeof cell === 'object') return cell;
    return null;
  }
  g('pt-body').innerHTML=peps.map((p,ri)=>{
    const c=pepColor(p);
    const pb='<span style="font-size:11px;padding:2px 8px;border-radius:6px;font-weight:500;background:'+c.bg+';color:'+c.text+';border:.5px solid '+c.border+'">'+escH(p)+'</span>';
    const cellMaps = vendors.map(v => _cellPriceMap(p, v));
    // Collect every visible price across the row (any vendor × any selected warehouse).
    const visiblePrices = [];
    cellMaps.forEach(cm => {
      if (!cm) return;
      _whOrder.forEach(wh => {
        if (!_whFilter.has(wh)) return;
        if (cm[wh] != null && cm[wh] >= 0) visiblePrices.push(+cm[wh]);
      });
    });
    const mn = visiblePrices.length ? Math.min(...visiblePrices) : null;
    const above = visiblePrices.filter(x => x > mn);
    const mn2 = above.length ? Math.min(...above) : null;
    const rowBg = '';  // v0.27.74: column zebra replaces row zebra
    const cells = vendors.map((v,i) => {
      const cm = cellMaps[i];
      const dataAttrs = ' class="price-cell" data-pep="'+p.replace(/"/g,'&quot;')+'" data-v="'+v.replace(/"/g,'&quot;')+'" style="cursor:pointer;text-align:center;vertical-align:middle;'+(rowBg)+'"';
      if (!cm) return '<td'+dataAttrs+'><span style="color:var(--color-text-tertiary)">—</span></td>';
      const visibleHere = _whOrder.filter(wh => _whFilter.has(wh) && cm[wh] != null);
      if (!visibleHere.length) return '<td'+dataAttrs+'><span style="color:var(--color-text-tertiary)">—</span></td>';
      const single = visibleHere.length === 1;
      const items = visibleHere.map(wh => {
        const x = +cm[wh];
        let pillStyle, fontSize;
        if (x === mn){
          pillStyle = 'background:#D1FAE5;color:var(--accent-green-fg);font-weight:700;border-radius:6px;border:.5px solid #6EE7B7';
        } else if (x === mn2){
          pillStyle = 'background:#FEF9C3;color:var(--accent-amber-fg);font-weight:600;border-radius:6px;border:.5px solid #FDE047';
        } else {
          pillStyle = 'color:var(--color-text-secondary)';
        }
        if (single){
          return '<span style="padding:3px 9px;font-size:12px;'+pillStyle+'">$'+x+'</span>';
        }
        // Multi-warehouse compact stacked display
        return '<div style="font-size:10.5px;line-height:1.4;display:flex;align-items:center;gap:5px;justify-content:center">'
             + '<span style="padding:1px 7px;font-size:11px;'+pillStyle+'">$'+x+'</span>'
             + '<span style="opacity:.65;font-size:9.5px;font-weight:600">'+_whFlag[wh]+'</span>'
             + '</div>';
      }).join('');
      return '<td'+dataAttrs+'>'+items+'</td>';
    }).join('');
    return'<tr style="'+rowBg+'">'
      +'<td style="cursor:pointer;'+rowBg+'" class="pep-cell" data-pep="'+p.replace(/"/g,'&quot;')+'" title="Click to rename / delete">'+pb+'</td>'
      +cells+'</tr>';
  }).join('')||'<tr><td colspan="'+(vendors.length+1)+'" class="empty-state" style="padding:2rem 1rem"><div class="empty-state-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><h4>'+(allPeps.length?'No matches':'No peptides yet')+'</h4><p>'+(allPeps.length?'Clear the filter above to see all peptides.':'Click <b>+ Peptide</b> above to add peptides, then enter prices per vendor.')+'</p></td></tr>';
  // Chart reflects the currently-filtered peptides (top 8), limited by active filter
  if(vci){vci.destroy();vci=null;}
  const t8=peps.slice(0,8);
  if(t8.length&&vendors.length){
    vci=new Chart(g('vchart').getContext('2d'),{type:'bar',data:{labels:t8,datasets:vendors.slice(0,8).map((v,i)=>({label:v,data:t8.map(p=>(S.prices[p]||{})[v]||null),backgroundColor:CC[i%CC.length],borderRadius:3,borderSkipped:false}))},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+c.dataset.label+': $'+c.parsed.y}}},scales:{y:{beginAtZero:true,ticks:{callback:v=>'$'+v}},x:{ticks:{font:{size:11},autoSkip:false}}}}});
  }
  g('v-leg').innerHTML=vendors.slice(0,8).map((v,i)=>'<span style="display:flex;align-items:center;gap:4px"><span style="width:9px;height:9px;border-radius:2px;background:'+CC[i%CC.length]+'"></span>'+v+'</span>').join('');
}

function openVendorEdit(vendorName){
  editingVendor=vendorName;
  g('ve-title').textContent=vendorName?'Edit vendor: '+vendorName:'Add new vendor';
  sv('ve-name',vendorName||'');
  const peps=Object.keys(S.prices);
  const pricesEl=g('ve-prices');
  if(!peps.length){
    pricesEl.innerHTML='<div style="grid-column:1/-1;font-size:12px;color:var(--color-text-tertiary);padding:8px 0">No peptides yet. Add peptides first with "+ Peptide" above.</div>';
  }else{
    pricesEl.innerHTML=peps.map(p=>{
      const c=pepColor(p);
      const curr=vendorName&&S.prices[p]&&S.prices[p][vendorName]!=null?S.prices[p][vendorName]:'';
      const inpId='ve-price-'+encodeURIComponent(p);
      return'<label for="'+inpId+'" style="display:flex;align-items:center;gap:8px;font-size:12px"><span style="font-size:11px;padding:2px 8px;border-radius:6px;font-weight:500;background:'+c.bg+';color:'+c.text+';border:.5px solid '+c.border+'">'+escH(p)+'</span></label>'
        +'<div style="display:flex;align-items:center;gap:4px"><span style="color:var(--color-text-tertiary);font-size:13px">$</span><input type="number" id="'+inpId+'" min="0" step="any" data-pep="'+escA(p)+'" value="'+escA(String(curr))+'" placeholder="—" style="width:100%"></div>';
    }).join('');
  }
  g('ve-del').style.display=vendorName?'':'none';
  g('ve-msg').textContent='';
  g('vendor-edit-card').style.display='block';
  setTimeout(()=>g('vendor-edit-card').scrollIntoView({behavior:'smooth',block:'nearest'}),40);
}
function closeVendorEdit(){g('vendor-edit-card').style.display='none';editingVendor=null;g('ve-msg').textContent='';}
function saveVendorEdit(){
  // v17: vendor names are normalized to UPPERCASE storage-wide.
  const newName=gv('ve-name').trim().toUpperCase();
  const msg=g('ve-msg');
  if(!newName){msg.textContent='Enter a vendor name.';msg.style.color='#A32D2D';return;}
  const existsAtOther=S.vendors.find(v=>v.toLowerCase()===newName.toLowerCase()&&v!==editingVendor);
  if(existsAtOther){msg.textContent='Another vendor already uses that name.';msg.style.color='#A32D2D';return;}
  // Collect price inputs
  const inputs=g('ve-prices').querySelectorAll('input[data-pep]');
  if(editingVendor){
    // Rename if changed
    if(editingVendor!==newName){
      const idx=S.vendors.indexOf(editingVendor);
      if(idx>=0)S.vendors[idx]=newName;
      // Move prices under new key
      Object.keys(S.prices).forEach(p=>{
        if(S.prices[p][editingVendor]!=null){S.prices[p][newName]=S.prices[p][editingVendor];delete S.prices[p][editingVendor];}
      });
    }
  }else{
    S.vendors.push(newName);
  }
  // Apply price inputs
  inputs.forEach(inp=>{
    const pep=inp.dataset.pep;const raw=inp.value.trim();
    if(!S.prices[pep])S.prices[pep]={};
    if(raw===''){delete S.prices[pep][newName];}
    else{const n=parseFloat(raw);if(!isNaN(n)&&n>=0)S.prices[pep][newName]=n;}
  });
  save();closeVendorEdit();renderPrices();
}
function deleteVendor(){
  if(!editingVendor)return;
  if(!confirm('Delete vendor "'+editingVendor+'" and all its prices?'))return;
  S.vendors=S.vendors.filter(v=>v!==editingVendor);
  Object.keys(S.prices).forEach(p=>{delete S.prices[p][editingVendor];});
  save();closeVendorEdit();renderPrices();
}

function beginCellEdit(td,pep,vendor){
  if(editingCell)return;
  editingCell={pep,vendor};
  const current=(S.prices[pep]&&S.prices[pep][vendor]!=null)?S.prices[pep][vendor]:'';
  td.innerHTML='<input type="number" min="0" step="any" value="'+current+'" style="width:70px;font-size:12px;padding:2px 6px">';
  const inp=td.querySelector('input');
  inp.focus();inp.select();
  const commit=()=>{
    const raw=inp.value.trim();
    if(!S.prices[pep])S.prices[pep]={};
    if(raw===''){delete S.prices[pep][vendor];}
    else{const n=parseFloat(raw);if(!isNaN(n)&&n>=0)S.prices[pep][vendor]=n;}
    editingCell=null;save();renderPrices();
  };
  const cancel=()=>{editingCell=null;renderPrices();};
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commit();}else if(e.key==='Escape'){cancel();}});
  inp.addEventListener('blur',commit);
}

function promptRenamePeptide(oldName){
  const newName=prompt('Rename peptide "'+oldName+'" (or leave blank and press OK to delete):',oldName);
  if(newName===null)return; // cancelled
  if(newName.trim()===''){
    if(!confirm('Delete peptide "'+oldName+'" and all its prices?'))return;
    delete S.prices[oldName];
    save();renderPrices();return;
  }
  const trimmed=newName.trim();
  if(trimmed===oldName)return;
  if(S.prices[trimmed]){alert('Peptide "'+trimmed+'" already exists.');return;}
  S.prices[trimmed]=S.prices[oldName];delete S.prices[oldName];
  save();renderPrices();
}
function promptAddPeptide(){
  const name=prompt('Peptide name:');
  if(!name||!name.trim())return;
  const trimmed=name.trim();
  if(S.prices[trimmed]){alert('Already exists.');return;}
  S.prices[trimmed]={};
  save();renderPrices();
}

/* ============================================================
   SECTION: Calculator, Titration & Protocols
   Reconstitution math and dose-volume calculator (with animated
   syringe illustrations), titration schedules (dose ladders over
   weeks/months with adherence tracking), and the reference
   peptide catalog grid.
   ============================================================ */

const SYRS=[{ml:.3,max:30,step:5},{ml:.5,max:50,step:10},{ml:1,max:100,step:20}];
function initCalcSyringes(){
  const sc=g('calc-syringes');sc.innerHTML='';
  SYRS.forEach((s,i)=>sc.appendChild(makeSyringe(0,s.max,s.ml,s.step,i)));
}
function updateSyringes(u100){
  SYRS.forEach((s,i)=>{
    const isEmpty=u100===0;
    const pct=isEmpty?0:Math.min(u100/s.max,1);
    const over=!isEmpty&&u100>s.max;
    const fill=document.getElementById('syr-fill-'+i);
    const val=document.getElementById('syr-val-'+i);
    const mk=document.getElementById('syr-mk-'+i);
    const tb=document.getElementById('syr-tube-'+i);
    const ow=document.getElementById('syr-over-'+i);
    if(fill)fill.style.width=(pct*100)+'%';
    if(mk){mk.style.left=(pct*100)+'%';mk.style.display=(isEmpty||over)?'none':'block';}
    if(val){val.textContent=isEmpty?'—':over?'>'+s.max:u100.toFixed(1);val.style.color=over?'#DC2626':isEmpty?'var(--color-text-tertiary)':'#185FA5';}
    if(tb)tb.style.borderColor=over?'#DC2626':'#CBD5E1';
    if(ow)ow.style.display=over?'block':'none';
  });
}
function buildQPs(cid,vals,inputId){
  const c=g(cid);
  c.innerHTML=vals.map(v=>'<button class="qbtn" data-v="'+v+'" data-inp="'+inputId+'">'+v+'</button>').join('');
  c.querySelectorAll('.qbtn').forEach(b=>b.addEventListener('click',function(){
    g(this.dataset.inp).value=this.dataset.v;
    c.querySelectorAll('.qbtn').forEach(x=>x.classList.remove('on'));
    this.classList.add('on');
    doCalc();
  }));
}
function getTitStatus(t,pepName){
  const startMs=new Date(t.startDate+'T12:00:00').getTime();
  // Count actual shots logged for this peptide since start date
  const shots=(S.shots||[]).filter(s=>s.peptide===pepName&&new Date(s.date+'T12:00:00').getTime()>=startMs);
  const actualDoses=shots.length;
  // Determine effective weeks from actual shots: count distinct ISO weeks with at least one shot
  const weekSet=new Set(shots.map(s=>{
    const d=new Date(s.date+'T12:00:00');
    const jan4=new Date(d.getFullYear(),0,4);
    const wk=Math.ceil(((d-jan4)/864e5+jan4.getDay()+1)/7);
    return d.getFullYear()+'-W'+wk;
  }));
  // Fall back to calendar weeks if no shots logged yet
  const calWeeks=Math.max(0,Math.floor((Date.now()-startMs)/(7*24*60*60*1000)));
  const weeksElapsed=weekSet.size>0?weekSet.size:calWeeks;
  const totalCycle=(t.cycleOn||12)+(t.cycleOff||4);
  const inCycle=weeksElapsed%totalCycle;
  const isBreak=inCycle>=(t.cycleOn||12);
  const increments=(t.incrAmt&&t.incrWks)?Math.floor(weeksElapsed/t.incrWks):0;
  const dose=t.incrAmt?Math.min(t.startDose+(increments*t.incrAmt),t.targetDose):t.startDose;
  const atTarget=dose>=t.targetDose;
  const nextIncrDate=(t.incrAmt&&!atTarget)?new Date(startMs+((increments+1)*t.incrWks)*7*24*60*60*1000):null;
  return{weeksElapsed,inCycle,isBreak,dose,atTarget,nextIncrDate,cycleOn:t.cycleOn||12,cycleOff:t.cycleOff||4,totalCycle,unit:t.unit,actualDoses,logBased:weekSet.size>0};
}

// Parse a frequency string like "5×/week" or "Daily" into expected shots per week.
// Empty / missing → once daily (7). Unknown non-empty strings stay 0 (e.g. Topical).
function freqPerWeek(freq){
  if(freq==null||String(freq).trim()==='')return 7;
  const f=String(freq).toLowerCase();
  if(f.includes('topical'))return 0;
  if(f.includes('twice daily')||f.includes('2×/day')||f.includes('2x/day'))return 14;
  if(f.includes('daily')||f.includes('every day'))return 7;
  const m=f.match(/(\d+(?:\.\d+)?)\s*[×x]\s*\/\s*week/);
  if(m)return parseFloat(m[1]);
  if(f.includes('once weekly')||f.includes('once/week')||f.includes('1×/week')||f.includes('1x/week'))return 1;
  // Calc stores doses/day as a numeric string ("1", "0.1429")
  const n=parseFloat(freq);
  if(Number.isFinite(n)&&n>0&&String(freq).trim()===String(n))return n*7;
  return 0;
}

// Shots/week for runout tables & charts: interval → schedule → remembered calc freq → once daily.
function pepShotsPerWeek(it){
  if(!it)return 7;
  if(it.interval>0)return Math.max(0.1,7/it.interval);
  let c=0;
  try{
    for(let d=0;d<7;d++){
      if((S.sched||{})[sk(it.name,'am',d)])c++;
      if((S.sched||{})[sk(it.name,'pm',d)])c++;
    }
  }catch(_){c=0;}
  if(c>0)return c;
  if(it.lastCalc&&it.lastCalc.freq!=null&&String(it.lastCalc.freq).trim()!==''){
    const fromMem=freqPerWeek(it.lastCalc.freq);
    if(fromMem>0)return fromMem;
  }
  if(it.doseFreq){
    const fromLabel=freqPerWeek(it.doseFreq);
    if(fromLabel>0)return fromLabel;
  }
  return 7;
}
window.pepShotsPerWeek=pepShotsPerWeek;
// ISO-week identifier for a YYYY-MM-DD date string or Date
function isoWeekKey(dLike){
  const d=typeof dLike==='string'?new Date(dLike+'T12:00:00'):dLike;
  const jan4=new Date(d.getFullYear(),0,4);
  const wk=Math.ceil(((d-jan4)/864e5+jan4.getDay()+1)/7);
  return d.getFullYear()+'-W'+wk;
}
// Adherence this ISO week for a peptide given its expected doses/week
function getTitAdherence(pepName,expectedPerWeek){
  const cur=isoWeekKey(new Date());
  const weekShots=(S.shots||[]).filter(s=>s.peptide===pepName&&isoWeekKey(s.date)===cur).length;
  const pct=expectedPerWeek>0?Math.min(100,Math.round(weekShots/expectedPerWeek*100)):0;
  return{weekShots,expected:expectedPerWeek,pct};
}
// Mini SVG chart: past doses solid, planned future dashed, current week marker
function buildTitTimelineSvg(t,status,color){
  const W=420,H=72,PAD=10;
  const totalWks=(t.cycleOn||12)+(t.cycleOff||4);
  const maxDose=(t.targetDose||t.startDose||1);
  const cur=Math.max(0,Math.min(status.weeksElapsed,totalWks));
  const xs=w=>PAD+(W-2*PAD)*(w/totalWks);
  const ys=d=>(H-PAD)-(H-2*PAD-4)*(d/maxDose);
  // Build stepped path segments week by week
  let pastD='',futD='',prevY=ys(t.startDose||0);
  for(let w=0;w<=totalWks;w++){
    const onBreak=w>=(t.cycleOn||12);
    let dose;
    if(onBreak)dose=0;
    else{
      const incr=(t.incrAmt&&t.incrWks)?Math.floor(w/t.incrWks)*t.incrAmt:0;
      dose=Math.min((t.startDose||0)+incr,t.targetDose||t.startDose||0);
    }
    const x=xs(w),y=ys(dose);
    const isPast=w<=cur;
    if(w===0){pastD='M'+x+' '+y;prevY=y;continue;}
    const seg=' L'+x+' '+prevY+' L'+x+' '+y;
    if(isPast)pastD+=seg;
    else{if(!futD)futD='M'+xs(w-1)+' '+prevY;futD+=seg;}
    prevY=y;
  }
  const curX=xs(cur),curY=ys(status.dose);
  const cycleEndX=xs(t.cycleOn||12);
  return '<svg viewBox="0 0 '+W+' '+H+'" width="100%" preserveAspectRatio="none" style="display:block;height:72px">'
    +'<line x1="'+PAD+'" y1="'+(H-PAD)+'" x2="'+(W-PAD)+'" y2="'+(H-PAD)+'" stroke="var(--color-border-tertiary)" stroke-width="1"/>'
    +'<line x1="'+cycleEndX+'" y1="'+PAD+'" x2="'+cycleEndX+'" y2="'+(H-PAD)+'" stroke="var(--color-border-tertiary)" stroke-width="1" stroke-dasharray="2,3"/>'
    +(futD?'<path d="'+futD+'" stroke="'+color+'" stroke-width="1.8" fill="none" stroke-dasharray="4,3" opacity="0.45"/>':'')
    +'<path d="'+pastD+'" stroke="'+color+'" stroke-width="2.2" fill="none"/>'
    +'<circle cx="'+curX+'" cy="'+curY+'" r="4.5" fill="'+color+'" stroke="var(--color-background-primary)" stroke-width="2"/>'
    +'</svg>';
}
function renderTitList(){
  if(!S.tit)S.tit={};
  const keys=Object.keys(S.tit);
  g('tit-empty').style.display=keys.length?'none':'block';
  g('tit-list').innerHTML=keys.map(k=>{
    const t=S.tit[k];const st=getTitStatus(t,k);
    const ref=PEPTIDE_REF.find(r=>r.n===k)||{};
    const clr=ref.catC||'#059669';
    const pctToTarget=t.targetDose>t.startDose?Math.min(100,Math.round((st.dose-t.startDose)/(t.targetDose-t.startDose)*100)):100;
    // Next-increase hint
    const nextDose=t.incrAmt?Math.min(t.startDose+((Math.floor(st.weeksElapsed/t.incrWks)+1)*t.incrAmt),t.targetDose):null;
    const nextTxt=st.nextIncrDate&&nextDose!=null?'Next: +'+t.incrAmt+' '+t.unit+' → '+nextDose+' '+t.unit+' on '+st.nextIncrDate.toLocaleDateString('en-US',{month:'short',day:'numeric'}):st.atTarget?'✓ At target dose ('+t.targetDose+' '+t.unit+')':'—';
    // Adherence this week (prefer titration's saved freq, fall back to PEPTIDE_REF)
    const invPep=(S.inv||[]).find(i=>i&&i.name===k);
    const expPerWk=freqPerWeek(t.freq||(invPep&&(invPep.doseFreq||(invPep.lastCalc&&invPep.lastCalc.freq)))||ref.freq||'Daily');
    const adh=getTitAdherence(k,expPerWk);
    const adhBadge=expPerWk>0?'<span title="Shots logged this ISO week vs expected" style="font-size:10px;background:'+(adh.pct>=80?'#D1FAE5':adh.pct>=40?'#FEF3C7':'#FEE2E2')+';color:'+(adh.pct>=80?'#065F46':adh.pct>=40?'#92400E':'#991B1B')+';padding:1px 7px;border-radius:10px;font-weight:600">'+adh.weekShots+'/'+expPerWk+' this wk</span>':'';
    const weekBadge=st.isBreak
      ?'<span style="font-size:10px;background:#FEF9C3;color:var(--accent-amber-fg);padding:1px 7px;border-radius:10px;font-weight:600">Break week '+(st.inCycle-st.cycleOn+1)+' of '+st.cycleOff+'</span>'
      :'<span style="font-size:10px;background:#DBEAFE;color:var(--accent-blue-fg);padding:1px 7px;border-radius:10px;font-weight:600">Week '+(st.inCycle+1)+' of '+st.cycleOn+'</span>';
    const logBadge=st.logBased
      ?'<span style="font-size:10px;background:#D1FAE5;color:var(--accent-green-fg);padding:1px 7px;border-radius:10px;font-weight:600" title="Progress based on actual logged shots">📊 '+st.actualDoses+' shots</span>'
      :'<span style="font-size:10px;background:#FEF3C7;color:var(--accent-amber-fg);padding:1px 7px;border-radius:10px;font-weight:600" title="No shots logged — progress estimated from calendar">⏱ Estimated</span>';
    const catLabel=ref.cat?'<span style="font-size:10px;color:var(--color-text-tertiary);font-weight:500">'+ref.cat+'</span>':'';
    const startFmt=new Date(t.startDate+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    const notesHtml=t.notes?'<div style="background:var(--color-background-secondary);border-radius:8px;padding:8px 12px;font-size:12px;color:var(--color-text-secondary);margin-top:.75rem;line-height:1.5"><strong style="color:var(--color-text-primary)">Notes:</strong> '+t.notes.replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))+'</div>':'';
    // -------- Edit form (hidden by default) --------
    // Build stable input IDs per peptide so labels can associate via for=. `k` may contain
    // punctuation (peptide names like "BPC-157"), so encodeURIComponent it for the id.
    const tid=f=>'tit-'+encodeURIComponent(k)+'-'+f;
    const edit='<div id="tit-edit-'+encodeURIComponent(k)+'" style="display:none;background:var(--color-background-secondary);border-radius:10px;padding:1rem;margin-top:.75rem">'
      +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;margin-bottom:.75rem">'
      +'<div><label for="'+tid('startDate')+'">Start date</label><input id="'+tid('startDate')+'" type="date" data-tk="'+k+'" data-tf="startDate" value="'+escA(t.startDate||'')+'"></div>'
      +'<div><label for="'+tid('startDose')+'">Starting dose ('+escH(t.unit||'')+')</label><input id="'+tid('startDose')+'" type="number" min="0" step="any" data-tk="'+k+'" data-tf="startDose" value="'+escA(String(t.startDose||''))+'"></div>'
      +'<div><label for="'+tid('targetDose')+'">Target dose ('+escH(t.unit||'')+')</label><input id="'+tid('targetDose')+'" type="number" min="0" step="any" data-tk="'+k+'" data-tf="targetDose" value="'+escA(String(t.targetDose||''))+'"></div>'
      +'<div><label for="'+tid('incrAmt')+'">Increment ('+escH(t.unit||'')+')</label><input id="'+tid('incrAmt')+'" type="number" min="0" step="any" data-tk="'+k+'" data-tf="incrAmt" value="'+escA(String(t.incrAmt||0))+'"></div>'
      +'<div><label for="'+tid('incrWks')+'">Increment every (wks)</label><input id="'+tid('incrWks')+'" type="number" min="0" step="1" data-tk="'+k+'" data-tf="incrWks" value="'+escA(String(t.incrWks||0))+'"></div>'
      +'<div><label for="'+tid('cycleOn')+'">Cycle on (wks)</label><input id="'+tid('cycleOn')+'" type="number" min="1" step="1" data-tk="'+k+'" data-tf="cycleOn" value="'+escA(String(t.cycleOn||12))+'"></div>'
      +'<div><label for="'+tid('cycleOff')+'">Cycle off (wks)</label><input id="'+tid('cycleOff')+'" type="number" min="0" step="1" data-tk="'+k+'" data-tf="cycleOff" value="'+escA(String(t.cycleOff||4))+'"></div>'
      +'<div><label for="'+tid('freq')+'">Frequency</label><select id="'+tid('freq')+'" data-tk="'+k+'" data-tf="freq">'
        +['Daily','5×/week','3×/week','2×/week','Once weekly'].map(f=>'<option value="'+f+'"'+((t.freq||ref.freq||'Daily')===f?' selected':'')+'>'+f+'</option>').join('')
      +'</select></div>'
      +'</div>'
      +'<div style="margin-bottom:.75rem"><label for="'+tid('notes')+'">Notes (side effects, observations…)</label><textarea id="'+tid('notes')+'" data-tk="'+k+'" data-tf="notes" rows="2" style="width:100%;box-sizing:border-box;padding:7px 10px;border:.5px solid var(--color-border-secondary);border-radius:8px;font-size:12px;background:var(--color-background-primary);color:var(--color-text-primary);font-family:inherit;resize:vertical">'+escH(t.notes||'')+'</textarea></div>'
      +'<div style="display:flex;gap:6px;justify-content:flex-end"><button class="btn" data-tit-cancel="'+k+'">Cancel</button><button class="btn bg" data-tit-save="'+k+'">Save changes</button></div>'
      +'</div>';
    // -------- View card --------
    return '<div style="border:.5px solid var(--color-border-tertiary);border-radius:12px;padding:1rem 1.125rem;margin-bottom:.875rem;border-left:3px solid '+clr+';background:var(--color-background-primary)">'
      // Header row
      +'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:.75rem;flex-wrap:wrap">'
        +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
          +'<span style="font-size:15px;font-weight:700;color:var(--color-text-primary)">'+k+'</span>'
          +catLabel
          +weekBadge
          +logBadge
          +adhBadge
        +'</div>'
        +'<div style="display:flex;gap:4px">'
          +(st.isBreak?'':'<button class="btn" data-tit-log="'+k+'" style="font-size:11px;padding:3px 10px;color:#fff;background:'+clr+';border-color:'+clr+'" title="Log a shot at current dose">💉 Log a shot</button>')
          +'<button class="btn" data-tit-edit="'+k+'" style="font-size:11px;padding:3px 10px">✏️ Edit</button>'
          +'<button class="btn" data-tit-del="'+k+'" style="font-size:11px;padding:3px 10px;color:var(--accent-red-fg)">Remove</button>'
        +'</div>'
      +'</div>'
      // Body
      +(st.isBreak
        ?'<div style="font-size:12px;color:var(--color-text-secondary);background:#FFFBEB;border-radius:8px;padding:.75rem .875rem;border:.5px solid #FDE68A">🔄 Rest period — receptors resensitizing. Resume in '+(st.cycleOff-(st.inCycle-st.cycleOn))+' week(s).</div>'
        :'<div style="display:grid;grid-template-columns:auto 1fr;gap:1.25rem;align-items:start">'
          // Left: current dose
          +'<div>'
            +'<div style="display:flex;align-items:baseline;gap:6px">'
              +'<span style="font-size:28px;font-weight:800;color:'+clr+';letter-spacing:-.02em">'+st.dose+'</span>'
              +'<span style="font-size:13px;font-weight:600;color:'+clr+'">'+t.unit+'</span>'
            +'</div>'
            +'<div style="font-size:10px;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.06em;font-weight:600;margin-top:2px">Current dose</div>'
            +'<div style="font-size:11px;color:var(--color-text-tertiary);margin-top:.5rem">Started '+startFmt+'</div>'
          +'</div>'
          // Right: progress + timeline
          +'<div style="min-width:0">'
            +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">'
              +'<span style="font-size:10px;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:.06em;font-weight:600">Progress to target '+t.targetDose+' '+t.unit+'</span>'
              +'<span style="font-size:11px;color:'+clr+';font-weight:700">'+pctToTarget+'%</span>'
            +'</div>'
            +'<div style="background:var(--color-background-secondary);border-radius:6px;height:7px;overflow:hidden;margin-bottom:.75rem">'
            +'<div style="height:100%;width:'+pctToTarget+'%;background:'+clr+';border-radius:6px;transition:width .3s"></div></div>'
            +'<div style="font-size:10px;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.06em;font-weight:600;margin-bottom:2px">Dose progression · '+(t.cycleOn||12)+'wk on / '+(t.cycleOff||4)+'wk off</div>'
            +buildTitTimelineSvg(t,st,clr)
            +'<div style="font-size:11px;color:var(--color-text-secondary);margin-top:.25rem">'+nextTxt+'</div>'
          +'</div>'
        +'</div>'
        +notesHtml
      )
      +edit
      +'</div>';
  }).join('');
  // Wire up action buttons
  const list=g('tit-list');
  list.querySelectorAll('[data-tit-del]').forEach(b=>b.addEventListener('click',function(){
    const k=this.dataset.titDel;
    if(confirm('Remove titration for '+k+'? This cannot be undone.')){
      delete S.tit[k];save();renderTitList();
    }
  }));
  list.querySelectorAll('[data-tit-edit]').forEach(b=>b.addEventListener('click',function(){
    const k=this.dataset.titEdit;
    const el=g('tit-edit-'+encodeURIComponent(k));
    if(el)el.style.display=el.style.display==='block'?'none':'block';
  }));
  list.querySelectorAll('[data-tit-cancel]').forEach(b=>b.addEventListener('click',function(){
    const k=this.dataset.titCancel;
    const el=g('tit-edit-'+encodeURIComponent(k));
    if(el)el.style.display='none';
  }));
  list.querySelectorAll('[data-tit-save]').forEach(b=>b.addEventListener('click',function(){
    const k=this.dataset.titSave;
    const t=S.tit[k];if(!t)return;
    const form=g('tit-edit-'+encodeURIComponent(k));
    if(!form)return;
    form.querySelectorAll('[data-tf]').forEach(inp=>{
      const f=inp.dataset.tf;
      if(f==='startDate'||f==='notes'||f==='freq')t[f]=inp.value;
      else t[f]=parseFloat(inp.value)||0;
    });
    save();renderTitList();
  }));
  list.querySelectorAll('[data-tit-log]').forEach(b=>b.addEventListener('click',function(){
    const k=this.dataset.titLog;const t=S.tit[k];if(!t)return;
    const st=getTitStatus(t,k);
    // Navigate to Shot Log
    document.querySelectorAll('#nav button, .hdr-tab-btn').forEach(x=>x.classList.remove('on'));
    document.querySelectorAll('.page').forEach(p=>p.style.display='none');
    const navBtn=document.querySelector('#nav [data-pg="log"]');
    if(navBtn)navBtn.classList.add('on');
    g('pg-log').style.display='block';
    const tb=document.querySelector('.top-bar');if(tb)tb.style.display='';
    rememberCurrentPage('log');
    renderLog({formOnly:true});
    // Pre-fill after the dropdown is populated
    setTimeout(()=>{
      clearLgSiteUserPicked();
      const sel=g('lg-pep');
      if(sel&&[...sel.options].some(o=>o.value===k))sel.value=k;
      sv('lg-dose',st.dose);
      sv('lg-dose-unit',t.unit||'mcg');
      // Trigger peptide-change to auto-calc volume, then re-apply titration dose
      if(sel){const ev=new Event('change');sel.dispatchEvent(ev);}
      sv('lg-dose',st.dose);
      sv('lg-dose-unit',t.unit||'mcg');
      // Focus the log button area
      const lgBtn=g('lg-btn');if(lgBtn)lgBtn.scrollIntoView({behavior:'smooth',block:'center'});
    },80);
  }));
}
function renderRefGrid(filter){
  try{var _cc=g('cat-count');if(_cc)_cc.textContent=PEPTIDE_REF.length;}catch(_){}
  const GROUPS={
    GROWTH:r=>/GH Secretagogue/i.test(r.cat),
    COGNITIVE:r=>/Cognit|Neuro|Mood/i.test(r.cat),
    METABOLIC:r=>/GLP|Amylin|Weight Loss|Fat Loss|Metabolic/i.test(r.cat),
    REPAIR:r=>/Healing/i.test(r.cat)
  };
  const inAnyGroup=r=>Object.values(GROUPS).some(fn=>fn(r));
  const list = (!filter||filter==='all') ? PEPTIDE_REF
    : filter==='Other' ? PEPTIDE_REF.filter(r=>!inAnyGroup(r))
    : PEPTIDE_REF.filter(GROUPS[filter]||(r=>r.cat.includes(filter)));
  g('ref-grid').innerHTML=list.map(r=>{
    const titRange=r.incrAmt?r.startD+' → '+r.targetD+' '+r.unit+' (+'+r.incrAmt+' every '+r.incrWks+'wk)':r.startD+(r.startD!==r.targetD?'–'+r.targetD:'')+' '+r.unit;
    return'<div style="border:.5px solid var(--color-border-tertiary);border-radius:10px;padding:.875rem;border-top:2px solid '+r.catC+'">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">'
      +'<span style="font-size:13px;font-weight:700;color:var(--color-text-primary)">'+r.n+'</span>'
      +'<span style="font-size:9px;padding:1px 6px;border-radius:8px;background:'+r.catC+'22;color:'+r.catC+';font-weight:600">'+r.cat+'</span>'
      +'</div>'
      +'<div style="font-size:11px;color:var(--accent-blue-fg);font-weight:600;margin-bottom:3px">'+titRange+'</div>'
      +'<div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:3px">'+r.freq+' · '+r.timing+'</div>'
      +'<div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:6px">Cycle: '+r.cycleOn+'wk on / '+r.cycleOff+'wk off</div>'
      +'<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:8px">'+r.use+'</div>'
      +'<button class="btn" data-ref-track="'+r.n+'" style="font-size:11px;padding:3px 10px;color:'+r.catC+';border-color:'+r.catC+'55;width:100%">+ Track titration</button>'
      +'</div>';
  }).join('');
  g('ref-grid').querySelectorAll('[data-ref-track]').forEach(b=>b.addEventListener('click',function(){
    const sel=g('tit-sel');sel.value=this.dataset.refTrack;
    const ref=PEPTIDE_REF.find(r=>r.n===this.dataset.refTrack);
    if(ref){sv('tit-start-d',ref.startD);sv('tit-start-u',ref.unit);}
    g('tit-date').value=td();
    g('tit-add-form').style.display='block';
    g('tit-add-form').scrollIntoView({behavior:'smooth',block:'nearest'});
  }));
}
function makeResultSyringe(units,maxUnits,mlLabel,step){
  // Horizontal SVG syringe — polished v33.375-stable-vendor-post-import-review styling.
  const isEmpty=units===0;
  const over=!isEmpty&&units>maxUnits;
  const drawUnits=Math.min(Math.max(units,0),maxUnits);
  const frac=drawUnits/maxUnits;
  const NW=56,HW=18,BW=460,RW=48,EW=30;
  const BH=46;
  const H=106;
  const W=NW+HW+BW+RW+EW;
  const CY=H/2-1;
  const BX=NW+HW;
  const BY=CY-BH/2;
  const fillW=frac*BW;
  const fillEnd=BX+fillW;
  const majorTicks=[];
  for(let u=10;u<=maxUnits;u+=10)majorTicks.push(u);
  const majorSVG=majorTicks.map(u=>{
    const tx=BX+(u/maxUnits)*BW;
    return '<line x1="'+tx+'" y1="'+BY+'" x2="'+tx+'" y2="'+(BY+8)+'" stroke="#6B6A66" stroke-width="0.8"/>'
         + '<line x1="'+tx+'" y1="'+(BY+BH-8)+'" x2="'+tx+'" y2="'+(BY+BH)+'" stroke="#6B6A66" stroke-width="0.8"/>'
         + '<text x="'+tx+'" y="'+(BY-6)+'" text-anchor="middle" font-size="10.5" fill="#4B5563" font-family="system-ui,sans-serif">'+u+'</text>';
  }).join('');
  const minorTicks=[];
  for(let u=5;u<maxUnits;u+=10)minorTicks.push(u);
  const minorSVG=minorTicks.map(u=>{
    const tx=BX+(u/maxUnits)*BW;
    return '<line x1="'+tx+'" y1="'+BY+'" x2="'+tx+'" y2="'+(BY+4)+'" stroke="#9CA3AF" stroke-width="0.55"/>'
         + '<line x1="'+tx+'" y1="'+(BY+BH-4)+'" x2="'+tx+'" y2="'+(BY+BH)+'" stroke="#9CA3AF" stroke-width="0.55"/>';
  }).join('');
  const markerFill=over?'#DC2626':'#3B82F6';
  const markerSVG=isEmpty?'':(
    '<line x1="'+fillEnd+'" y1="'+(BY-15)+'" x2="'+fillEnd+'" y2="'+(BY+BH+13)+'" stroke="'+markerFill+'" stroke-width="1.9"/>'
    +'<rect x="'+(fillEnd-36)+'" y="'+(BY+BH+12)+'" width="72" height="21" rx="10.5" fill="'+markerFill+'"/>'
    +'<text x="'+fillEnd+'" y="'+(BY+BH+26.5)+'" text-anchor="middle" font-size="11.5" font-weight="700" fill="#ffffff" font-family="system-ui,sans-serif">'+(Math.round(units*10)/10)+' units</text>'
  );
  const clipId='clip_'+maxUnits+'_'+Math.round(drawUnits*10);
  const handleX=BX+BW+RW-6;
  const rodW=Math.max(0,handleX-(BX+fillW)+2);
  const defs = ''
    +'<defs>'
    +'<linearGradient id="barrel_'+clipId+'" x1="0" y1="0" x2="0" y2="1">'
    +'<stop offset="0%" stop-color="#F9F8F2"/>'
    +'<stop offset="100%" stop-color="#F1EEE5"/>'
    +'</linearGradient>'
    +'<linearGradient id="plunger_'+clipId+'" x1="0" y1="0" x2="0" y2="1">'
    +'<stop offset="0%" stop-color="#454A50"/>'
    +'<stop offset="100%" stop-color="#262B30"/>'
    +'</linearGradient>'
    +'<linearGradient id="rod_'+clipId+'" x1="0" y1="0" x2="0" y2="1">'
    +'<stop offset="0%" stop-color="#DDD8CC"/>'
    +'<stop offset="100%" stop-color="#CFC9BC"/>'
    +'</linearGradient>'
    +'<clipPath id="'+clipId+'"><rect x="'+BX+'" y="'+BY+'" width="'+BW+'" height="'+BH+'" rx="4"/></clipPath>'
    +'</defs>';
  const flangeSVG=''
    +'<rect x="'+handleX+'" y="'+(CY-33)+'" width="13" height="66" rx="6.5" fill="url(#plunger_'+clipId+')"/>'
    +'<rect x="'+(handleX+2.1)+'" y="'+(CY-27)+'" width="2.1" height="54" rx="1.05" fill="rgba(255,255,255,.17)"/>'
    +'<rect x="'+(handleX+8.4)+'" y="'+(CY-27)+'" width="1.8" height="54" rx="0.9" fill="rgba(0,0,0,.12)"/>'
    +'<rect x="'+(handleX-5)+'" y="'+(CY-5)+'" width="6" height="10" rx="3" fill="#C6C1B4"/>';
  const svg='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:700px;display:block;margin:0 auto;overflow:visible">'
    + defs
    +'<line x1="4" y1="'+CY+'" x2="'+NW+'" y2="'+CY+'" stroke="#8A8A84" stroke-width="1.5"/>'
    +'<rect x="'+NW+'" y="'+(CY-BH*0.42)+'" width="'+HW+'" height="'+(BH*0.84)+'" rx="4" fill="#1FA07B"/>'
    +'<rect x="'+BX+'" y="'+BY+'" width="'+BW+'" height="'+BH+'" rx="4" fill="url(#barrel_'+clipId+')" stroke="#8F8C82" stroke-width="0.55"/>'
    +'<rect x="'+BX+'" y="'+BY+'" width="'+fillW+'" height="'+BH+'" clip-path="url(#'+clipId+')" fill="'+(over?'#DC2626':'#6CC7FF')+'" opacity="0.98"/>'
    +(isEmpty?'':'<rect x="'+(fillEnd-10)+'" y="'+BY+'" width="12" height="'+BH+'" clip-path="url(#'+clipId+')" fill="#2E3237"/>')
    +'<rect x="'+(BX+fillW)+'" y="'+(CY-3.8)+'" width="'+rodW+'" height="7.6" rx="3.8" fill="url(#rod_'+clipId+')"/>'
    +'<rect x="'+(BX+fillW)+'" y="'+(CY-2.2)+'" width="'+rodW+'" height="1.6" rx="0.8" fill="rgba(255,255,255,.48)"/>'
    + minorSVG
    + majorSVG
    + flangeSVG
    + markerSVG
    +'</svg>';
  const wrapHtml='<div style="padding:6px 0 2px;display:flex;flex-direction:column;align-items:center;gap:6px">'
    + svg
    + (over?'<div style="color:var(--accent-red-fg);font-size:12px;font-weight:500;margin-top:4px">Exceeds '+maxUnits+'u syringe capacity</div>':'')
    + '</div>';
  const div=document.createElement('div');
  div.innerHTML=wrapHtml;
  return div;
}

function renderCalc(){
  if(!S.tit)S.tit={};
  // Quick-fill removed
  const pp=null;

  // Generic radio-style button group
  function mkRadio(cid,items,inputId,unitId){
    const c=g(cid);if(!c)return;c.innerHTML='';
    items.forEach(item=>{
      const b=document.createElement('button');
      b.className='calc-btn';b.textContent=item.label;
      b.addEventListener('click',()=>{
        c.querySelectorAll('.calc-btn').forEach(x=>x.classList.remove('on'));
        b.classList.add('on');
        const targetInput=g(inputId);
        if(targetInput){
          targetInput.dataset.quickVal=String(item.val);
          targetInput.value='';
          targetInput.placeholder=targetInput.placeholder||'Other';
        }else{
          sv(inputId,item.val);
        }
        if(unitId)sv(unitId,item.unit||'mcg');
        doCalc();
      });
      c.appendChild(b);
    });
    const inp=g(inputId);if(inp)inp.addEventListener('input',()=>{
      delete inp.dataset.quickVal;
      c.querySelectorAll('.calc-btn').forEach(x=>x.classList.remove('on'));doCalc();
    });
  }

  // Syringe selector (radio rows with mini syringe SVG)
  const sc=g('calc-syr-btns');sc.innerHTML='';
  const SYRS_DEF=[{ml:.3,max:30,step:5,lbl:'0.3ml'},{ml:.5,max:50,step:10,lbl:'0.5ml'},{ml:1,max:100,step:20,lbl:'1.0ml'}];
  window._calcSyrList=SYRS_DEF;
  window._calcSetSyr=function(ml){
    const n=parseFloat(ml);
    const match=SYRS_DEF.find(s=>Math.abs(s.ml-n)<0.01)||SYRS_DEF[2];
    window._calcSyr=match;
    const box=g('calc-syr-btns');
    if(box){
      box.querySelectorAll('.calc-btn').forEach(b=>{
        const btnMl=parseFloat(String(b.textContent||'').replace(/[^\d.]/g,''));
        const on=Math.abs(btnMl-match.ml)<0.01;
        b.classList.toggle('on',on);
      });
    }
  };
  // Keep already-selected syringe across re-renders; otherwise default 1.0 ml.
  if(!window._calcSyr) window._calcSyr=SYRS_DEF[2];
  else {
    const keep=SYRS_DEF.find(s=>Math.abs(s.ml-window._calcSyr.ml)<0.01);
    window._calcSyr=keep||SYRS_DEF[2];
  }
  SYRS_DEF.forEach((s)=>{
    const b=document.createElement('button');
    b.className='calc-btn'+(window._calcSyr&&Math.abs(window._calcSyr.ml-s.ml)<0.01?' on':'');
    b.textContent=s.lbl;
    b.addEventListener('click',()=>{
      window._calcSetSyr(s.ml);
      doCalc();
    });
    sc.appendChild(b);
  });


  (function(){
    const vc=g('calc-vial-btns');if(!vc)return;vc.innerHTML='';
    const vialPresets=[5,10,20,30,50,60,100,1000];
    window._calcSetVialMg=function(mg){
      const n=parseFloat(mg);
      if(isNaN(n)||n<=0)return;
      const inp=g('calc-vial');
      const isPreset=vialPresets.some(p=>Math.abs(p-n)<0.0001);
      if(inp){
        if(isPreset){inp.dataset.quickVal=String(n);inp.value='';inp.placeholder=inp.placeholder||'Other (mg)';}
        else{delete inp.dataset.quickVal;sv('calc-vial',n);}
      }else{
        sv('calc-vial',n);
      }
      const box=g('calc-vial-btns');
      if(box){
        box.querySelectorAll('.calc-btn').forEach(b=>{
          b.classList.remove('on');
          const btnVal=parseFloat(b.textContent);
          if(!isNaN(btnVal)&&Math.abs(btnVal-n)<0.0001)b.classList.add('on');
        });
      }
    };
    const vialItems=[{label:'5mg',val:5},{label:'10mg',val:10},{label:'20mg',val:20},{label:'30mg',val:30},{label:'50mg',val:50},{label:'60mg',val:60},{label:'100mg',val:100},{label:'1000mg',val:1000}];
    vialItems.forEach((item,i)=>{
      if(i===4||i===6){const br=document.createElement('span');br.className='calc-line-break';br.setAttribute('aria-hidden','true');vc.appendChild(br);}
      const b=document.createElement('button');b.className='calc-btn';b.textContent=item.label;
      b.addEventListener('click',()=>{
        window._calcSetVialMg(item.val);
        doCalc();
      });
      vc.appendChild(b);
    });
    // Keep already-selected vial across re-renders; otherwise default 10 mg.
    const existingVial=parseFloat((typeof calcRead==='function'?calcRead('calc-vial'):gv('calc-vial')));
    window._calcSetVialMg((existingVial>0)?existingVial:10);
    const inp=g('calc-vial');if(inp)inp.addEventListener('input',()=>{delete inp.dataset.quickVal;vc.querySelectorAll('.calc-btn').forEach(x=>x.classList.remove('on'));doCalc();});
  })();
  (function(){
    const bc=g('calc-bac-btns');if(!bc)return;bc.innerHTML='';
    if(!window._calcDiluent)window._calcDiluent='bac';
    const syncDiluentUi=()=>{
      const dil=window._calcDiluent==='saline'?'saline':'bac';
      window._calcDiluent=dil;
      const title=g('calc-diluent-title');
      if(title)title.textContent=dil==='saline'?'Saline water':'Bacteriostatic water';
      const wrap=g('calc-diluent-btns');
      if(wrap){
        wrap.querySelectorAll('[data-diluent]').forEach(btn=>{
          btn.classList.toggle('on', btn.getAttribute('data-diluent')===dil);
        });
      }
      const step=g('calc-bac')&&g('calc-bac').closest('.gpt141-bac');
      if(step)step.dataset.diluent=dil;
    };
    const dilWrap=g('calc-diluent-btns');
    if(dilWrap&&!dilWrap._wired){
      dilWrap.addEventListener('click',e=>{
        const btn=e.target&&e.target.closest&&e.target.closest('[data-diluent]');
        if(!btn)return;
        e.preventDefault();
        window._calcDiluent=btn.getAttribute('data-diluent')==='saline'?'saline':'bac';
        syncDiluentUi();
        doCalc();
      });
      dilWrap._wired=true;
    }
    syncDiluentUi();
    window._calcSyncDiluentUi=syncDiluentUi;
    // Default diluent volume is 2 mL unless a peptide's remembered lastCalc overrides it.
    window._calcSetBacMl=function(ml){
      const n=parseFloat(ml);
      if(isNaN(n)||n<=0)return;
      const inp=g('calc-bac');
      const presets=[1,2,3,5];
      const isPreset=presets.some(p=>Math.abs(p-n)<0.0001);
      if(inp){
        if(isPreset){inp.dataset.quickVal=String(n);inp.value='';}
        else{delete inp.dataset.quickVal;sv('calc-bac',n);}
      }else{
        sv('calc-bac',n);
      }
      const box=g('calc-bac-btns');
      if(box){
        box.querySelectorAll('.calc-btn').forEach(b=>{
          b.classList.remove('on');
          const btnVal=parseFloat(b.textContent);
          if(!isNaN(btnVal)&&Math.abs(btnVal-n)<0.0001)b.classList.add('on');
        });
      }
    };
    const bacItems=[{label:'1ml',val:1},{label:'2ml',val:2},{label:'3ml',val:3},{label:'5ml',val:5}];
    bacItems.forEach((item,i)=>{
      if(i===3){const br=document.createElement('span');br.className='calc-line-break';br.setAttribute('aria-hidden','true');bc.appendChild(br);}
      const b=document.createElement('button');b.className='calc-btn';b.textContent=item.label;
      b.addEventListener('click',()=>{
        window._calcSetBacMl(item.val);
        doCalc();
      });
      bc.appendChild(b);
    });
    // Keep any already-selected bac (e.g. during syringe re-render + lastCalc restore); otherwise default 2 mL.
    const existingBac=parseFloat((typeof calcRead==='function'?calcRead('calc-bac'):gv('calc-bac')));
    window._calcSetBacMl((existingBac>0)?existingBac:2);
    const inp=g('calc-bac');if(inp)inp.addEventListener('input',()=>{delete inp.dataset.quickVal;bc.querySelectorAll('.calc-btn').forEach(x=>x.classList.remove('on'));doCalc();});
  })();
  (function(){
    const dc=g('calc-dose-btns');if(!dc)return;dc.innerHTML='';
    const doseItems=[
      {label:'250mcg',val:250,unit:'mcg'},{label:'500mcg',val:500,unit:'mcg'},
      {label:'1mg',val:1,unit:'mg'},{label:'1.5mg',val:1.5,unit:'mg'},{label:'2mg',val:2,unit:'mg'},
      {label:'2.5mg',val:2.5,unit:'mg'},{label:'3mg',val:3,unit:'mg'},{label:'5mg',val:5,unit:'mg'}
    ];
    window._calcSetDose=function(dose,unit){
      const n=parseFloat(dose);
      if(isNaN(n)||n<=0)return;
      const u=(unit||'mcg');
      sv('calc-dose-unit',u);
      const match=doseItems.find(it=>it.unit===u&&Math.abs(it.val-n)<0.0001);
      const inp=g('calc-dose');
      if(inp){
        if(match){inp.dataset.quickVal=String(n);inp.value='';}
        else{delete inp.dataset.quickVal;sv('calc-dose',n);}
      }else{
        sv('calc-dose',n);
      }
      const box=g('calc-dose-btns');
      if(box){
        const target=match?match.label:(n+''+u);
        box.querySelectorAll('.calc-btn').forEach(b=>{
          b.classList.toggle('on', b.textContent===target);
        });
      }
    };
    doseItems.forEach((item,i)=>{
      if(i===5){const br=document.createElement('span');br.className='calc-line-break';br.setAttribute('aria-hidden','true');dc.appendChild(br);}
      const b=document.createElement('button');b.className='calc-btn';b.textContent=item.label;
      b.addEventListener('click',()=>{
        window._calcSetDose(item.val,item.unit||'mcg');
        doCalc();
      });
      dc.appendChild(b);
    });
    const inp=g('calc-dose');if(inp)inp.addEventListener('input',()=>{delete inp.dataset.quickVal;dc.querySelectorAll('.calc-btn').forEach(x=>x.classList.remove('on'));doCalc();});
    g('calc-dose-unit')&&g('calc-dose-unit').addEventListener('change',doCalc);
  })();
  g('calc-dose-unit')&&g('calc-dose-unit').addEventListener('change',doCalc);

  // Frequency pills — more scannable than a dropdown.
  // Order: dailies (low→high), then weeklies (low→high). The "+ Custom"
  // button at the end lets people add a frequency that isn't in the list
  // (e.g. every-other-day schedules, 4x/week etc.).
  const FREQS=[
    {label:'Once daily',val:'1'},
    {label:'Twice daily',val:'2'},
    {label:'1×/week',val:'0.1429'},
    {label:'2×/week',val:'0.2857'},
    {label:'3×/week',val:'0.4286'},
    {label:'5×/week',val:'0.7143'}
  ];
  window._calcFreqItems=FREQS;
  window._calcSetFreq=function(val){
    const v=(val==null||String(val).trim()==='')?'1':String(val);
    sv('calc-freq',v);
    const box=g('calc-freq-btns');
    if(!box)return;
    let matched=false;
    box.querySelectorAll('.calc-btn[data-val]').forEach(b=>{
      const on=String(b.dataset.val)===v;
      b.classList.toggle('on',on);
      if(on)matched=true;
      b.style.color=on?'#fff':'#4B5563';
    });
    // Ensure a custom frequency still has a visible selected pill
    if(!matched){
      const n=parseFloat(v);
      if(Number.isFinite(n)&&n>0){
        const perWeek=Math.round(n*7*100)/100;
        const label=(Number.isInteger(perWeek)?perWeek:perWeek)+'×/week';
        let pill=[...box.querySelectorAll('.calc-btn[data-val]')].find(b=>b.dataset.val===v);
        if(!pill){
          const addBtn=[...box.querySelectorAll('.calc-btn')].find(b=>/custom/i.test(b.textContent||''));
          pill=document.createElement('button');
          pill.className='calc-btn';
          pill.textContent=label;
          pill.dataset.val=v;
          pill.addEventListener('click',()=>{ window._calcSetFreq(v); doCalc(); });
          if(addBtn)box.insertBefore(pill,addBtn); else box.appendChild(pill);
        }
        pill.classList.add('on');
        pill.style.color='#fff';
      }
    }
  };
  const fc=g('calc-freq-btns');
  if(fc){
    fc.innerHTML='';
    const makePill=(label,val,selected)=>{
      const b=document.createElement('button');
      b.className='calc-btn'+(selected?' on':'');
      b.textContent=label;
      b.dataset.val=val;
      b.addEventListener('click',()=>{
        window._calcSetFreq(val);
        doCalc();
      });
      return b;
    };
    FREQS.forEach((item,idx)=>{ if(idx===3){ const br=document.createElement('span'); br.className='calc-line-break'; br.setAttribute('aria-hidden','true'); fc.appendChild(br); } fc.appendChild(makePill(item.label,item.val,false)); });
    // "+ Custom" button: prompts for doses/week and adds a new pill. If the
    // user re-enters a value that already has a pill, we just select that
    // one instead of duplicating it.
    const addBtn=document.createElement('button');
    addBtn.className='calc-btn';
    addBtn.textContent='+ Custom';
    addBtn.title='Add a custom frequency';
    addBtn.addEventListener('click',()=>{
      const input=prompt('How many doses per week?\n(e.g. 3 for 3×/week, 4 for 4×/week, 0.5 for once every 2 weeks)');
      if(input===null)return;
      const n=parseFloat(input);
      if(!Number.isFinite(n)||n<=0||n>21){alert('Please enter a number between 0 and 21.');return;}
      const val=(n/7).toFixed(4);
      const label=(Number.isInteger(n)?n:(+n.toFixed(2)))+'×/week';
      const existing=[...fc.querySelectorAll('.calc-btn[data-val]')].find(b=>b.dataset.val===val);
      if(existing){window._calcSetFreq(val);doCalc();return;}
      const pill=makePill(label,val,false);
      fc.insertBefore(pill,addBtn);
      window._calcSetFreq(val);
      doCalc();
    });
    fc.appendChild(addBtn);
    // Keep remembered/selected freq across re-renders; otherwise default Once daily.
    const existingFreq=gv('calc-freq');
    window._calcSetFreq((existingFreq!=null&&String(existingFreq).trim()!=='')?existingFreq:'1');
  }

  // Load-from-inventory picker: always reflects the current S.inv list.
  // CALC-HANDOFF-BLEND-RESTRICTION-R1: blends (e.g. KL80) are loadable in lyo calc.
  function calcHandoffNorm(s){
    return String(s||'').toLowerCase().replace(/[\s_\-/\\.]/g,'');
  }
  function calcOilModeActive(){
    const oilSection=g('calc-oil-section');
    return !!(oilSection&&oilSection.style.display!=='none')||(window._calcLast&&window._calcLast.mode==='oil');
  }
  function calcHandoffOilEligible(p){
    if(!p||!p.name||p.isSupply||p.archived) return false;
    if(p.isPeptide!==false) return true;
    if(typeof window.calcLooksLikeOil!=='function') return false;
    return !!(window.calcLooksLikeOil(p.name)||window.calcLooksLikeOil(p.cat||''));
  }
  function calcHandoffInvEligible(p){
    return calcHandoffOilEligible(p);
  }
  function calcHandoffPepInLogDropdown(name){
    const pep=(S.inv||[]).find(p=>p.name===name&&!p.isSupply);
    return !!(pep&&calcHandoffOilEligible(pep));
  }
  function calcHandoffOilCandidates(esterRaw,conc){
    const erNorm=calcHandoffNorm(esterRaw);
    const esterKey=typeof window.calcLooksLikeOil==='function'?window.calcLooksLikeOil(esterRaw):null;
    return (S.inv||[]).filter(p=>{
      if(!calcHandoffOilEligible(p)) return false;
      const nl=calcHandoffNorm(p.name);
      if(esterKey&&typeof window.calcLooksLikeOil==='function'){
        const pOil=window.calcLooksLikeOil(p.name)||window.calcLooksLikeOil(p.cat||'');
        if(pOil===esterKey) return true;
      }
      if(erNorm&&(nl.includes(erNorm)||erNorm.includes(nl))) return true;
      if(conc>0&&nl.includes(String(Math.round(conc)))) return true;
      return false;
    });
  }
  function calcHandoffPickOilCandidate(candidates,esterRaw,conc){
    if(candidates.length===1) return candidates[0];
    if(!candidates.length) return null;
    const erNorm=calcHandoffNorm(esterRaw);
    if(erNorm){
      const byName=candidates.filter(p=>{
        const nl=calcHandoffNorm(p.name);
        return nl.includes(erNorm)||erNorm.includes(nl);
      });
      if(byName.length===1) return byName[0];
    }
    if(conc>0){
      const concStr=String(Math.round(conc));
      const byConc=candidates.filter(p=>calcHandoffNorm(p.name).includes(concStr));
      if(byConc.length===1) return byConc[0];
    }
    return null;
  }
  function resolveCalcHandoffPeptide(){
    const calcVial=parseFloat(calcRead('calc-vial'));
    const calcBac=parseFloat(calcRead('calc-bac'));
    const loadedId=window._calcLoadedPepId;
    const last=window._calcLast;
    if(loadedId){
      const cand=(S.inv||[]).find(p=>p.id===loadedId&&calcHandoffOilEligible(p));
      if(cand){
        if(calcOilModeActive()||(last&&last.mode==='oil')){
          return { pep:cand, reason:'loaded-oil' };
        }
        if(cand.isBlend||(!last||!last.over)){
          return { pep:cand, reason:'loaded' };
        }
      }
    }
    if(last&&last.mode==='oil'){
      const esterRaw=String((g('calc-oil-ester')&&gv('calc-oil-ester'))||'').trim();
      const conc=parseFloat(gv('calc-oil-conc'))||0;
      const candidates=calcHandoffOilCandidates(esterRaw,conc);
      const picked=calcHandoffPickOilCandidate(candidates,esterRaw,conc);
      if(picked) return { pep:picked, reason:'oil-match' };
      if(candidates.length>1) return { pep:null, reason:'ambiguous', count:candidates.length };
    }
    if(!(calcVial>0&&calcBac>0)) return { pep:null, reason:'noCalc' };
    const matches=(S.inv||[]).filter(p=>calcHandoffInvEligible(p)&&p.vialMg&&p.reconBacMl
      &&Math.abs(+p.vialMg-calcVial)<0.01&&Math.abs(+p.reconBacMl-calcBac)<0.01);
    if(matches.length===1) return { pep:matches[0], reason:'match' };
    if(matches.length===0) return { pep:null, reason:'none' };
    return { pep:null, reason:'ambiguous', count:matches.length };
  }
  window.resolveCalcHandoffPeptide=resolveCalcHandoffPeptide;
  function _calcRememberLast(){
    try {
      if(!window._calcLoadedPepId) return;
      var pep = (S.inv||[]).find(function(p){ return p.id === window._calcLoadedPepId; });
      if(!pep) return;
      var dose = parseFloat(calcRead('calc-dose')) || 0;
      var doseUnit = gv('calc-dose-unit') || 'mcg';
      var freq = gv('calc-freq') || '1';
      pep.lastCalc = {
        syrMl: window._calcSyr ? window._calcSyr.ml : 1,
        vialMg: parseFloat(calcRead('calc-vial')) || 0,
        bacMl:  parseFloat(calcRead('calc-bac')) || 0,
        diluent: window._calcDiluent === 'saline' ? 'saline' : 'bac',
        dose:   dose,
        doseUnit: doseUnit,
        freq:   freq
      };
      // Keep inventory typical dose + frequency in sync for charts/tables/reload.
      if(dose > 0){
        pep.dose = dose;
        pep.doseUnit = doseUnit;
      }
      pep.doseFreq = freq;
      if(typeof save === 'function') save();
    } catch(_){}
  }
  window._calcRememberLast = _calcRememberLast;
  // CALC-MEM-R2: debounced remember — called from the END of doCalc so preset
  // buttons, syringe picks, and quick-vals are captured too (field listeners
  // alone missed anything that didn't fire input/change on the raw inputs).
  window._calcRememberLastDebounced = function(){
    clearTimeout(window._calcRemT);
    window._calcRemT = setTimeout(function(){ try{ window._calcRememberLast(); }catch(_){} }, 350);
  };
  function _calcRestoreLast(pep){
    if(!pep || !pep.lastCalc) return false;
    var lc = pep.lastCalc;
    try {
      if(lc.vialMg && +lc.vialMg > 0){
        if(typeof window._calcSetVialMg === 'function') window._calcSetVialMg(lc.vialMg);
        else sv('calc-vial', lc.vialMg);
      }
      if(lc.bacMl && +lc.bacMl > 0){
        if(typeof window._calcSetBacMl === 'function') window._calcSetBacMl(lc.bacMl);
        else sv('calc-bac', lc.bacMl);
      }
      if(lc.diluent === 'saline' || lc.diluent === 'bac'){
        window._calcDiluent = lc.diluent;
        if(typeof window._calcSyncDiluentUi === 'function') window._calcSyncDiluentUi();
        else {
          const title=g('calc-diluent-title');
          if(title)title.textContent=lc.diluent==='saline'?'Saline water':'Bacteriostatic water';
          const wrap=g('calc-diluent-btns');
          if(wrap){
            wrap.querySelectorAll('[data-diluent]').forEach(btn=>{
              btn.classList.toggle('on', btn.getAttribute('data-diluent')===lc.diluent);
            });
          }
          const step=g('calc-bac')&&g('calc-bac').closest('.gpt141-bac');
          if(step)step.dataset.diluent=lc.diluent;
        }
      }
      if(lc.dose && +lc.dose > 0){
        if(typeof window._calcSetDose === 'function') window._calcSetDose(lc.dose, lc.doseUnit || 'mcg');
        else { sv('calc-dose', lc.dose); if(lc.doseUnit) sv('calc-dose-unit', lc.doseUnit); }
      }
      if(lc.freq!=null && String(lc.freq).trim()!==''){
        if(typeof window._calcSetFreq === 'function') window._calcSetFreq(lc.freq);
        else sv('calc-freq', lc.freq);
      }
      if(lc.syrMl && +lc.syrMl > 0){
        if(typeof window._calcSetSyr === 'function') window._calcSetSyr(lc.syrMl);
        else {
          var SYRS = [{ml:.3,max:30,step:5,lbl:'0.3ml'},{ml:.5,max:50,step:10,lbl:'0.5ml'},{ml:1,max:100,step:20,lbl:'1.0ml'}];
          var match = SYRS.find(function(s){ return Math.abs(s.ml - lc.syrMl) < 0.01; });
          if(match) window._calcSyr = match;
        }
      }
      return true;
    } catch(_){}
    return false;
  }
  window._calcRestoreLast = _calcRestoreLast;
  /* v33.375-stable-vendor-post-import-review: remember last calc inputs per peptide whenever they change */
  (function(){
    var ids = ['calc-dose','calc-dose-unit','calc-vial','calc-bac','calc-freq'];
    ids.forEach(function(id){
      var el = document.getElementById(id);
      if(!el) return;
      var fire = function(){ try { window._calcRememberLast && window._calcRememberLast(); } catch(_){} };
      el.addEventListener('change', fire);
      el.addEventListener('input', fire);
    });
  })();
  
  // Selecting a peptide fills vial mg, BAC water, and dose from that peptide's saved values.
  const invSel=g('calc-from-inv');
  if(invSel){
    const prevVal=invSel.value;
    invSel.innerHTML='<option value="" style="color:#1a1a18;background:#fff">📋 Load from inventory…</option>';
    const peps=[...(S.inv||[])].filter(p=>p.name&&!p.isSupply&&!p.archived).sort((a,b)=>a.name.localeCompare(b.name));
    peps.forEach(p=>{
      const opt=document.createElement('option');
      opt.value=p.id;
      opt.style.color='#1a1a18';
      opt.style.background='#fff';
      // Stock location tags — show where this peptide physically is.
      // 🧊 Freezer · ❄️ Fridge · 📦 Desk — only include locations with >0 vials.
      const locBits=[];
      if(p.fz>0)locBits.push('🧊'+p.fz);
      if(p.fr>0)locBits.push('❄️'+p.fr);
      if(p.dk>0)locBits.push('📦'+p.dk);
      const locTag=locBits.length?' ['+locBits.join(' ')+']':' [no stock]';
      const bits=[];
      if(p.vialMg)bits.push(fmtVialMgSuffix(p.vialMg,p.vialMgDisplayUnit)+' per unit');
      if(p.reconBacMl)bits.push(p.reconBacMl+'mL BAC');
      if(p.dose)bits.push(p.dose+(p.doseUnit||'mcg'));
      const blendTag=p.isBlend?' [blend]':'';
      opt.textContent=p.name+blendTag+locTag+(bits.length?' · '+bits.join(' · '):'');
      invSel.appendChild(opt);
    });
    invSel.value='';
    if(!invSel._wired){
      invSel.addEventListener('change',()=>{
        const id=parseInt(invSel.value);
        if(!id){return;}
        const pep=(S.inv||[]).find(p=>p.id===id);
        if(!pep){invSel.value='';return;}
        // Remember which peptide is currently loaded so doCalc() can decrement stock live
        window._calcLoadedPepId=id;
        // Auto-detect oil/ester mode from the peptide's name or catalog field.
        if(typeof window.calcLooksLikeOil==='function'){
          const oilHit=window.calcLooksLikeOil(pep.name)||window.calcLooksLikeOil(pep.cat);
          if(oilHit && typeof window.setCalcMode==='function'){
            // CALC-MEM-R2: suppress per-peptide remembering during the load
            // sequence — the ester/dose events below fire doOilCalc with STALE
            // on-screen values, which would overwrite this peptide's saved
            // memory before _calcRestoreLastOil can read it.
            window._calcOilLoading=true;
            window.setCalcMode('oil');
            const eEl=document.getElementById('calc-oil-ester');
            if(eEl){
              // Prefer inventory name when it is an oil SKU (e.g. tcyp200) so handoff can match.
              eEl.value=window.calcLooksLikeOil(pep.name)?pep.name:oilHit.replace(/\b\w/g,c=>c.toUpperCase());
              eEl.dispatchEvent(new Event('change'));
            }
            if(pep.dose && (pep.doseUnit==='mg'||!pep.doseUnit)){
              const wEl=document.getElementById('calc-oil-week');
              if(wEl){wEl.value = pep.dose; wEl.dispatchEvent(new Event('input'));}
            }
            // CALC-MEM-R2: overlay this oil SKU's own saved inputs (conc, dose,
            // vial size, syringe, schedule) so TCyp 200 / 250 / old don't share
            // one global memory blob.
            try{ if(typeof window._calcRestoreLastOil==='function') window._calcRestoreLastOil(pep); }catch(_){}
            window._calcOilLoading=false;
            return;
          }
        }
        window._calcSuppressLoadedPepIdClear=true;
        // Fill inputs from saved peptide (blends use the same dose fields).
        // Vial default is always 10 mg unless this peptide has a remembered lastCalc.vialMg.
        // BAC default is always 2 mL unless this peptide has a remembered lastCalc.bacMl.
        if(typeof window._calcSetVialMg==='function') window._calcSetVialMg(10);
        else sv('calc-vial',10);
        if(typeof window._calcSetBacMl==='function') window._calcSetBacMl(2);
        else sv('calc-bac',2);
        window._calcDiluent='bac';
        if(typeof window._calcSyncDiluentUi==='function') window._calcSyncDiluentUi();
        if(typeof window._calcSetFreq==='function') window._calcSetFreq('1');
        else sv('calc-freq','1');
        if(typeof window._calcSetSyr==='function') window._calcSetSyr(1);
        else window._calcSyr={ml:1,max:100,step:20,lbl:'1.0ml'};
        // Prefer remembered calc dose → inventory typical dose
        if(pep.lastCalc && pep.lastCalc.dose > 0){
          if(typeof window._calcSetDose==='function') window._calcSetDose(pep.lastCalc.dose, pep.lastCalc.doseUnit||'mcg');
          else { sv('calc-dose',pep.lastCalc.dose); sv('calc-dose-unit',pep.lastCalc.doseUnit||'mcg'); }
        } else if(pep.dose!=null&&pep.dose>0){
          if(typeof window._calcSetDose==='function') window._calcSetDose(pep.dose, pep.doseUnit||'mcg');
          else { sv('calc-dose',pep.dose); sv('calc-dose-unit',pep.doseUnit||'mcg'); }
        }
        // Prefer remembered frequency before full restore
        if(pep.lastCalc && pep.lastCalc.freq!=null && String(pep.lastCalc.freq).trim()!==''){
          if(typeof window._calcSetFreq==='function') window._calcSetFreq(pep.lastCalc.freq);
          else sv('calc-freq', pep.lastCalc.freq);
        } else if(pep.doseFreq!=null && String(pep.doseFreq).trim()!==''){
          if(typeof window._calcSetFreq==='function') window._calcSetFreq(pep.doseFreq);
          else sv('calc-freq', pep.doseFreq);
        }
        // Overlay remembered vial/bac/diluent/freq/dose
        try { _calcRestoreLast(pep); } catch(_){}
        // Ensure vial + bac + freq always land on usable values (remembered or defaults)
        const vialNow=parseFloat(calcRead('calc-vial'));
        if(!(vialNow>0) && typeof window._calcSetVialMg==='function') window._calcSetVialMg(10);
        const bacNow=parseFloat(calcRead('calc-bac'));
        if(!(bacNow>0) && typeof window._calcSetBacMl==='function') window._calcSetBacMl(2);
        const freqNow=gv('calc-freq');
        if(!(freqNow!=null && String(freqNow).trim()!=='') && typeof window._calcSetFreq==='function') window._calcSetFreq('1');
        doCalc();
        window._calcSuppressLoadedPepIdClear=false;
        // Reset so user can pick again
        setTimeout(()=>{invSel.value='';},50);
      });
      invSel._wired=true;
    }
  }

  // "Log this shot" / "Log injection" deep-link: calc → shot log, pre-filled with dose/volume
  function refreshCalcBeforeHandoff(){
    const oilSection=g('calc-oil-section');
    const oilVisible=oilSection&&oilSection.style.display!=='none';
    if(oilVisible||(window._calcLast&&window._calcLast.mode==='oil')){
      try{ if(typeof window.doOilCalc==='function') window.doOilCalc(); }catch(_){}
    }else{
      try{ doCalc(); }catch(_){}
    }
  }
  function resolveCalcHandoffPep(last){
    return resolveCalcHandoffPeptide().pep;
  }
  function handleCalcToLogClick(){
    refreshCalcBeforeHandoff();
    const last=window._calcLast;
    if(!last||last.over) return;
    const resolved=resolveCalcHandoffPeptide();
    if(resolved.reason==='ambiguous'){
      try{window.tmpInventoryToast('Multiple peptides ('+resolved.count+') match this vial/BAC — use Load from inventory to pick one','amber',5000);}catch(_){}
      return;
    }
    if(!resolved.pep){
      try{window.tmpInventoryToast('Pick a peptide in Calculator (Load from inventory) or match one vial/BAC in inventory','amber',5000);}catch(_){}
      return;
    }
    if(!calcHandoffPepInLogDropdown(resolved.pep.name)){
      try{window.tmpInventoryToast('Selected peptide is not available in Shot Log','amber',5000);}catch(_){}
      return;
    }
    // Drop sticky calendar focus so renderLog / applyFocusDateToForms cannot
    // stamp an earlier tapped day (Wed) onto this "log now" handoff.
    window._tmpFocusDate=null;
    try{localStorage.removeItem('tmp.focusDate');}catch(_){}
    try{document.querySelectorAll('.shdc-focused').forEach(el=>el.classList.remove('shdc-focused'));}catch(_){}
    document.querySelectorAll('#nav button, .hdr-tab-btn').forEach(x=>x.classList.remove('on'));
    document.querySelectorAll('.page').forEach(p=>p.style.display='none');
    const navBtn=document.querySelector('#nav [data-pg="log"]');
    if(navBtn) navBtn.classList.add('on');
    g('pg-log').style.display='block';
    const tb=document.querySelector('.top-bar');if(tb)tb.style.display='';
    rememberCurrentPage('log');
    renderLog({formOnly:true});
    function tryPrefillCalcToLog(attempt){
      attempt = attempt || 0;
      const freshLast = window._calcLast;
      if((!freshLast || freshLast.over) && attempt < 5){
        setTimeout(()=>tryPrefillCalcToLog(attempt+1),50);
        return;
      }
      if(!freshLast || freshLast.over) return;
      if(applyCalcLastToShotLogForm(resolved,freshLast)){
        const lgBtn=g('lg-btn');
        if(lgBtn) lgBtn.scrollIntoView({block:'nearest'});
        return;
      }
      if(attempt < 5) setTimeout(()=>tryPrefillCalcToLog(attempt+1),50);
    }
    tryPrefillCalcToLog(0);
  }
  window.handleCalcToLogClick=handleCalcToLogClick;
  const toLogBtn=g('calc-to-log-btn');
  if(toLogBtn&&!toLogBtn._wired){
    toLogBtn.addEventListener('click',handleCalcToLogClick);
    toLogBtn._wired=true;
  }
  const oilToLogBtn=g('calc-oil-to-log-btn');
  if(oilToLogBtn&&!oilToLogBtn._wired){
    oilToLogBtn.addEventListener('click',handleCalcToLogClick);
    oilToLogBtn._wired=true;
  }

  doCalc();
}

function calcRead(id){
  const el=g(id);
  if(el && el.dataset && el.dataset.quickVal!=null && String(el.dataset.quickVal).trim()!=='') return el.dataset.quickVal;
  return gv(id);
}

function doCalc(){
  const doseRaw=parseFloat(calcRead('calc-dose'));
  const doseUnit=gv('calc-dose-unit');
  const vialMg=parseFloat(calcRead('calc-vial'));
  const bacMl=parseFloat(calcRead('calc-bac'));
  const freqRaw=gv('calc-freq');
  // Empty freq defaults to 1 (once per period); non-numeric or zero disables the run-out math.
  const freq=freqRaw===''?1:parseFloat(freqRaw);
  const syr=window._calcSyr||{ml:1,max:100,step:20};
  const hasVals=!isNaN(doseRaw)&&!isNaN(vialMg)&&!isNaN(bacMl)&&doseRaw>0&&vialMg>0&&bacMl>0&&!isNaN(freq)&&freq>0;
  const clr=id=>{const el=g(id);if(el)el.textContent='\u2014';};
  const toLogWrap=g('calc-to-log-wrap');
  if(!hasVals){
    g('calc-result-headline').textContent='Fill in the fields above to see your result.';
    g('calc-result-syringe').innerHTML='';
    g('calc-result-syringe').appendChild(makeResultSyringe(0,syr.max,syr.ml+'mL',syr.step));
    ['calc-conc','calc-total-pep','calc-doses','calc-days','calc-runout'].forEach(clr);
    const th=g('calc-result-tickhint');if(th)th.style.display='none';
    renderCalcStockPanel(null,null,null);
    if(toLogWrap)toLogWrap.style.display='none';
    return;
  }
  const doseMcg=(doseUnit==='mg'||doseUnit==='iu')?doseRaw*1000:doseRaw;
  const concMcgPerMl=(vialMg*1000)/bacMl;
  const volMl=doseMcg/concMcgPerMl;
  const u100=volMl*100;
  const dosesPerVial=Math.floor((vialMg*1000)/doseMcg);
  const daysSupply=dosesPerVial/freq;
  const runoutDate=new Date(Date.now()+daysSupply*864e5);
  const doseLabel=doseUnit==='iu'?doseRaw+'iu':doseUnit==='mg'?doseRaw+'mg':doseMcg>=1000?(doseMcg/1000)+'mg':doseMcg+'mcg';
  const units=Math.round(u100*10)/10;
  const over=u100>syr.max;
  g('calc-result-headline').innerHTML='For a dose of <b>'+doseLabel+'</b>, pull the syringe to <b style="color:var(--accent-red-fg)">'+units+' units</b>'+(over?' <span style="color:var(--accent-red-fg);font-size:13px">(exceeds '+syr.max+'u syringe!)</span>':'')+(over?'':' <span style="font-size:13px;color:var(--color-text-secondary)">('+volMl.toFixed(3)+'mL)</span>')+'.';
  // Tick-count hint — helps users who get confused counting gradations on the
  // syringe barrel. Standard U-100 insulin syringes are 1u/tick on 0.3mL and
  // 0.5mL sizes, and 2u/tick on 1.0mL sizes. The "≈" acknowledges that some
  // off-brand syringes vary; it's a hint, not a guarantee.
  const tickHint=g('calc-result-tickhint');
  if(tickHint){
    if(over){tickHint.style.display='none';}
    else{
      const unitsPerTick=syr.ml>=1?2:1;
      const ticks=units/unitsPerTick;
      const ticksDisplay=unitsPerTick===1?units:(ticks<10?Math.round(ticks*10)/10:Math.round(ticks));
      tickHint.innerHTML='&#8776; <b>'+ticksDisplay+' tick mark'+(ticksDisplay===1?'':'s')+'</b> on the '+syr.ml+'mL syringe <span style="opacity:.75">(each tick = '+unitsPerTick+'u on a standard U-100 insulin syringe)</span>';
      tickHint.style.display='';
    }
  }
  const rs=g('calc-result-syringe');rs.innerHTML='';
  rs.appendChild(makeResultSyringe(u100,syr.max,syr.ml+'mL',syr.step));
  g('calc-conc').textContent=doseUnit==='iu'?((vialMg/bacMl).toFixed(1).replace(/\.0$/,'')+' iu/mL'):concMcgPerMl>=1000?(concMcgPerMl/1000).toFixed(2)+' mg/mL':concMcgPerMl.toFixed(0)+' mcg/mL';
  const pepLab=(S.inv||[]).find(p=>p.id===window._calcLoadedPepId);
  let vialLine=fmtVialMgSuffix(vialMg,pepLab&&pepLab.vialMgDisplayUnit)||(vialMg+'mg');
  if(doseUnit==='iu'){const f=tmpIuPerMgFor(pepLab);vialLine=vialMg+'iu'+(f>0?' (\u2248'+(vialMg/f).toFixed(vialMg/f<10?1:0)+'mg)':'');}
  g('calc-total-pep').textContent=vialLine+' / '+bacMl+'mL '+((window._calcDiluent==='saline')?'saline':'BAC');
  g('calc-doses').textContent=dosesPerVial+' doses';
  g('calc-days').textContent=Math.round(daysSupply)+' days';
  g('calc-runout').textContent=runoutDate.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  renderCalcStockPanel(dosesPerVial,daysSupply,freq);
  // Show "Log this shot" button (hide when exceeds syringe, since that's an invalid result)
  if(toLogWrap){
    toLogWrap.style.display=over?'none':'block';
    window._calcLast={dose:doseRaw,doseUnit,volMl:volMl,units:units,over:over};
  }
  // CALC-MEM-R2: capture per-peptide memory on every successful calc.
  try{ window._calcRememberLastDebounced && window._calcRememberLastDebounced(); }catch(_){}
}

// Render the "you have X vials across freezer/fridge/desk" panel in the calculator
// result card. Shows only when a peptide has been loaded from inventory.
// Takes dosesPerVial + daysSupply so we can extrapolate total remaining coverage.
function renderCalcStockPanel(dosesPerVial,daysSupply,freq){
  const panel=g('calc-stock-panel');
  if(!panel)return;
  const id=window._calcLoadedPepId;
  if(!id){panel.style.display='none';return;}
  const pep=(S.inv||[]).find(p=>p.id===id);
  if(!pep){panel.style.display='none';return;}
  const fz=+pep.fz||0,fr=+pep.fr||0,dk=+pep.dk||0;
  const totalVials=fz+fr+dk;
  // Build location chips — greyed out when zero, highlighted when stocked
  const chip=(emoji,label,n,color)=>{
    const isEmpty=n<=0;
    return'<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:6px;font-size:11.5px;font-weight:'+(isEmpty?500:700)+';background:'+(isEmpty?'rgba(0,0,0,0.04)':color.bg)+';color:'+(isEmpty?'var(--color-text-tertiary)':color.fg)+';border:.5px solid '+(isEmpty?'var(--color-border-tertiary)':color.border)+'">'
      +'<span style="font-size:13px">'+emoji+'</span>'+label+': <b>'+n+'</b>'
    +'</span>';
  };
  const locs=chip('🧊','Freezer',fz,{bg:'#DBEAFE',fg:'#1E40AF',border:'#93C5FD'})
    +chip('❄️','Fridge',fr,{bg:'#CFFAFE',fg:'#0E7490',border:'#67E8F9'})
    +chip('📦','Desk',dk,{bg:'#FEF3C7',fg:'#92400E',border:'#FCD34D'});
  // Extrapolation: if dosesPerVial is valid, compute total doses across all vials
  let coverage='';
  if(totalVials>0&&dosesPerVial&&dosesPerVial>0&&freq&&freq>0){
    const totalDoses=totalVials*dosesPerVial;
    const totalDays=Math.round(totalDoses/freq);
    coverage='<span style="font-size:11.5px;color:var(--color-text-secondary);margin-left:auto;white-space:nowrap">'+totalVials+' vial'+(totalVials===1?'':'s')+' = <b style="color:var(--color-text-primary)">~'+totalDoses+' doses</b> · '+totalDays+' days</span>';
  }else if(totalVials===0){
    coverage='<span style="font-size:11.5px;color:var(--accent-red-fg);font-weight:600;margin-left:auto">⚠ Out of stock</span>';
  }
  panel.innerHTML='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
    +'<span style="font-size:10px;font-weight:700;color:var(--calc-label);text-transform:uppercase;letter-spacing:.08em">📦 '+escH(pep.name)+' stock</span>'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap">'+locs+'</div>'
    +coverage
  +'</div>';
  panel.style.display='';
}

/* ============================================================
   SECTION: init()
   The app boot routine. Reads URL params, calls load(), wires
   up every button/tab/modal, sets up the theme toggle, and
   kicks off the first render. Everything between this banner
   and the next one is registration code run once on DOMContentLoaded.
   ============================================================ */

function init(){
  // Optional PDF price import: ?ptx=1 (or legacy ?owner) once — no visible wording; stored as pt_xtr.
  try{
    const params=new URLSearchParams(window.location.search);
    if(params.has('ptx')||params.has('owner')){
      localStorage.setItem('pt_xtr','1');
      params.delete('ptx');
      params.delete('owner');
      const qs=params.toString();
      history.replaceState(null,'',window.location.pathname+(qs?'?'+qs:'')+window.location.hash);
    }
  }catch(e){}
  load();
  // Define RENDERS early so the async auto-restore IIFE below can reference it safely.
  // (All referenced render* functions are hoisted function declarations inside init().)
  // Inventory page paints both the peptide table and the vials list. Wrapped
  // so RENDERS['inventory'] stays a single function reference.
  const renderInventoryPage=()=>scheduleInventoryVialRefresh(!vialFormIsOpen());
  window.renderInventoryPage=renderInventoryPage;
  window.renderInv=renderInv;
  window.renderVials=renderVials;
  window.vialFormIsOpen=vialFormIsOpen;
  window.saveAsync=saveAsync;
  setTimeout(function(){
    const orig=window.tmpRefreshAll;
    if(typeof orig!=='function'||orig.__vlFormHook)return;
    window.tmpRefreshAll=function(){
      if(vialFormIsOpen())return;
      return orig.apply(this,arguments);
    };
    window.tmpRefreshAll.__vlFormHook=true;
  },0);


function tmpOptSliderLive(el){
  try{
    if(!el || !el.id) return;
    const val=document.getElementById(el.id+'-val');
    if(val) val.textContent=el.value;
    // keep the GPT review prompt and computed recommendations in sync without waiting
    // for page navigation or mouseup/change events
    if(typeof window.renderOptimizer==='function'){
      if(window.__tmpOptSliderRAF) cancelAnimationFrame(window.__tmpOptSliderRAF);
      window.__tmpOptSliderRAF=requestAnimationFrame(()=>{try{window.renderOptimizer();}catch(_){}});
    }
  }catch(_){ }
}
window.tmpOptSliderLive=tmpOptSliderLive;
function bindOptimizerSliderLiveValues(){
  try{
    ['opt-g-fat','opt-g-rec','opt-g-sleep','opt-g-muscle','opt-g-app','opt-g-simple'].forEach(id=>{
      const el=document.getElementById(id);
      if(!el || el.__tmpOptLiveBound) return;
      el.__tmpOptLiveBound=true;
      const fire=()=>window.tmpOptSliderLive&&window.tmpOptSliderLive(el);
      el.addEventListener('input',fire,{passive:true});
      el.addEventListener('change',fire,{passive:true});
      fire();
    });
  }catch(_){ }
}
window.bindOptimizerSliderLiveValues=bindOptimizerSliderLiveValues;

function renderOptimizer(){
  const esc = (typeof escH==='function') ? escH : (v=>String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])));
  const today = new Date();
  const day = today.getDay();
  const di = (day+6)%7; // app Monday=0 if current helpers use that convention
  const peps = (S.inv||[]).filter(i=>i && !i.isSupply && !i.archived && i.name);
  const activePeps = peps.filter(i=> (i.fz||i.fr||i.dk||0) || (i.dose>0) || ((S.sched||{})[sk(i.name,'am',di)] || (S.sched||{})[sk(i.name,'pm',di)]));
  const doseMcg = it => {
    const d=parseFloat(it.dose)||0; const u=it.doseUnit||'mcg';
    if(u==='mg') return d*1000; if(u==='pill') return 0; return d;
  };
  const totalRemainingMcg = it => {
    let vialSum=0;
    try{ vialSum=(S.vials||[]).filter(v=>v.peptideName===it.name && v.status!=='depleted').reduce((a,v)=>a+(+v.remainingMcg||0),0); }catch(_){vialSum=0;}
    if(vialSum>0) return vialSum;
    const vialMg=parseFloat(it.vialMg)||parseFloat(it.amt)||0;
    return ((+it.fz||0)+(+it.fr||0)+(+it.dk||0)) * vialMg * 1000;
  };
  const schedPerWeek = it => pepShotsPerWeek(it);
  const daysLeft = it => {
    const dm=doseMcg(it), spw=schedPerWeek(it), rem=totalRemainingMcg(it);
    if(!dm || !spw || !rem) return null;
    return Math.floor((rem/dm)/spw*7);
  };
  const low = activePeps.map(it=>({it,days:daysLeft(it),rem:totalRemainingMcg(it)})).filter(x=>x.days!==null).sort((a,b)=>a.days-b.days).slice(0,5);
  const lane = t => activePeps.filter(i=>{let c=0;for(let d=0;d<7;d++) if((S.sched||{})[sk(i.name,t,d)]) c++; return c>0;});
  const am=lane('am'), pm=lane('pm');
  const interval = activePeps.filter(i=>i.interval>0);
  const todayDue = activePeps.filter(i=>(S.sched||{})[sk(i.name,'am',di)] || (S.sched||{})[sk(i.name,'pm',di)] || (i.interval>0));
  const burden = todayDue.length;
  const crowd = Math.max(am.length,pm.length);
  const lowPenalty = low.filter(x=>x.days<=7).length*10 + low.filter(x=>x.days>7&&x.days<=14).length*4;
  const crowdPenalty = Math.max(0,crowd-5)*5 + Math.max(0,burden-6)*4;
  const gv = id => Math.max(0, Math.min(100, +(g(id)?.value || 0)));
  const goals = {fat:gv('opt-g-fat'), rec:gv('opt-g-rec'), sleep:gv('opt-g-sleep'), muscle:gv('opt-g-muscle'), app:gv('opt-g-app'), simple:gv('opt-g-simple')};
  const hasName = re => activePeps.some(it => re.test(String(it.name||'').toLowerCase()));
  const goalFit =
    (goals.fat>=60 && (hasName(/reta|retatrutide|sema|tirz|aod|tesa/) ? 4 : -3)) +
    (goals.app>=60 && (hasName(/reta|retatrutide|sema|tirz/) ? 4 : -3)) +
    (goals.rec>=60 && (hasName(/bpc|tb.?500|wolv|wolverine|ghk/) ? 4 : -2)) +
    (goals.sleep>=60 && (hasName(/ipa|ipamorelin|dsip|cjc/) ? 3 : -2)) +
    (goals.muscle>=60 && (hasName(/test|tesa|cjc|ipa|retatrutide|reta/) ? 3 : -2));
  const simplicityPenalty = Math.round((goals.simple/100) * Math.max(0, activePeps.length-5) * 1.6) + Math.round((goals.simple/100) * Math.max(0, burden-4) * 2.2);
  const sleepCrowdPenalty = Math.round((goals.sleep/100) * Math.max(0, pm.length-4) * 2.3);
  const recoveryInventoryPenalty = Math.round((goals.rec/100) * low.filter(x=>/bpc|tb.?500|wolv|wolverine|ghk/i.test(x.it.name||'') && x.days<=14).length * 6);
  const fatInventoryPenalty = Math.round(((goals.fat+goals.app)/200) * low.filter(x=>/reta|retatrutide|sema|tirz|aod|tesa/i.test(x.it.name||'') && x.days<=14).length * 6);
  const score = Math.max(25, Math.min(98, Math.round(90 - lowPenalty - crowdPenalty - simplicityPenalty - sleepCrowdPenalty - recoveryInventoryPenalty - fatInventoryPenalty + goalFit + (activePeps.length?0:-8))));
  const scoreEl=g('opt-score'); if(scoreEl) scoreEl.textContent=score;
  const ring=g('opt-score-ring'); if(ring){ ring.style.setProperty('--score-deg', Math.round(score*3.6)+'deg'); ring.setAttribute('data-live','1'); clearTimeout(window.__tmpOptScorePulse); window.__tmpOptScorePulse=setTimeout(()=>ring.removeAttribute('data-live'),140); }
  const pill=g('opt-score-pill'); if(pill) pill.textContent='Score '+score;
  const invPill=g('opt-inv-pill'); if(invPill) invPill.textContent=low.length?('Lowest: '+low[0].it.name+' · '+low[0].days+'d'):'Inventory stable';
  const headline=g('opt-headline'); if(headline) headline.textContent = low.length&&low[0].days<=14 ? 'Priority: protect against run-out risk' : (crowd>5 ? 'Priority: reduce lane crowding' : 'Stack looks balanced enough to refine timing');
  const summary=g('opt-summary'); if(summary) summary.textContent = activePeps.length+' active items scanned · '+todayDue.length+' scheduled today · '+low.length+' inventory signals · '+(interval.length||0)+' interval-managed item'+(interval.length===1?'':'s')+'.';
  const lanes=g('opt-lanes');
  if(lanes){
    const laneData=[['AM lane',am.length,'morning scheduled',Math.min(100,am.length*16)],['PM / night',pm.length,'evening scheduled',Math.min(100,pm.length*16)],['Inventory risk',low.filter(x=>x.days<=14).length,'items under 14 days',Math.min(100,low.filter(x=>x.days<=14).length*28)],['Schedule load',todayDue.length,'items today',Math.min(100,todayDue.length*14)]];
    lanes.innerHTML=laneData.map(x=>'<div class="gpt-opt-lane"><div class="name">'+esc(x[0])+'</div><div class="big">'+esc(x[1])+'</div><div class="note">'+esc(x[2])+'</div><div class="bar"><i style="width:'+x[3]+'%"></i></div></div>').join('');
  }
  const watch=g('opt-watch');
  if(watch){
    const sig=[];
    if(low.length){ low.slice(0,3).forEach(x=>sig.push({cls:x.days<=7?'low':'good',ico:x.days<=7?'⚠':'📦',ttl:x.it.name,sub:'Estimated '+x.days+' days left · '+Math.round(x.rem/1000)+'mg remaining',tag:x.days+'d'})); }
    else sig.push({cls:'good',ico:'📦',ttl:'Inventory stable',sub:'No immediate run-out signal detected',tag:'OK'});
    sig.push({cls:crowd>5?'low':'good',ico:'🧭',ttl:'Lane crowding',sub:(crowd>5?'Heaviest lane has '+crowd+' items':'No heavy lane detected'),tag:crowd+' max'});
    sig.push({cls:todayDue.length>6?'low':'good',ico:'⏱',ttl:'Today load',sub:todayDue.length+' scheduled / interval items today',tag:todayDue.length});
    watch.innerHTML=sig.map(x=>'<div class="gpt-opt-signal '+x.cls+'"><div class="ico">'+x.ico+'</div><div><div class="ttl">'+esc(x.ttl)+'</div><div class="sub">'+esc(x.sub)+'</div></div><div class="tag">'+esc(x.tag)+'</div></div>').join('');
  }
  const recs=[];
  if(low.length&&low[0].days<=7) recs.push('<b>Inventory first:</b> '+esc(low[0].it.name)+' is the most urgent low-stock signal at about '+low[0].days+' days left. Confirm counts, reorder, or avoid building the plan around it until stock is safe.');
  else if(low.length&&low[0].days<=14) recs.push('<b>Protect the plan:</b> '+esc(low[0].it.name)+' is inside the two-week watch window. Keep it visible in Daily Stack and avoid expanding usage until inventory is stable.');
  if(goals.simple>=70 && (activePeps.length>5 || todayDue.length>4)) recs.push('<b>Simplify bias is high:</b> your sliders favor fewer moving parts. Consolidate optional support items and keep the next-action lane focused on the highest-value items.');
  if(goals.sleep>=65 && pm.length>4) recs.push('<b>Sleep lane is crowded:</b> your sleep priority is high and PM/night has '+pm.length+' items. Move non-sleep-sensitive vitamins or support items out of the night lane.');
  if(goals.rec>=65 && !hasName(/bpc|tb.?500|wolv|wolverine|ghk/)) recs.push('<b>Recovery gap:</b> recovery/injury is weighted high, but the optimizer does not see an obvious recovery-focused item in the active stack. Review whether this is intentional.');
  if((goals.fat>=65 || goals.app>=65) && !hasName(/reta|retatrutide|sema|tirz|aod|tesa/)) recs.push('<b>Goal mismatch:</b> fat loss/appetite control is weighted high, but the active stack does not show a clear anchor for that goal. Check the schedule or inventory data.');
  if(crowd>5) recs.push('<b>Reduce crowding:</b> the heaviest lane has '+crowd+' items. Split low-priority items into a quieter lane so the next action stays obvious.');
  if(todayDue.length>6) recs.push('<b>Today is heavy:</b> '+todayDue.length+' items are due or interval-managed today. Use Daily Stack for execution and keep the optimizer focused on bottlenecks, not every item.');
  if(!recs.length) recs.push('<b>Best next move:</b> no urgent red flag. Tune timing around your highest slider today, then use the Smart Watchlist to prevent inventory surprises.');
  recs.push('<b>Boundary:</b> this is schedule/inventory optimization only. It does not prescribe dosing or replace clinician guidance.');
  const recEl=g('opt-recs'); if(recEl) recEl.innerHTML=recs.map(r=>'<div class="gpt-opt-rec">'+r+'</div>').join('');
  const gptSummary = 'Stack Optimizer summary:\nScore: '+score+'/100\nActive items: '+activePeps.length+'\nScheduled today: '+todayDue.length+'\nAM lane: '+am.length+'\nPM/night lane: '+pm.length+'\nLow inventory: '+(low.map(x=>x.it.name+' ~'+x.days+'d').join(', ')||'none detected')+'\nGoal weights: fat loss '+(g('opt-g-fat')?.value||70)+', recovery '+(g('opt-g-rec')?.value||75)+', sleep '+(g('opt-g-sleep')?.value||55)+', muscle '+(g('opt-g-muscle')?.value||65)+', appetite '+(g('opt-g-app')?.value||70)+', simplicity '+(g('opt-g-simple')?.value||50)+'.\nPlease critique timing, redundancy, inventory risk, and practical simplification. Separate evidence from assumptions.';
  const txt=g('opt-gpt-summary'); if(txt) txt.value=gptSummary;
  ['fat','rec','sleep','muscle','app','simple'].forEach(k=>{ const el=g('opt-g-'+k), val=g('opt-g-'+k+'-val'); if(el&&val) val.textContent=el.value; });
}
window.renderOptimizer=renderOptimizer;
try{bindOptimizerSliderLiveValues();}catch(_){}


function renderStackBuilder(){
  const esc=(typeof escH==='function')?escH:(v=>String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])));
  const defaults={lanes:[],options:[],constraints:['evidence','clinician'],updated:''};
  let st; try{st=Object.assign({},defaults,JSON.parse(localStorage.getItem('tmp.stackBuilder.v1')||'{}'));}catch(_){st=defaults;}
  const laneDefs=[
    ['fat','Fat loss / appetite','Support appetite control, weight trend, adherence, and low-friction weekly rhythm.','⚖️',['Reta/GLP','Consistency','GI tolerance']],
    ['recovery','Recovery / injury','Prioritize repair-support cadence, site rotation, and avoiding missed recovery windows.','🛠️',['BPC/TB','PM lane','Injury focus']],
    ['sleep','Sleep / GH pulse','Protect night timing, reduce crowding, and keep sleep-sensitive items clean.','🌙',['Tesa/CJC/IPA','Night','Low crowding']],
    ['muscle','Muscle retention / recomposition','Keep training-supportive anchors consistent while avoiding unnecessary complexity.','💪',['Retention','Strength','Protein']],
    ['metabolic','Metabolic health','Connect glucose/lipids/lab context with schedule burden and inventory risk.','📈',['Labs','A1C','Lipids']],
    ['simplicity','Simplicity / travel','Minimize injections, consolidate lanes, and reduce maintenance burden.','🧳',['Low burden','Fewer lanes','Travel']]
  ];
  const optDefs=[
    ['Retatrutide / GLP lane','fat','Candidate anchor for appetite/weight-management lane; protect consistency and monitor tolerability.'],
    ['Tesamorelin / GH-recovery lane','sleep','Candidate for night/GH-adjacent lane; watch inventory, sleep quality, and lab context.'],
    ['CJC + Ipamorelin / GH pulse lane','sleep','Candidate for sleep/GH pulse lane; avoid crowding too many night items.'],
    ['BPC-157 + TB-500 / injury lane','recovery','Candidate recovery lane; use site rotation and inventory watch.'],
    ['AOD / optional fat-loss support','fat','Optional support item; optimizer may deprioritize if inventory is low or simplicity is high.'],
    ['Vitamins / support stack','metabolic','Non-peptide support lane; useful to separate from injection lanes and track adherence.'],
    ['TRT / oil protocol context','muscle','Context lane for existing Rx/oil protocol; keep separate from peptide reconstitution logic.'],
    ['Lab-guided monitoring','metabolic','Use blood-work checklist to identify missing context before making strong conclusions.']
  ];
  const constraintDefs=[
    ['evidence','GPT must separate evidence from assumptions'],['clinician','Questions to ask clinician included'],['lowstock','Protect low inventory first'],['night','Keep sleep lane uncrowded'],['max2','Max 2 injections per lane'],['useCurrent','Use current open vials first'],['noAM','Avoid AM injections'],['noDose','No dosing claims / no medical certainty'],['labs','Require blood-work context before strong recommendations']
  ];
  const has=(arr,x)=>Array.isArray(arr)&&arr.includes(x);
  const save=()=>{st.updated=new Date().toISOString();localStorage.setItem('tmp.stackBuilder.v1',JSON.stringify(st));try{S.stackBuilder=st;save&&window.save&&window.save()}catch(_){ } };
  const laneHost=g('sb-lanes'); if(laneHost) laneHost.innerHTML=laneDefs.map(l=>'<button type="button" class="gpt-sb-lane '+(has(st.lanes,l[0])?'on':'')+'" data-sb-lane="'+l[0]+'"><div class="icon">'+l[3]+'</div><div class="name">'+esc(l[1])+'</div><div class="desc">'+esc(l[2])+'</div><div class="tags">'+l[4].map(t=>'<span>'+esc(t)+'</span>').join('')+'</div></button>').join('');
  const optHost=g('sb-options'); if(optHost) optHost.innerHTML=optDefs.map((o,i)=>'<label class="gpt-sb-option"><input type="checkbox" data-sb-option="'+esc(o[0])+'" '+(has(st.options,o[0])?'checked':'')+'><div><b>'+esc(o[0])+'</b><em>'+esc(o[1])+'</em><small>'+esc(o[2])+'</small></div></label>').join('');
  const conHost=g('sb-constraints'); if(conHost) conHost.innerHTML=constraintDefs.map(c=>'<label class="gpt-sb-constraint"><input type="checkbox" data-sb-constraint="'+c[0]+'" '+(has(st.constraints,c[0])?'checked':'')+'> '+esc(c[1])+'</label>').join('');
  const selectedLanes=laneDefs.filter(l=>has(st.lanes,l[0]));
  const selectedOpts=optDefs.filter(o=>has(st.options,o[0]));
  const lowCount=(function(){try{return (S.inv||[]).filter(it=>{const v=(+it.fz||0)+(+it.fr||0)+(+it.dk||0);return it&&it.name&&!it.archived&&v>0&&v<=1}).length}catch(_){return 0}})();
  const summary='Stack Builder profile\nBuild lanes: '+(selectedLanes.map(l=>l[1]).join(', ')||'none selected')+'\nCandidate options: '+(selectedOpts.map(o=>o[0]).join(', ')||'none selected')+'\nConstraints: '+constraintDefs.filter(c=>has(st.constraints,c[0])).map(c=>c[1]).join('; ')+'\nLocal inventory low-count signal: '+lowCount+'\n\nGPT advisory instruction: Use medical research scholar mode. Only make claims supported by demonstrable evidence or clearly label assumptions. Do not invent citations. Separate evidence-supported observations, assumptions/uncertainties, practical schedule/inventory suggestions, and clinician questions. Do not prescribe dosing or claim medical certainty.';
  const sumHost=g('sb-summary'); if(sumHost) sumHost.innerHTML='<div class="sb-sum-score"><div class="sb-sum-stat"><b>'+selectedLanes.length+'</b><span>lanes</span></div><div class="sb-sum-stat"><b>'+selectedOpts.length+'</b><span>options</span></div><div class="sb-sum-stat"><b>'+lowCount+'</b><span>low stock</span></div></div><div class="sb-sum-block"><b>Selected lanes</b><p>'+(selectedLanes.length?selectedLanes.map(l=>esc(l[1])).join(' · '):'Choose one or more build lanes to shape the optimizer.')+'</p></div><div class="sb-sum-block"><b>Primary candidates</b><p>'+(selectedOpts.length?selectedOpts.slice(0,5).map(o=>esc(o[0])).join(' · '):'Select candidate options that should be considered by the optimizer.')+'</p></div><div class="sb-sum-block"><b>Best next step</b><p>'+(selectedLanes.length?'Feed this profile into the optimizer, then ask GPT for an evidence-constrained critique.':'Start by choosing the build lanes above.')+'</p></div>';
  const feed=g('sb-feed'); if(feed) feed.value=summary;
  const meta=g('sb-profile-meta'); if(meta) meta.textContent=selectedLanes.length?('profile ready · '+selectedLanes.length+' lanes'):'choose lanes';
  document.querySelectorAll('[data-sb-lane]').forEach(el=>{el.onclick=()=>{const v=el.dataset.sbLane;st.lanes=has(st.lanes,v)?st.lanes.filter(x=>x!==v):[...(st.lanes||[]),v];save();renderStackBuilder();};});
  document.querySelectorAll('[data-sb-option]').forEach(el=>{el.onchange=()=>{const v=el.dataset.sbOption;st.options=el.checked?[...(st.options||[]),v]:(st.options||[]).filter(x=>x!==v);save();renderStackBuilder();};});
  document.querySelectorAll('[data-sb-constraint]').forEach(el=>{el.onchange=()=>{const v=el.dataset.sbConstraint;st.constraints=el.checked?[...(st.constraints||[]),v]:(st.constraints||[]).filter(x=>x!==v);save();renderStackBuilder();};});
  const send=g('sb-send-optimizer'); if(send&&!send.__bound){send.__bound=1;send.onclick=()=>{save();try{localStorage.setItem('tmp.stackBuilder.feed',summary)}catch(_){};document.querySelector('[data-pg="optimizer"]')?.click();setTimeout(()=>{try{window.renderOptimizer&&window.renderOptimizer();window.tmpStackBuilderInjectOptimizer&&window.tmpStackBuilderInjectOptimizer();}catch(_){}},220);};}
  const copy=g('sb-copy-gpt'); if(copy&&!copy.__bound){copy.__bound=1;copy.onclick=async()=>{try{await navigator.clipboard.writeText(summary);tmpInventoryToast&&tmpInventoryToast('✓ Stack Builder GPT prompt copied');}catch(_){alert(summary);}};}
  const reset=g('sb-reset'); if(reset&&!reset.__bound){reset.__bound=1;reset.onclick=()=>{localStorage.removeItem('tmp.stackBuilder.v1');localStorage.removeItem('tmp.stackBuilder.feed');st=defaults;renderStackBuilder();};}
}
window.renderStackBuilder=renderStackBuilder;

  const RENDERS={stack:renderStack,optimizer:renderOptimizer,stackbuilder:renderStackBuilder,calendar:renderCal,log:renderLog,inventory:renderInventoryPage,prices:renderPrices,calc:renderCalc,protocols:renderProtocols,packages:renderPackages};
  // Auto-restore from IndexedDB mirror: if localStorage was empty/fresh (meaning the user
  // landed on this file for the first time under this origin but may have data under a
  // previous path/protocol — a second copy lives in IndexedDB), try pulling it back.
  // This is a safety net; it doesn't replace existing data, only fills a blank slate.
  (async()=>{
    try{
      if(S._hadSaved)return;  // already have real data, nothing to restore
      const mirrored=await idbGet();
      if(!mirrored)return;
      // Tombstone: if the user previously declined a restore, don't offer again.
      // The tombstone lives inside the mirror itself (so it survives localStorage clears).
      let parsed;
      try{parsed=JSON.parse(mirrored);}catch(e){return;}
      if(parsed&&parsed.__tmp_clear_tombstone){
        dbg('[auto-restore] tombstone present — user previously declined restore; skipping');
        return;
      }
      // Only offer restore if the mirror contains meaningful data (shots, inventory, or packages).
      const hasMeaningfulData=parsed&&((parsed.shots&&parsed.shots.length)||(parsed.inv&&parsed.inv.length>3)||(parsed.packages&&parsed.packages.length));
      if(!hasMeaningfulData)return;

      // Build a quick description of what the backup contains, so the user can make an informed call.
      const desc=[];
      if(parsed.shots&&parsed.shots.length)desc.push(parsed.shots.length+' shot'+(parsed.shots.length===1?'':'s'));
      if(parsed.inv&&parsed.inv.length)desc.push(parsed.inv.filter(i=>!i.isSupply).length+' peptides');
      if(parsed.packages&&parsed.packages.length)desc.push(parsed.packages.length+' package'+(parsed.packages.length===1?'':'s'));
      const latestShotDate=(parsed.shots||[]).reduce((max,s)=>s&&s.date>max?s.date:max,'');

      // Render a prompt banner at the top of the app. User must explicitly choose — we
      // don't silently overwrite their (possibly-just-cleared) state.
      const bar=document.createElement('div');
      bar.id='tmp-restore-prompt';
      bar.style.cssText='margin:0 0 12px;padding:12px 16px;background:var(--info-blue-bg);border:1px solid var(--info-blue-border);border-radius:10px;color:var(--info-blue-fg2);font-size:13px;display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;line-height:1.5';
      const summary=desc.length?desc.join(' · '):'some data';
      const dateHint=latestShotDate?' (latest shot '+escH(latestShotDate)+')':'';
      bar.innerHTML=
        '<span style="font-size:20px;flex-shrink:0">💾</span>'
        +'<div style="flex:1;min-width:220px">'
          +'<div style="font-weight:700;color:var(--info-blue-fg);margin-bottom:3px">Previous backup found</div>'
          +'<div style="font-size:12.5px;color:var(--info-blue-fg2)">This browser\'s offline backup has <b>'+escH(summary)+'</b>'+dateHint+' but your main storage is empty. Restore it, or discard the backup permanently?</div>'
        +'</div>'
        +'<div style="display:flex;gap:6px;flex-shrink:0">'
          +'<button class="btn bb" id="tmp-restore-keep" type="button" style="padding:5px 12px;font-size:12px;font-weight:600">Restore</button>'
          +'<button class="btn bro" id="tmp-restore-discard" type="button" style="padding:5px 12px;font-size:12px">Discard backup</button>'
        +'</div>';
      const app=document.querySelector('.app');
      const nav=document.getElementById('nav');
      if(app&&nav)app.insertBefore(bar,nav);else if(app)app.insertBefore(bar,app.firstChild);

      bar.querySelector('#tmp-restore-keep').addEventListener('click',async()=>{
        try{
          Object.assign(S,parsed);
          delete S.__tmp_clear_tombstone; // just in case
          S._hadSaved=true;
          try{localStorage.setItem('peptide_tracker',JSON.stringify(S));}catch(e){}
          const active=document.querySelector('#nav button.on');
          if(active&&active.dataset.pg){
            const renderFn=RENDERS[active.dataset.pg];
            if(renderFn)renderFn();
          }
          dbg('[auto-restore] user accepted restore');
        }catch(err){console.warn('[auto-restore] restore failed:',err);}
        bar.remove();
      });
      bar.querySelector('#tmp-restore-discard').addEventListener('click',async()=>{
        if(!confirm('Discard the offline backup permanently? This cannot be undone.'))return;
        try{
          // Write a tombstone to IDB so we never offer this backup again, even if user
          // reloads before save() overwrites the mirror with empty state.
          await idbPut(JSON.stringify({__tmp_clear_tombstone:true,clearedAt:new Date().toISOString()}));
          dbg('[auto-restore] user discarded backup; tombstone written');
        }catch(err){console.warn('[auto-restore] tombstone write failed:',err);}
        bar.remove();
      });
    }catch(e){console.warn('[auto-restore] skipped:',e);}
  })();
  // One-time: if extended price import is enabled and vendor list is still demo/empty, load personal vendor set (build-time data in this file).
  if(HAS_PRICE_IMPORT&&!S._owner_vendors_restored){
    const isDemo=Array.isArray(S.vendors)&&S.vendors.length===VENDORS_DEF.length&&S.vendors.every((v,i)=>v===VENDORS_DEF[i]);
    const isEmpty=!Array.isArray(S.vendors)||S.vendors.length===0;
    if(isDemo||isEmpty){
      S.vendors=[...OWNER_VENDORS];
      S.prices=JSON.parse(JSON.stringify(OWNER_PRICES));
    }
    S._owner_vendors_restored=true;
    save();
  }
  // Only seed defaults for brand-new users (no previous saved data)
  if(!S._hadSaved&&Object.keys(S.sched).length===0){
    AM_ST_DEF.forEach(row=>row.s.forEach((v,di)=>{if(v)S.sched[sk(row.n,'am',di)]=true;}));
    PM_ST_DEF.forEach(row=>row.s.forEach((v,di)=>{if(v)S.sched[sk(row.n,'pm',di)]=true;}));
  }
  rebuildCM();
  // Only auto-sort inventory for brand-new users — existing users keep their manual order
  if(!S._hadSaved){
    S.inv.sort((a,b)=>{
      const ca=countSchedDays(a.name),cb=countSchedDays(b.name);
      if(ca===0&&cb===0)return 0;
      if(ca===0)return 1;
      if(cb===0)return -1;
      return ca-cb;
    });
  }
  {const _hd=g('hdr-date');if(_hd)_hd.textContent=new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});}
  sv('lg-date',readFocusDate()||td());(function(){var _n=new Date();var _hh=String(_n.getHours()).padStart(2,'0');var _mm=String(_n.getMinutes()).padStart(2,'0');var _c=g('lg-time-clock');if(_c){_c.value=_hh+':'+_mm;}sv('lg-time',_n.getHours()<12?'am':'pm');})();
  buildLegend();
  applyPricesLayout();
  applyStorageBanner();
  applyHostBanner();
  applyInstallBanner();
function renderProtocols(){
  if(!S.tit)S.tit={};
  const sel=g('tit-sel');
  const prev=sel.value;
  // v15: populate from S.inv FIRST (user's actual peptides) so users can
  // titrate any peptide they've added — not just the 16 reference catalog
  // entries. Catalog peptides not already in S.inv are appended below as
  // a second optgroup.
  const escOpt = s => String(s).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[ch]);
  const userPeps = (S.inv||[])
    .filter(i => i && !i.isSupply && !i.archived && i.name)
    .map(i => i.name)
    .sort((a,b) => a.localeCompare(b));
  const userSet = new Set(userPeps.map(n => n.toLowerCase()));
  const catalogPeps = (typeof PEPTIDE_REF !== 'undefined' ? PEPTIDE_REF : [])
    .map(r => r.n)
    .filter(n => !userSet.has(String(n).toLowerCase()));
  let html = '<option value="">— select —</option>';
  if (userPeps.length){
    html += '<optgroup label="Your peptides">' +
      userPeps.map(n => '<option value="' + escOpt(n) + '">' + escOpt(n) + '</option>').join('') +
      '</optgroup>';
  }
  if (catalogPeps.length){
    html += '<optgroup label="Catalog (reference)">' +
      catalogPeps.map(n => '<option value="' + escOpt(n) + '">' + escOpt(n) + '</option>').join('') +
      '</optgroup>';
  }
  sel.innerHTML = html;
  if(prev)sel.value=prev;
  renderTitList();
  renderRefGrid('all');
}

/* ============================================================
   SECTION: Package Tracking
   Peptide order shipment tracker. Status taxonomy, carrier
   links, 17Track live-status integration (lazy-fetched on
   demand), the package list card, and the package edit modal.
   ============================================================ */

const PKG_STATUSES={
  ordered:{label:'Ordered',icon:'📝',color:'#4B5563',bg:'#F3F4F6',border:'#D1D5DB'},
  shipped:{label:'Shipped',icon:'📤',color:'#1D4ED8',bg:'#DBEAFE',border:'#93C5FD'},
  in_transit:{label:'In transit',icon:'✈️',color:'#0E7490',bg:'#CFFAFE',border:'#67E8F9'},
  customs:{label:'In customs',icon:'🛃',color:'#B45309',bg:'#FEF3C7',border:'#FCD34D'},
  delivered:{label:'Delivered',icon:'✅',color:'#047857',bg:'#D1FAE5',border:'#6EE7B7'},
  seized:{label:'Seized',icon:'⛔',color:'#B91C1C',bg:'#FEE2E2',border:'#FCA5A5'},
  reshipped:{label:'Reshipped',icon:'🔁',color:'#6D28D9',bg:'#EDE9FE',border:'#C4B5FD'}
};
const CARRIER_URLS={
  usps:n=>'https://tools.usps.com/go/TrackConfirmAction?tLabels='+encodeURIComponent(n),
  ups:n=>'https://www.ups.com/track?tracknum='+encodeURIComponent(n),
  fedex:n=>'https://www.fedex.com/fedextrack/?trknbr='+encodeURIComponent(n),
  dhl:n=>'https://www.dhl.com/en/express/tracking.html?AWB='+encodeURIComponent(n),
  china_post:n=>'https://track.chinapost.cn/querydes.do?fetchFlag=1&code=zh_CN&number='+encodeURIComponent(n),
  cainiao:n=>'https://global.cainiao.com/newDetail.htm?mailNoList='+encodeURIComponent(n),
  '17track':n=>'https://t.17track.net/en#nums='+encodeURIComponent(n),
  other:n=>'https://t.17track.net/en#nums='+encodeURIComponent(n)
};
const CARRIER_LABELS={usps:'USPS',ups:'UPS',fedex:'FedEx',dhl:'DHL',china_post:'China Post/EMS',cainiao:'Cainiao','17track':'17Track',other:'Other'};
let pkgEditingId=null;
let _pkgVendorsSig='';

function pkgEditIsOpen(){
  const c=g('pkg-edit-card');
  return !!(c&&c.style.display!=='none'&&c.style.display!=='');
}
function scrollPkgEditIntoView(){
  const card=g('pkg-edit-card');
  if(!card||!pkgEditIsOpen())return;
  const run=()=>{try{card.scrollIntoView({behavior:'smooth',block:'start'});}catch(_){try{card.scrollIntoView({block:'start'});}catch(__){}}};
  setTimeout(run,50);
  setTimeout(run,280);
}
window.scrollPkgEditIntoView=scrollPkgEditIntoView;

function daysBetween(a,b){if(!a||!b)return null;const da=new Date(a+'T12:00:00'),db=new Date(b+'T12:00:00');return Math.round((db-da)/(1000*60*60*24));}

function renderPackages(opts){
  opts=opts||{};
  // Populate vendor datalist from known vendors (skip rebuild when unchanged).
  const vendors=S.vendors||[];
  const sig=vendors.join('\0');
  const dl=g('pkg-vendors-dl');
  if(dl&&sig!==_pkgVendorsSig){
    _pkgVendorsSig=sig;
    dl.innerHTML=vendors.map(v=>'<option value="'+v.replace(/"/g,'&quot;')+'">').join('');
  }
  if(!opts.force&&pkgEditIsOpen()) return;
  // Storage-context warning — explain when data is fragile and about to disappear
  const warn=g('pkg-storage-warning');
  if(warn){
    let msg='';
    try{
      const proto=(location.protocol||'').toLowerCase();
      const isFile=proto==='file:';
      const isIncognito=!window.indexedDB||(()=>{try{localStorage.setItem('__tmp_probe__','1');localStorage.removeItem('__tmp_probe__');return false;}catch(e){return true;}})();
      if(isIncognito){
        msg='⚠ <b>Private / Incognito browsing detected.</b> Your packages will be lost when you close this window. Triple‑tap the syringe logo → <b>Save backup</b> to save a JSON file you can import later.';
      }else if(isFile){
        msg='ℹ <b>Running from a local file.</b> Your data is tied to this exact file\'s path on disk — if you download a new version of the HTML to a different location, your packages will look missing (they\'re still stored under the old file\'s origin). Triple‑tap the logo → <b>Save backup</b> before switching versions, then <b>Import</b> on the new file.';
      }
    }catch(e){}
    if(msg){warn.innerHTML=msg;warn.style.display='';}else{warn.style.display='none';}
  }
  // Summary stats
  const pkgs=S.packages||[];
  const today=td();
  const inTransit=pkgs.filter(p=>p.status==='in_transit'||p.status==='shipped'||p.status==='customs').length;
  const thisMonth=today.slice(0,7);
  const deliveredThisMonth=pkgs.filter(p=>p.status==='delivered'&&(p.deliveredDate||'').slice(0,7)===thisMonth).length;
  const spendThisMonth=pkgs.filter(p=>(p.orderDate||'').slice(0,7)===thisMonth).reduce((s,p)=>s+(+p.cost||0),0);
  const seizedThisYear=pkgs.filter(p=>p.status==='seized'&&(p.orderDate||'').slice(0,4)===today.slice(0,4)).length;
  const sum=g('pkg-summary');
  if(pkgs.length===0){
    sum.innerHTML='<div class="card empty-state" style="padding:2.25rem 1.25rem;text-align:center"><div class="empty-state-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg></div><h4>No packages tracked yet</h4><p>Click <b>+ Add package</b> above to log your first inbound order. You\'ll get live carrier status updates as it moves.</p></div>';
    g('pkg-list').innerHTML='';
    return;
  }
  sum.innerHTML='<div class="card" style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;padding:14px 1rem">'
    +statTile(inTransit,'in transit','#0E7490','#CFFAFE')
    +statTile(deliveredThisMonth,'delivered this month','#047857','#D1FAE5')
    +statTile('$'+spendThisMonth.toFixed(2),'spent this month','#185FA5','#DBEAFE')
    +(seizedThisYear>0?statTile(seizedThisYear,'seized this year','#B91C1C','#FEE2E2'):'')
    +'</div>';
  // Sort by status priority (active first), then by order date descending
  const STATUS_ORDER={in_transit:0,customs:1,shipped:2,ordered:3,reshipped:4,seized:5,delivered:6};
  const sorted=[...pkgs].sort((a,b)=>{
    const so=(STATUS_ORDER[a.status]??9)-(STATUS_ORDER[b.status]??9);
    if(so!==0)return so;
    return(b.orderDate||'').localeCompare(a.orderDate||'');
  });
  g('pkg-list').innerHTML=sorted.map(pkgCardHtml).join('');
  maybeAutoFetchTracking();
}
function statTile(val,label,color,bg){
  return'<div style="flex:1;min-width:120px;text-align:center;padding:10px 12px;background:'+bg+';border-radius:10px"><div style="font-size:22px;font-weight:700;color:'+color+';line-height:1">'+val+'</div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:'+color+';margin-top:3px;font-weight:600">'+label+'</div></div>';
}
// ═══════════════════════════════════════════════════════════════════════════════
// LIVE TRACKING (17Track via Netlify proxy at /api/track)
// ═══════════════════════════════════════════════════════════════════════════════
// Flow:
//   1. When a package with a tracking number is rendered, check S.tracking[trk]
//      for a cached result.
//   2. On initial load (once per session), fire fetchTrackingForAll() which:
//      - Registers any numbers we haven't registered yet (costs 1 op each)
//      - Calls gettrackinfo for all active numbers (free)
//      - Stores results in S.tracking[trk] = { lastEvent, updatedAt, stage, events }
//   3. Card render reads from S.tracking to show the live block.
//   4. Manual refresh button per card (↻) forces a re-fetch for that number only.
//
// If the proxy returns 500 (missing key) or network fails, we silently keep the
// cached/empty state — the rest of the app continues working.
// ═══════════════════════════════════════════════════════════════════════════════

const TRACK_PROXY_URL = '/api/track';
// 17Track status codes map to a rough 5-stage pipeline for the progress bar.
// Docs: "package_status" field — 0..50 range.
//   0   = unknown/not-found
//   10  = in transit (origin → transit)
//   20  = pickup (arrived at transit hub)
//   30  = undelivered (failed attempt)
//   35  = alert (exception)
//   40  = delivered
//   50  = expired
const STAGE_FROM_STATUS = {
  0: 0, 10: 1, 20: 2, 30: 3, 35: 3, 40: 4, 50: 4
};
const STAGE_LABELS = ['Origin', 'Sorted', 'Transit', 'Arrived dest.', 'Delivered'];

function ensureTrackingStore() {
  if (!S.tracking || typeof S.tracking !== 'object') S.tracking = {};
}

// Extract the most useful bits from a 17Track getTrackInfo response for one number.
function extractLatestEvent(trackInfo) {
  if (!trackInfo || !trackInfo.track_info) return null;
  const ti = trackInfo.track_info;
  const latest = ti.latest_event || (ti.tracking && ti.tracking.providers && ti.tracking.providers[0] && ti.tracking.providers[0].events && ti.tracking.providers[0].events[0]);
  if (!latest) return null;
  const status = ti.latest_status && ti.latest_status.status != null ? ti.latest_status.status : (trackInfo.package_status != null ? trackInfo.package_status : 0);
  const stage = STAGE_FROM_STATUS[status] != null ? STAGE_FROM_STATUS[status] : 0;
  return {
    text: latest.description || latest.desc || '',
    location: latest.location || '',
    time: latest.time_iso || latest.time_utc || latest.time || '',
    status,
    stage,
    updatedAt: new Date().toISOString()
  };
}

async function proxyTrackCall(action, numbers) {
  try {
    const res = await fetch(TRACK_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, numbers })
    });
    if (!res.ok) {
      console.warn('[tracking] proxy returned', res.status);
      // Return a sentinel the caller can surface to the user, instead of a silent null.
      return { __error: true, httpStatus: res.status, message: 'Tracking service returned ' + res.status };
    }
    const body = await res.json();
    // Minimal shape guard: we need an object with a numeric `code` field.
    // Anything else is treated as a proxy fault.
    if (!body || typeof body !== 'object' || typeof body.code !== 'number') {
      console.warn('[tracking] proxy returned unexpected body shape');
      return { __error: true, message: 'Tracking service returned an unrecognised response' };
    }
    return body;
  } catch (e) {
    console.warn('[tracking] network error:', e.message);
    return { __error: true, message: 'Network error: ' + e.message };
  }
}

// Render a transient error banner on the Packages page so users see when a fetch failed
// instead of it silently disappearing into the console.
function showTrackingError(msg){
  const host=g('pkg-list');
  if(!host)return;
  const id='pkg-tracking-err';
  let bar=document.getElementById(id);
  if(!bar){
    bar=document.createElement('div');
    bar.id=id;
    bar.style.cssText='margin:0 0 12px;padding:10px 14px;background:var(--info-amber-bg);border:1px solid var(--info-amber-border);border-radius:8px;color:var(--info-amber-fg2);font-size:12.5px;display:flex;align-items:center;gap:10px';
    host.parentNode.insertBefore(bar,host);
  }
  bar.innerHTML='<span>⚠️</span><span style="flex:1">'+escH(msg)+'</span><button class="btn" type="button" style="padding:3px 10px;font-size:11.5px">Dismiss</button>';
  bar.querySelector('button').addEventListener('click',()=>bar.remove());
}

async function fetchTrackingForAll(options) {
  ensureTrackingStore();
  const force = options && options.force;
  const pkgs = (S.packages || []).filter(p =>
    p.trackingNumber && p.status !== 'delivered' && p.status !== 'seized'
  );
  if (pkgs.length === 0) return;

  // Only send string, non-empty tracking numbers. Strip anything unusual before it
  // reaches the proxy — prevents accidentally POSTing null/object/undefined values.
  const numbers = pkgs
    .map(p => p.trackingNumber)
    .filter(n => typeof n === 'string' && n.length > 0 && n.length < 200);
  if (numbers.length === 0) return;

  // Register any we haven't registered before (one-time, 1 op each)
  const needsRegister = numbers.filter(n => !S.tracking[n] || !S.tracking[n].registered);
  if (needsRegister.length) {
    const regRes = await proxyTrackCall('register', needsRegister);
    if (regRes && regRes.__error) { showTrackingError(regRes.message); return; }
    if (regRes && regRes.code === 0 && regRes.data && typeof regRes.data === 'object') {
      const accepted = Array.isArray(regRes.data.accepted) ? regRes.data.accepted : [];
      const rejected = Array.isArray(regRes.data.rejected) ? regRes.data.rejected : [];
      accepted.forEach(row => {
        if (!row || typeof row.number !== 'string') return;
        S.tracking[row.number] = S.tracking[row.number] || {};
        S.tracking[row.number].registered = true;
      });
      rejected.forEach(row => {
        if (!row || typeof row.number !== 'string') return;
        S.tracking[row.number] = S.tracking[row.number] || {};
        S.tracking[row.number].registerError = (row.error && typeof row.error.message === 'string' ? row.error.message : 'Registration rejected');
      });
      save();
    }
  }

  // Get info for all (free quota-wise once registered)
  const info = await proxyTrackCall('gettrackinfo', numbers);
  if (info && info.__error) { showTrackingError(info.message); return; }
  if (info && info.code === 0 && info.data && Array.isArray(info.data.accepted)) {
    info.data.accepted.forEach(row => {
      if (!row || typeof row.number !== 'string') return;
      const n = row.number;
      const latest = extractLatestEvent(row);
      if (!S.tracking[n]) S.tracking[n] = {};
      if (latest) {
        S.tracking[n].lastEvent = latest;
        S.tracking[n].fetchedAt = new Date().toISOString();
      } else {
        S.tracking[n].fetchedAt = new Date().toISOString();
        S.tracking[n].noData = true;
      }
    });
    save();
    // Re-render the packages page if it's currently active
    const active = document.querySelector('#nav button.on');
    if (active && active.dataset.pg === 'packages') renderPackages();
  } else if (info && typeof info.code === 'number' && info.code !== 0) {
    // 17Track / proxy returned an explicit non-zero error code — surface it.
    showTrackingError('Tracking service error (code '+info.code+')');
  }
}

// Render the "live tracking" block that slots into pkgCardHtml.
// Returns empty string when there's no tracking number or no data yet.
function renderLiveTrackingBlock(p) {
  ensureTrackingStore();
  if (!p.trackingNumber) return '';
  if (p.status === 'delivered' || p.status === 'seized') return '';
  const t = S.tracking && S.tracking[p.trackingNumber];
  if (!t || !t.lastEvent) {
    // No data yet — show a subtle placeholder w/ a refresh button
    return '<div style="background:var(--color-background-secondary);border-radius:8px;padding:8px 10px;margin-bottom:10px;border-left:3px solid #D1D5DB;display:flex;align-items:center;gap:8px">'
      + '<span style="font-size:11.5px;color:var(--color-text-tertiary);flex:1">📍 Live tracking not loaded yet</span>'
      + '<button class="btn" data-pkg-track-refresh="'+p.id+'" data-trk="'+escH(p.trackingNumber)+'" style="padding:2px 10px;font-size:11px">↻ Fetch</button>'
      + '</div>';
  }
  const ev = t.lastEvent;
  const stageIdx = typeof ev.stage === 'number' ? ev.stage : 0;
  // Build a 5-segment progress bar — past stages solid green, current soft, rest muted
  const seg = i => {
    let bg;
    if (i < stageIdx) bg = '#1D9E75';
    else if (i === stageIdx) bg = '#5DCAA5';
    else bg = '#E5E7EB';
    return '<div style="flex:1;height:3px;background:'+bg+';border-radius:2px"></div>';
  };
  const segments = [0,1,2,3,4].map(seg).join('<span style="width:3px"></span>');
  const ageStr = ev.updatedAt ? timeAgo(ev.updatedAt) : '';
  const headline = ev.text || 'Update received';
  const loc = ev.location ? escH(ev.location) + ' — ' : '';
  return '<div style="background:var(--color-background-secondary);border-radius:8px;padding:8px 10px;margin-bottom:10px;border-left:3px solid #5DCAA5">'
    + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'
    + '<span style="font-size:11px;font-weight:600;color:var(--accent-green-fg)">📍 '+escH(ev.time||'Latest update')+'</span>'
    + (ageStr?'<span style="font-size:10.5px;color:var(--color-text-tertiary)">('+ageStr+')</span>':'')
    + '<button class="btn" data-pkg-track-refresh="'+p.id+'" data-trk="'+escH(p.trackingNumber)+'" style="margin-left:auto;padding:1px 8px;font-size:10.5px" title="Fetch latest from 17Track" aria-label="Refresh tracking status">↻</button>'
    + '</div>'
    + '<div style="font-size:12px;color:var(--color-text-primary);line-height:1.5;margin-bottom:6px">'+loc+escH(headline)+'</div>'
    + '<div style="display:flex;gap:3px;align-items:center">'+segments+'</div>'
    + '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--color-text-tertiary);margin-top:3px">'
    + STAGE_LABELS.map((l,i)=>'<span'+(i===stageIdx?' style="font-weight:600;color:var(--accent-green-fg)"':'')+'>'+l+'</span>').join('')
    + '</div>'
    + '</div>';
}

// Relative time since ISO timestamp
function timeAgo(iso) {
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 2) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    return days + 'd ago';
  } catch (e) { return ''; }
}

function pkgCardHtml(p){
  const st=PKG_STATUSES[p.status]||PKG_STATUSES.ordered;
  const today=td();
  let timing='';
  if(p.status==='delivered'&&p.deliveredDate&&p.orderDate){
    const d=daysBetween(p.orderDate,p.deliveredDate);
    timing=d!=null?'Delivered in '+d+' day'+(d===1?'':'s'):'';
  }else if(p.status==='seized'){
    timing='Seized';
  }else if(p.orderDate){
    const d=daysBetween(p.orderDate,today);
    timing=d!=null?d+' day'+(d===1?'':'s')+' since order':'';
  }
  const trk=p.trackingNumber?'':'';
  const carrierFn=CARRIER_URLS[p.carrier]||CARRIER_URLS['17track'];
  const trkLink=p.trackingNumber?'<a href="'+carrierFn(p.trackingNumber)+'" target="_blank" rel="noopener" style="font-family:ui-monospace,Menlo,Consolas,monospace;color:var(--accent-cyan-fg);text-decoration:none;font-weight:600;font-size:12.5px" title="Open '+(CARRIER_LABELS[p.carrier]||'carrier')+' tracking page">'+escH(p.trackingNumber)+' ↗</a><span style="color:var(--color-text-tertiary);font-size:11px;margin-left:6px">'+(CARRIER_LABELS[p.carrier]||'Other')+'</span>':'<span style="color:var(--color-text-tertiary);font-size:12px;font-style:italic">No tracking #</span>';
  const cost=(+p.cost||0)>0?('<span style="font-weight:600;color:var(--color-text-primary)">'+(p.currency||'USD')+' '+(+p.cost).toFixed(2)+'</span>'):'';
  const est=p.estDelivery&&p.status!=='delivered'&&p.status!=='seized'?'<span style="color:var(--color-text-secondary);font-size:11.5px">Est. '+p.estDelivery+'</span>':'';
  const delv=p.status==='delivered'&&p.deliveredDate?'<span style="color:var(--accent-green-fg);font-size:11.5px;font-weight:600">Received '+p.deliveredDate+'</span>':'';
  const items=p.items?'<div style="font-size:12.5px;color:var(--color-text-primary);line-height:1.5;margin-bottom:4px">📋 '+escH(p.items)+'</div>':'';
  const notes=p.notes?'<div style="font-size:11.5px;color:var(--color-text-secondary);line-height:1.5;font-style:italic">💬 '+escH(p.notes)+'</div>':'';
  const canMarkDelivered=p.status!=='delivered'&&p.status!=='seized';
  return'<div class="card pkg-card" style="padding:14px 16px;border-left:4px solid '+st.border+'">'
    +'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px">'
      +'<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
        +'<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:999px;background:'+st.bg+';color:'+st.color+';font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;border:1px solid '+st.border+'"><span>'+st.icon+'</span>'+st.label+'</span>'
        +'<span style="font-weight:700;font-size:15px;color:var(--color-text-primary)">'+escH(p.vendor||'Unknown vendor')+'</span>'
        +(p.orderDate?'<span style="font-size:11.5px;color:var(--color-text-secondary)">Ordered '+p.orderDate+'</span>':'')
      +'</div>'
      +'<div style="font-size:11.5px;color:var(--color-text-tertiary);font-style:italic">'+timing+'</div>'
    +'</div>'
    +'<div style="margin-bottom:10px">'+trkLink+'</div>'
    +renderLiveTrackingBlock(p)
    +items+notes
    +'<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:.5px dashed var(--color-border-tertiary)">'
      +'<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:12px">'+cost+est+delv+'</div>'
      +'<div style="display:flex;gap:6px">'
        +(canMarkDelivered?'<button class="btn bg" data-pkg-deliver="'+p.id+'" style="padding:3px 10px;font-size:11.5px">✓ Mark delivered</button>':'')
        +'<button class="btn" data-pkg-edit="'+p.id+'" style="padding:3px 10px;font-size:11.5px">✏️ Edit</button>'
        +'<button class="btn bro" data-pkg-del="'+p.id+'" style="padding:3px 10px;font-size:11.5px">Remove</button>'
      +'</div>'
    +'</div>'
  +'</div>';
}
function openPkgEdit(id){
  pkgEditingId=id;
  const p=id?(S.packages||[]).find(x=>x.id===id):null;
  g('pke-title').textContent=p?'Edit package':'Add package';
  g('pke-del').style.display=p?'':'none';
  sv('pke-vendor',p?p.vendor||'':'');
  sv('pke-status',p?p.status||'in_transit':'in_transit');
  sv('pke-trk',p?p.trackingNumber||'':'');
  sv('pke-carrier',p?p.carrier||'17track':'17track');
  sv('pke-order-date',p?p.orderDate||'':td());
  sv('pke-est-date',p?p.estDelivery||'':'');
  sv('pke-cost',p?p.cost||'':'');
  sv('pke-currency',p?p.currency||'USD':'USD');
  sv('pke-delivered-date',p?p.deliveredDate||'':'');
  sv('pke-items',p?p.items||'':'');
  sv('pke-notes',p?p.notes||'':'');
  g('pke-msg').textContent='';
  g('pkg-edit-card').style.display='block';
  scrollPkgEditIntoView();
  setTimeout(()=>{const v=g('pke-vendor');if(v)try{v.focus({preventScroll:true});}catch(_){try{v.focus();}catch(__){}}},120);
}
function closePkgEdit(){pkgEditingId=null;g('pkg-edit-card').style.display='none';}
function savePkg(){
  const vendor=gv('pke-vendor').trim();
  if(!vendor){g('pke-msg').textContent='Vendor is required.';g('pke-msg').style.color='#A32D2D';return;}
  const status=gv('pke-status');
  const deliveredDate=gv('pke-delivered-date');
  // Auto-set status to delivered if user filled in a delivered date
  const finalStatus=deliveredDate&&status!=='seized'&&status!=='reshipped'?'delivered':status;
  const pkg={
    id:pkgEditingId||('pkg-'+Date.now()+'-'+Math.random().toString(36).slice(2,7)),
    vendor,
    status:finalStatus,
    trackingNumber:gv('pke-trk').trim(),
    carrier:gv('pke-carrier'),
    orderDate:gv('pke-order-date'),
    estDelivery:gv('pke-est-date'),
    deliveredDate:deliveredDate,
    cost:parseFloat(gv('pke-cost'))||0,
    currency:gv('pke-currency'),
    items:gv('pke-items').trim(),
    notes:gv('pke-notes').trim()
  };
  if(!S.packages)S.packages=[];
  if(pkgEditingId){
    const i=S.packages.findIndex(x=>x.id===pkgEditingId);
    if(i>=0)S.packages[i]=pkg;
  }else{
    S.packages.push(pkg);
  }
  closePkgEdit();
  saveAsync(()=>renderPackages({force:true}));
}
g('pkg-add-btn').addEventListener('click',()=>openPkgEdit(null));
g('pkg-refresh-all').addEventListener('click',async function(){
  this.disabled=true;const orig=this.textContent;this.textContent='Refreshing…';
  _trackingFetchedOnce=false; // allow the fetch to run again
  await fetchTrackingForAll({force:true});
  this.disabled=false;this.textContent=orig;
  renderPackages();
});
g('pkg-export-btn').addEventListener('click',()=>{
  if(typeof doExport==='function')doExport('peptide-tracker-backup-');
  else{alert('Export unavailable — triple‑tap the syringe logo for Save backup, or reload and try again.');}
});
g('pke-close').addEventListener('click',closePkgEdit);
g('pke-cancel').addEventListener('click',closePkgEdit);
g('pke-save').addEventListener('click',savePkg);
g('pke-del').addEventListener('click',()=>{
  if(!pkgEditingId)return;
  if(!confirm('Delete this package?'))return;
  S.packages=(S.packages||[]).filter(x=>x.id!==pkgEditingId);
  closePkgEdit();
  saveAsync(()=>renderPackages({force:true}));
});
g('pkg-list').addEventListener('click',e=>{
  const edit=e.target.closest('[data-pkg-edit]');
  const del=e.target.closest('[data-pkg-del]');
  const deliver=e.target.closest('[data-pkg-deliver]');
  const refresh=e.target.closest('[data-pkg-track-refresh]');
  if(edit){openPkgEdit(edit.dataset.pkgEdit);return;}
  if(del){
    if(!confirm('Delete this package?'))return;
    S.packages=(S.packages||[]).filter(x=>x.id!==del.dataset.pkgDel);
    saveAsync(()=>renderPackages({force:true}));return;
  }
  if(deliver){
    const p=(S.packages||[]).find(x=>x.id===deliver.dataset.pkgDeliver);
    if(!p)return;
    p.status='delivered';
    p.deliveredDate=td();
    saveAsync(()=>renderPackages({force:true}));return;
  }
  if(refresh){
    const trk=refresh.dataset.trk;
    if(!trk)return;
    refresh.disabled=true;refresh.textContent='…';
    proxyTrackCall('gettrackinfo',[trk]).then(info=>{
      if(info&&info.code===0&&info.data&&info.data.accepted){
        info.data.accepted.forEach(row=>{
          const latest=extractLatestEvent(row);
          if(!S.tracking)S.tracking={};
          if(!S.tracking[row.number])S.tracking[row.number]={};
          if(latest)S.tracking[row.number].lastEvent=latest;
          S.tracking[row.number].fetchedAt=new Date().toISOString();
        });
        save();
      }
    }).finally(()=>{renderPackages({force:true});});
    return;
  }
});
// Auto-fetch tracking once when user first lands on Package Track this session
let _trackingFetchedOnce=false;
function maybeAutoFetchTracking(){
  // Tracking data is now strictly opt-in — users click the per-card "↻ Fetch"
  // button (or the page-level refresh) to send a tracking number to /api/track.
  // No automatic network request on page load, so the Privacy guarantees hold
  // until the user explicitly asks for live data.
  if(_trackingFetchedOnce)return;
  _trackingFetchedOnce=true;
  // (previously auto-fired setTimeout → fetchTrackingForAll here)
}
  document.querySelectorAll('#nav button, .hdr-tab-btn').forEach(btn=>btn.addEventListener('click',()=>{
    activatePage(btn.dataset.pg);
  }));
  function activatePage(pg,opts){
    opts=opts||{};
    if(!pg||!g('pg-'+pg)) pg='stack';
    document.querySelectorAll('#nav button, .hdr-tab-btn').forEach(b=>b.classList.remove('on'));
    document.querySelectorAll('.page').forEach(p=>p.style.display='none');
    const navBtn=document.querySelector('#nav [data-pg="'+pg+'"], .hdr-tab-btn[data-pg="'+pg+'"]');
    if(navBtn) navBtn.classList.add('on');
    g('pg-'+pg).style.display='block';
    const tb=document.querySelector('.top-bar');
    if(tb) tb.style.display=['calc','about','faq','contact'].indexOf(pg)>=0?'none':'';
    if(pg!=='stack'){stackHighlight=null;applyStackHighlight();}
    if(opts.render!==false) (RENDERS[pg]||function(){})();
    if(pg==='vitals'&&window.renderVitals)window.renderVitals();if(pg==='stack'&&window.renderVitalsSummary)window.renderVitalsSummary();
    if(pg==='log'){
      // LG-CLOCK-STALE-R1: arriving on the Shot Log defaults the time field to
      // the actual current time (unless the user set it themselves) — the old
      // behavior kept whatever time the page happened to load at.
      try{if(typeof window._refreshLgClockToNow==='function')window._refreshLgClockToNow(false);}catch(_){}
      const _fd=readFocusDate();if(_fd)applyFocusDateToForms(_fd);
    }
    if(opts.save!==false) rememberCurrentPage(pg);
  }
  window.__tmpActivatePage=activatePage;
  activatePage(readSavedPage(),{save:false});
  window.addEventListener('pagehide',function(){
    const active=document.querySelector('#nav button.on, .hdr-tab-btn.on');
    if(active&&active.dataset.pg) rememberCurrentPage(active.dataset.pg);
  });

  // VP-1-fix: flush deferred renderPrices when Vendor Pricing is restored via lastActivePage
  function _flushVendorPricingIfVisible(){
    if(!window._renderPricesNeedsFlush||!_vendorPricingPageVisible())return;
    window.__renderPricesForceNext=true;
    renderPrices();
  }
  setTimeout(_flushVendorPricingIfVisible,0);
  setTimeout(_flushVendorPricingIfVisible,450);
  setTimeout(_flushVendorPricingIfVisible,1200);

  document.querySelectorAll('[data-opt-page]').forEach(btn=>{ if(!btn.__optGo){ btn.__optGo=true; btn.addEventListener('click',()=>{ const pg=btn.dataset.optPage; const nav=document.querySelector('#nav [data-pg="'+pg+'"], .hdr-tab-btn[data-pg="'+pg+'"]'); if(nav) nav.click(); }); }});
  ['opt-g-fat','opt-g-rec','opt-g-sleep','opt-g-muscle','opt-g-app','opt-g-simple'].forEach(id=>{ const el=g(id); if(el&&!el.__optWire){ el.__optWire=true; el.addEventListener('input',()=>{window.tmpOptSliderLive&&window.tmpOptSliderLive(el);}); }});
  const optCopy=g('opt-copy-gpt'); if(optCopy&&!optCopy.__optWire){ optCopy.__optWire=true; optCopy.addEventListener('click',()=>{ const t=g('opt-gpt-summary'); if(t){t.select();document.execCommand('copy'); optCopy.textContent='Copied'; setTimeout(()=>optCopy.textContent='Copy GPT review prompt',1200);} }); }
  const optExport=g('opt-export-btn'); if(optExport&&!optExport.__optWire){ optExport.__optWire=true; optExport.addEventListener('click',()=>{ const t=g('opt-gpt-summary'); if(t){navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(t.value):null; optExport.textContent='Summary copied'; setTimeout(()=>optExport.textContent='Copy summary',1200);} }); }

  g('btn-prev').addEventListener('click',()=>{S.wkOff--;renderCal();});
  g('btn-next').addEventListener('click',()=>{S.wkOff++;renderCal();});
  const calExport=g('cal-export-pdf');
  if(calExport&&!calExport.__wired){
    calExport.__wired=true;
    calExport.addEventListener('click',()=>{try{exportCalPdf();}catch(e){console.error('exportCalPdf',e);}});
  }
  // P1B: delegated click ownership for the 4 calendar row containers.
  // One permanent listener per container replaces N per-cell addEventListener
  // calls that were recreated on every renderCal() call (~15–40 per render).
  // ctx is reconstructed from data attributes set on each active cell at
  // build time. parseInt normalises dataset strings to numbers where strict
  // equality against shot.id (always a number) requires it — same precedent
  // as lines 7081 and 7111.
  const _calPg=g('pg-calendar');
  if(_calPg&&!_calPg._focusDelegated){
    _calPg._focusDelegated=true;
    // Day header clicks intentionally do nothing — no focus highlight, no navigation.
  }
  ['cal-breakfast-rows','cal-lunch-rows','cal-dinner-rows','cal-bedtime-rows'].forEach(function(cid){
    const el=g(cid);if(!el||el._calDelegated)return;el._calDelegated=true;
    el.addEventListener('click',function(e){
      const dayPick=e.target.closest('.cal-day-pick[data-date]');
      if(dayPick){const iso=dayPick.dataset.date;if(iso&&typeof setFocusDate==='function'){setFocusDate(iso);goToShotLogPage();}return;}
      const cell=e.target.closest('.sc.active');if(!cell)return;
      if(cell.classList.contains('gpt329-plan-cell'))return;
      const _focusIso=cell.dataset.date;
      if(_focusIso&&typeof setFocusDate==='function')setFocusDate(_focusIso);
      const _name=cell.dataset.pep||cell.dataset.planName;
      if(!_name)return;
      const ctx={
        type:cell.dataset.type||'sched',
        name:_name,
        date:cell.dataset.date,
        time:cell.dataset.time||(cell.dataset.planLane&&MEAL_LANE_TO_TIME[cell.dataset.planLane])||'am',
        di:parseInt(cell.dataset.di!=null?cell.dataset.di:cell.dataset.planDi,10)
      };
      const _laneHost=cid.replace(/^cal-/,'').replace(/-rows$/,'');
      if(MEAL_LANE_TO_TIME[_laneHost])ctx.lane=_laneHost;
      if(isNaN(ctx.di))return;
      if(ctx.type==='logged')ctx.shotId=parseInt(cell.dataset.shotid,10);
      try{if(window.__tmpCaptureSchedCur)window.__tmpCaptureSchedCur(ctx);}catch(_){}
      apShow(ctx);
    });
  });
  g('ap-x').addEventListener('click',apClose);
  g('t-edit').addEventListener('click',doEdit);g('t-move').addEventListener('click',doMove);g('t-del').addEventListener('click',doDel);
  // Log shot tile (sched cells only) — close the action popup, then deep-link to Shot Log
  const tLog=g('t-log');
  if(tLog)tLog.addEventListener('click',()=>{
    const name=CUR&&CUR.name;
    apClose();
    if(name)deepLinkLogShotForPep(name);
  });
  // --- Stack action panel tile handlers ---
  // Each one reads the active peptide from CUR_STACK_PEP, closes the panel, then runs.
  // Helper: programmatically click a nav button so the page swap, render, and top-bar
  // visibility all happen via the shared nav handler instead of being duplicated here.
  const goToPage=pg=>{const b=document.querySelector('#nav [data-pg="'+pg+'"]');if(b)b.click();};
  const tsClose=g('aps-x');
  if(tsClose)tsClose.addEventListener('click',apCloseStack);
  const tsLog=g('ts-log');
  if(tsLog)tsLog.addEventListener('click',()=>{
    const name=CUR_STACK_PEP;apCloseStack();
    if(name)deepLinkLogShotForPep(name);
  });
  const tsHist=g('ts-hist');
  if(tsHist)tsHist.addEventListener('click',()=>{
    const name=CUR_STACK_PEP;apCloseStack();
    if(name)showPeptideChart(name);
  });
  const tsEdit=g('ts-edit');
  if(tsEdit)tsEdit.addEventListener('click',()=>{
    const name=CUR_STACK_PEP;apCloseStack();
    if(!name)return;
    // Mirror the inv-edit-btn flow: navigate to inventory, open the form for this peptide.
    const it=(S.inv||[]).find(i=>!i.isSupply&&i.name===name);
    if(!it)return;
    goToPage('inventory');
    // setTimeout: let the page swap settle before manipulating the form
    setTimeout(()=>{
      const it=(S.inv||[]).find(i=>!i.isSupply&&i.name===name);
      if(it) openPepEditor(it);
    },30);
  });
  const tsCalc=g('ts-calc');
  if(tsCalc)tsCalc.addEventListener('click',()=>{
    const name=CUR_STACK_PEP;apCloseStack();
    if(!name)return;
    const it=(S.inv||[]).find(i=>!i.isSupply&&i.name===name);
    if(!it)return;
    goToPage('calc');
    // The calc page renderer rebuilds the inv-from-inv selector. After it
    // settles, set the value and dispatch change so the existing handler
    // loads the peptide's vial / BAC / dose into the calculator inputs.
    setTimeout(()=>{
      const sel=g('calc-from-inv');
      if(!sel)return;
      sel.value=String(it.id);
      sel.dispatchEvent(new Event('change'));
    },50);
  });
  g('edit-bk').addEventListener('click',showTiles);g('edit-cancel').addEventListener('click',showTiles);g('edit-save').addEventListener('click',saveEdit);
  g('move-bk').addEventListener('click',showTiles);g('move-cancel').addEventListener('click',showTiles);g('move-save').addEventListener('click',saveMove);
  g('del-bk').addEventListener('click',showTiles);g('del-cancel').addEventListener('click',showTiles);g('del-confirm').addEventListener('click',()=>confirmDel('one'));g('del-confirm-all').addEventListener('click',()=>confirmDel('all-sched'));
  // Reset-tracker button on the rotation card — wiring is now owned by
  // the unified tmpConfirmTwice helper in <script id="tmp-clearall-js"> so it
  // shares click-twice + 5s undo with the other Clear All buttons.
  // (Original 2-step-confirm IIFE removed in v1.)
  // Tag/severity chip toggling (multi-select for tags, single for severity)
  document.querySelectorAll('#lg-tag-row .tag-chip').forEach(c=>c.addEventListener('click',()=>c.classList.toggle('on')));
  // Custom tag input — creates a new chip.on whenever user hits Enter or clicks the + button
  (function(){
    const input=g('lg-tag-custom'),btn=g('lg-tag-custom-btn'),row=g('lg-tag-row');
    if(!input||!btn||!row)return;
    const addCustomTag=()=>{
      const val=input.value.trim();
      if(!val)return;
      // Avoid duplicate custom chips for the same tag
      const existing=row.querySelector('.tag-chip[data-custom="1"][data-tag="'+val.replace(/"/g,'\\"')+'"]');
      if(existing){existing.classList.add('on');input.value='';return;}
      const chip=document.createElement('button');
      chip.type='button';chip.className='tag-chip on';
      chip.dataset.tag=val;chip.dataset.custom='1';chip.textContent=val;
      chip.addEventListener('click',()=>chip.classList.toggle('on'));
      // Insert before the custom-input wrapper (last element in the row)
      const inputWrap=input.closest('span');
      row.insertBefore(chip,inputWrap);
      input.value='';
    };
    btn.addEventListener('click',addCustomTag);
    input.addEventListener('keydown',e=>{
      if(e.key==='Enter'){e.preventDefault();addCustomTag();}
    });
  })();
  document.querySelectorAll('#lg-severity .sev-chip').forEach(c=>c.addEventListener('click',()=>{
    const wasOn=c.classList.contains('on');
    document.querySelectorAll('#lg-severity .sev-chip').forEach(x=>x.classList.remove('on'));
    if(!wasOn)c.classList.add('on');
  }));
  g('lg-btn').addEventListener('click',()=>{
    const pep=gv('lg-pep'),dose=parseFloat(gv('lg-dose')),doseUnit=normalizeShotLogDoseUnit(gv('lg-dose-unit')),volRaw=gv('lg-vol'),vol=parseFloat(volRaw),volumeUnit=gv('lg-vol-unit')||'mL',time=gv('lg-time'),date=gv('lg-date'),notes=gv('lg-notes').trim();
    const resolvedInjectionSite=resolveInjectionSite();
    const site=resolvedInjectionSite;
    const m=g('lg-msg');
    const isPill=doseUnit==='pill';
    // Pills don't have a volume — default to 0 and skip that validation
    const effVol=isPill?0:vol;
    if(!pep||isNaN(dose)||(!isPill&&isNaN(vol))||!date){m.textContent='Fill in all fields.';m.style.color='#A32D2D';return;}
    let autoReconned=false;  // set true below if we move a vial freezer→fridge
    // Tag the shot with its injection type ('SQ' or 'IM') so future
    // displays/aggregations don't have to re-derive it from the site name.
    const shotType=siteIsIM(site)?'IM':'SQ';
    var __clockEl=g('lg-time-clock');var __timeStr=(__clockEl&&__clockEl.value)?__clockEl.value:'';const normDate=normalizeIsoDate(date);const normTime=shotBucketTime({time,timeStr:__timeStr});const shot={id:S.nS++,peptide:pep,dose,doseUnit,volume:effVol,volumeUnit:isPill?'pill':volumeUnit,site:'',date:normDate,time:normTime,type:shotType};if(__timeStr)shot.timeStr=__timeStr;
    shot.site=resolvedInjectionSite;
    if(notes)shot.notes=notes;
    // Side-effect tags + severity
    const tags=[...document.querySelectorAll('#lg-tag-row .tag-chip.on')].map(c=>c.dataset.tag);
    if(tags.length)shot.tags=tags;
    const sevBtn=document.querySelector('#lg-severity .sev-chip.on');
    if(sevBtn)shot.severity=parseInt(sevBtn.dataset.sev);
    S.shots.push(shot);
    // LG-CLOCK-STALE-R1: shot logged — re-arm the clock auto-refresh so the
    // next visit to the form defaults to the then-current time.
    window._lgTimeUserSet = false;
    // Remember this dose on the inventory peptide so calculator "Load from inventory" auto-fills it next time.
    try{ rememberPepDose(pep, dose, doseUnit, (typeof gv==='function'&&g('calc-freq')?gv('calc-freq'):null)); }catch(_){}
    const loggedSite=shot.site;
    // Clear chips for next shot — preset chips get untoggled, custom chips get removed
    document.querySelectorAll('#lg-tag-row .tag-chip:not([data-custom]), #lg-severity .sev-chip').forEach(c=>c.classList.remove('on'));
    document.querySelectorAll('#lg-tag-row .tag-chip[data-custom]').forEach(c=>c.remove());
    // Auto-decrement supplies based on what was administered.
    // Pills: decrement one from the peptide's Desk count (pills are stored in the desk).
    // Injections: decrement a syringe from the shared supplies (IM sites → IM syringes,
    //   everything else → SQ syringes). No peptide stock decrement for injections since
    //   one vial covers many shots — we track vials by recon/used, not by shot.
    if(isPill){
      const pep=S.inv.find(x=>!x.isSupply&&x.name===shot.peptide);
      if(pep&&(pep.dk||0)>0){
        pep.dk--;
      }
    }else{
      // siteIsIM handles both legacy strings ("IM Deltoid L") and new cell IDs
      // ("f-49") — looks up the cell's region.type when the regex doesn't match.
      const isIM=siteIsIM(site);
      const kind=isIM?'im':'sq';
      const supply=S.inv.find(x=>x.isSupply&&x.supplyKind===kind);
      if(supply){
        supply.dk=Math.max(0,(supply.dk||0)-1);
      }
      // Alcohol pads: one per injection (used to swab the site before/after)
      const pad=S.inv.find(x=>x.isSupply&&x.supplyKind==='pad');
      if(pad){
        pad.dk=Math.max(0,(pad.dk||0)-1);
      }
      // VIAL-AWARE deduction. Two cases:
      //   (a) Peptide has vial rows → pick the active fridge vial (or auto-recon
      //       the oldest freezer one), decrement remainingMcg by dose. Tag the
      //       shot with vialId so we can show "this vial is on dose 7 of ~12".
      //   (b) Peptide has NO vial rows (added before migration, or user just
      //       prefers bucket counts) → fall back to the legacy fz→fr move.
      // The user-visible auto-recon UX is the same in both cases (toast says
      // "vial moved freezer→fridge"), but case (a) writes data the new Vials
      // section can render and (b) doesn't.
      const pepInv=S.inv.find(x=>!x.isSupply&&x.name===shot.peptide);
      if(pepInv&&!pepInv.isBlend&&hasVials(shot.peptide)){
        const doseMcg=doseToMcg(shot.dose,shot.doseUnit);
        // Allow the UI to override the auto-pick by setting g('lg-vial').value
        // to a specific vial id (added to the shot-log form below).
        const lgVialEl=g('lg-vial');
        const explicitId=lgVialEl?parseInt(lgVialEl.value||'0',10):0;
        let vial=explicitId?S.vials.find(v=>v.id===explicitId&&v.peptideName===shot.peptide&&v.status==='active'):pickFridgeVial(shot.peptide);
        // If the user explicitly picked a freezer vial, auto-recon it first so
        // stock location and depletion math stay consistent with "in-use fridge vial".
        if(vial&&vial.location==='freezer'){
          vial.location='fridge';
          vial.reconDate=shot.date||td();
          if(!vial.reconExpDays)vial.reconExpDays=pepInv.reconExpDays||28;
          if(!vial.reconBacMl)vial.reconBacMl=+pepInv.reconBacMl||0;
          const bacMl=+vial.reconBacMl||0;
          if(bacMl>0){
            const bacSupply=S.inv.find(x=>x.isSupply&&x.supplyKind==='bac');
            if(bacSupply)bacSupply.dk=Math.max(0,(bacSupply.dk||0)-Math.ceil(bacMl));
          }
          autoReconned=true;
        }
        // No fridge vial available -> auto-recon the oldest freezer vial.
        // This now applies to any shot date, so logging a shot always moves the
        // in-use vial to fridge when needed.
        if(!vial){
          const fzVial=pickFreezerVial(shot.peptide);
          if(fzVial){
            fzVial.location='fridge';
            fzVial.reconDate=shot.date||td();
            if(!fzVial.reconExpDays)fzVial.reconExpDays=pepInv.reconExpDays||28;
            if(!fzVial.reconBacMl)fzVial.reconBacMl=+pepInv.reconBacMl||0;
            const bacMl=+fzVial.reconBacMl||0;
            if(bacMl>0){
              const bacSupply=S.inv.find(x=>x.isSupply&&x.supplyKind==='bac');
              if(bacSupply)bacSupply.dk=Math.max(0,(bacSupply.dk||0)-Math.ceil(bacMl));
            }
            vial=fzVial;
            autoReconned=true;
          }
        }
        if(vial){
          if(doseMcg>0){
            vial.remainingMcg=Math.max(0,vial.remainingMcg-doseMcg);
            if(vial.remainingMcg<=0){
              vial.status='depleted';
              vial.depletedDate=td();
            }
          }
          shot.vialId=vial.id;
          recomputeStockFromVials(shot.peptide);
        }
      }else{
        // Legacy fallback: peptide has no vial rows yet. If freezer stock exists
        // and no fridge stock is active, auto-move one vial to fridge on shot log.
        if(pepInv&&(pepInv.fz||0)>0&&(pepInv.fr||0)===0){
          pepInv.fz=Math.max(0,pepInv.fz-1);
          pepInv.fr=(pepInv.fr||0)+1;
          pepInv.reconDate=shot.date||fmD(new Date());
          if(!pepInv.reconExpDays)pepInv.reconExpDays=28;
          const bacMl=+pepInv.reconBacMl||0;
          if(bacMl>0){
            const bacSupply=S.inv.find(x=>x.isSupply&&x.supplyKind==='bac');
            if(bacSupply)bacSupply.dk=Math.max(0,(bacSupply.dk||0)-Math.ceil(bacMl));
          }
          autoReconned=true;
        }
      }
    }
    // SHOT-PERSIST-R1: flush immediately so a tab close / stale tab cannot
    // drop a just-logged shot that was still sitting in the 150ms debounce.
    try{if(typeof saveNow==='function')saveNow();else save();}catch(_){try{save();}catch(__){}}
    try{if(typeof window.tmpBackupSnapshot==='function')window.tmpBackupSnapshot();}catch(_){}
    try{if(typeof window.tmpRequestBackupReminder==='function')window.tmpRequestBackupReminder('shot');}catch(_){}
    sv('lg-dose','');sv('lg-vol','');sv('lg-notes','');
    try{sv('lg-vol-unit','mL');}catch(_){}
    if(loggedSite)stickLgInjectionSite(loggedSite);
    // v33.375-stable-vendor-post-import-review: floating toast — visible no matter where the user is scrolled.
    // Plus inline lg-msg as a backup in case the toast div is missing.
    var _logMsg = autoReconned ? '✓ Shot logged · vial moved freezer→fridge' : '✓ Shot logged!';
    // v33.375-stable-vendor-post-import-review: inline toast — directly create the DOM element here so it can never
    // fail due to scope / helper-not-defined / cached-old-version issues.
    (function(){
      try {
        var t = document.getElementById('tmp-inv-toast');
        if(!t){
          t = document.createElement('div');
          t.id = 'tmp-inv-toast';
          t.style.cssText = 'position:fixed;left:50%;bottom:80px;transform:translateX(-50%);z-index:2147483647;padding:12px 24px;border-radius:10px;color:#fff;font-weight:700;font-size:14px;box-shadow:0 12px 32px rgba(0,0,0,.28),0 0 0 .5px rgba(255,255,255,.20) inset;display:none;font-family:inherit;letter-spacing:.01em;max-width:90vw;text-align:center;pointer-events:none';
          document.body.appendChild(t);
        }
        t.style.background = 'linear-gradient(135deg,#10B981,#059669)';
        t.textContent = _logMsg;
        t.style.display = 'block';
        t.style.opacity = '1';
        t.style.transition = '';
        if(window._tmpInvToastTimer) clearTimeout(window._tmpInvToastTimer);
        window._tmpInvToastTimer = setTimeout(function(){
          t.style.transition = 'opacity .35s ease';
          t.style.opacity = '0';
          setTimeout(function(){ t.style.display='none'; t.style.transition=''; }, 380);
        }, 2800);
      } catch(err){
        console.error('[shot-log toast] failed:', err);
      }
    })();
    m.textContent = _logMsg;
    m.style.color = '#0F6E56';
    setTimeout(()=>{m.textContent='';}, 2400);
    // Capture the just-saved shot's id so we can highlight its row after re-render
    window._lgFlashShotId = (S.shots[S.shots.length-1] && S.shots[S.shots.length-1].id) || null;
    refreshAfterShotChange();
    if(autoReconned) try { renderInv && renderInv(); } catch(e){}
    // Belt+suspenders: re-call renderLog after a short delay in case the first
    // pass raced something. Then flash the new row briefly.
    setTimeout(function(){
      try { renderLogShotRows && renderLogShotRows(); } catch(_){}
      try {
        var sid = window._lgFlashShotId;
        if(!sid) return;
        var row = document.querySelector('#lg-tbody [data-sid="'+sid+'"]');
        var tr = row && row.closest('tr');
        if(tr){
          tr.style.transition = 'background-color .2s ease';
          var orig = tr.style.backgroundColor;
          tr.style.backgroundColor = '#D1FAE5';
          setTimeout(function(){ tr.style.backgroundColor = orig; }, 1400);
          tr.scrollIntoView({behavior:'smooth', block:'center'});
        }
      } catch(_){}
    }, 80);
    // After save+render, if this peptide isn't on the schedule yet, prompt.
    try {
      if(typeof window.ptShowSchedulePrompt === 'function'){
        const _schedCheck=typeof window.ptIsPeptideScheduled==='function'
          ?window.ptIsPeptideScheduled(shot.peptide)
          :[0,1,2,3,4,5,6].some(di=>S.sched[shot.peptide+'/am/'+di]||S.sched[shot.peptide+'/pm/'+di]||S.sched[shot.peptide+'/breakfast/'+di]||S.sched[shot.peptide+'/lunch/'+di]||S.sched[shot.peptide+'/dinner/'+di]||S.sched[shot.peptide+'/bedtime/'+di]);
        if(!_schedCheck){
          requestAnimationFrame(()=>window.ptShowSchedulePrompt(shot.peptide,{justLoggedDate:shot.date,justLoggedTime:shot.time}));
        }
      }
    } catch(_){}
  });
  // When user selects "pill" unit, the Volume field becomes irrelevant — dim it and prefill
  function syncLgPillMode(){
    const isPill=gv('lg-dose-unit')==='pill';
    const volWrap=g('lg-vol').closest('div.fg3>div, div.fg2>div')||g('lg-vol').parentElement.parentElement;
    const siteLabel=g('lg-site');
    if(isPill){
      g('lg-vol').value='';
      g('lg-vol').disabled=true;
      g('lg-vol').placeholder='n/a for pills';
      g('lg-vol-unit').disabled=true;
      if(volWrap)volWrap.style.opacity='.5';
      // Also default the site to "Oral" when taking a pill
      if(siteLabel){
        let hasOral=false;
        for(const opt of siteLabel.options){if(opt.value==='Oral'){hasOral=true;break;}}
        if(!hasOral){const o=document.createElement('option');o.value='Oral';o.textContent='Oral';siteLabel.insertBefore(o,siteLabel.firstChild);}
        _lgSiteAutofillGuard=true;
        siteLabel.value='Oral';
        _lgSiteAutofillGuard=false;
      }
    }else{
      g('lg-vol').disabled=false;
      g('lg-vol').placeholder='0.25';
      g('lg-vol-unit').disabled=false;
      if(volWrap)volWrap.style.opacity='';
    }
  }
  g('lg-dose-unit').addEventListener('change',syncLgPillMode);
  syncLgPillMode();
  /* v33.375-stable-vendor-post-import-review: simple native time input + Now button. AM/PM derived for legacy. */
  (function(){
    var clock = g('lg-time-clock');
    var legacy = g('lg-time');
    if(!clock || !legacy) return;
    function pad(x){ return String(x).padStart(2,'0'); }
    function syncFromClock(){
      var v = clock.value || '';
      var m = v.match(/^(\d{1,2}):/);
      if(!m) return;
      var hr = parseInt(m[1], 10);
      legacy.value = (hr < 12) ? 'am' : 'pm';
    }
    clock.addEventListener('change', syncFromClock);
    clock.addEventListener('input', syncFromClock);
    // LG-CLOCK-STALE-R1: the clock was set once at page load and never
    // refreshed, so a tab/PWA left open overnight kept showing last night's
    // time (e.g. "9:10 PM" at 5:35 AM). Track whether the USER edited the
    // field (isTrusted distinguishes real input from our synthetic change
    // events); auto-refresh to "now" only when they haven't.
    function markUserSet(e){ if(e && e.isTrusted) window._lgTimeUserSet = true; }
    clock.addEventListener('change', markUserSet);
    clock.addEventListener('input', markUserSet);
    function setTime(hhmm){
      clock.value = hhmm;
      syncFromClock();
      try { clock.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){}
    }
    function refreshToNow(force){
      if(!force && window._lgTimeUserSet) return;
      var n = new Date();
      setTime(pad(n.getHours())+':'+pad(n.getMinutes()));
      window._lgTimeUserSet = false;
    }
    window._refreshLgClockToNow = refreshToNow;
    var nowBtn = g('lg-time-now');
    if(nowBtn){
      nowBtn.addEventListener('click', function(){
        refreshToNow(true); // explicit "Now" click re-arms auto-refresh
      });
    }
    // Initialize to current clock time so the field never shows blank
    if(!clock.value){
      refreshToNow(true);
    }
    // LG-CLOCK-STALE-R1: when the tab comes back to the foreground while the
    // Shot Log page is showing (phone unlocked in the morning, PWA resumed),
    // pull the clock forward to the real current time.
    document.addEventListener('visibilitychange', function(){
      if(document.visibilityState !== 'visible') return;
      var lp = g('pg-log');
      if(lp && lp.style.display !== 'none') refreshToNow(false);
    });
    window._setLgTime = setTime;
  })();
  /* v33.375-stable-vendor-post-import-review+v33.375-stable-vendor-post-import-review: live "Logging for: …" preview using calendar-day diff
     (not millisecond/round which broke when dv noon vs today midnight rounded to 1) */
  (function(){
    var dateEl = g('lg-date');
    var clockEl = g('lg-time-clock');
    var legacyEl = g('lg-time');
    var preview = g('lg-when-text');
    if(!preview) return;
    function dayDiffCal(dv){
      // Compare YYYY-MM-DD components against today's local components.
      // Return a signed integer: 0 = today, -1 = yesterday, +1 = tomorrow, etc.
      var m = (dv||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if(!m) return null;
      var dY = parseInt(m[1],10), dM = parseInt(m[2],10)-1, dD = parseInt(m[3],10);
      var t = new Date();
      // Use UTC math on date-only values to skip DST shenanigans
      var msD = Date.UTC(dY, dM, dD);
      var msT = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
      return Math.round((msD - msT) / 86400000);
    }
    function fmtTime(hhmm){
      if(!hhmm) return '';
      var m = hhmm.match(/^(\d{1,2}):(\d{2})/);
      if(!m) return hhmm;
      var h24 = parseInt(m[1],10);
      var ampm = h24 < 12 ? 'AM' : 'PM';
      var h12 = h24 % 12; if(h12 === 0) h12 = 12;
      return h12 + ':' + m[2] + ' ' + ampm;
    }
    function fmt(){
      try {
        var dv = (dateEl && dateEl.value) || '';
        var tv = (clockEl && clockEl.value) || '';
        if(!dv) { preview.textContent = 'today'; return; }
        var d = new Date(dv + 'T12:00:00');
        if(isNaN(d.getTime())) { preview.textContent = dv; return; }
        var dayName = d.toLocaleDateString('en-US', {weekday:'long', month:'short', day:'numeric'});
        var diff = dayDiffCal(dv);
        var rel = diff === 0 ? 'today'
                : diff === -1 ? 'yesterday'
                : diff < 0 ? Math.abs(diff)+' days ago'
                : diff === 1 ? 'tomorrow'
                : 'in '+diff+' days';
        var label = dayName + ' (' + rel + ')';
        var t12 = fmtTime(tv);
        if(t12) label += ' at ' + t12;
        preview.textContent = label;
      } catch(_){ preview.textContent = 'today'; }
    }
    fmt();
    if(dateEl){ dateEl.addEventListener('change', fmt); dateEl.addEventListener('input', fmt);
      if(!dateEl._focusSyncWired){
        dateEl._focusSyncWired=true;
        dateEl.addEventListener('change',function(){
          const iso=typeof normalizeIsoDate==='function'?normalizeIsoDate(this.value):this.value;
          if(iso&&typeof setFocusDate==='function')setFocusDate(iso);
        });
      }
    }
    if(clockEl){ clockEl.addEventListener('change', fmt); clockEl.addEventListener('input', fmt); }
    var yestBtn = g('lg-date-yest'); if(yestBtn) yestBtn.addEventListener('click', function(){ setTimeout(fmt, 0); });
    var todayBtn = g('lg-date-today'); if(todayBtn) todayBtn.addEventListener('click', function(){ setTimeout(fmt, 0); });
    var nowBtn = g('lg-time-now'); if(nowBtn) nowBtn.addEventListener('click', function(){ setTimeout(fmt, 0); });
  })();
  /* v33.375-stable-vendor-post-import-review: Yesterday / Today quick-buttons for late-night back-dating */
  (function(){
    var dateEl = g('lg-date');
    var yestBtn = g('lg-date-yest');
    var todayBtn = g('lg-date-today');
    var clockEl = g('lg-time-clock');
    var legacyTime = g('lg-time');
    if(!dateEl) return;
    function shiftDate(deltaDays){
      var v = dateEl.value;
      var d;
      if(v){
        // Parse YYYY-MM-DD as a local-noon date so timezone never shifts it
        d = new Date(v + 'T12:00:00');
      } else {
        d = new Date();
      }
      if(isNaN(d.getTime())) d = new Date();
      d.setDate(d.getDate() + deltaDays);
      var pad = function(n){ return String(n).padStart(2,'0'); };
      dateEl.value = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
    }
    if(yestBtn){
      yestBtn.addEventListener('click', function(){
        shiftDate(-1);
        // Smart default: if the user is back-dating into late-night territory,
        // assume they took the shot at 22:00 PM unless the time has been edited
        // away from the auto-default. Only nudge when the current clock time is
        // before noon (i.e. they're filling out the form in the morning).
        try {
          var nowHr = new Date().getHours();
          if(nowHr < 12 && clockEl && clockEl.value){
            var cur = clockEl.value;
            var m = cur.match(/^(\d{1,2}):/);
            if(m){
              var hh = parseInt(m[1], 10);
              if(Math.abs(hh - nowHr) <= 4){
                if(typeof window._setLgTime === 'function'){ window._setLgTime('22:00'); }
                else { clockEl.value = '22:00'; if(legacyTime) legacyTime.value = 'pm'; }
                // LG-CLOCK-STALE-R1: the 22:00 back-date nudge is deliberate —
                // protect it from the page-activation auto-refresh-to-now.
                window._lgTimeUserSet = true;
              }
            }
          }
        } catch(_){}
      });
    }
    if(todayBtn){
      todayBtn.addEventListener('click', function(){
        var d = new Date();
        var pad = function(n){ return String(n).padStart(2,'0'); };
        dateEl.value = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
      });
    }
  })();
    g('lg-tbody').addEventListener('click',e=>{
    // Peptide pill button → open dose history chart
    const pb=e.target.closest('.lg-pep-btn');
    if(pb){e.stopPropagation();showPeptideChart(pb.dataset.pep);return;}
    // v33.375-stable-vendor-post-import-review: per-row Delete button (🗑) handled inline — no navigation
    const dbtn=e.target.closest('.lg-row-del');
    if(dbtn){
      e.stopPropagation();
      const sid=parseInt(dbtn.dataset.sid,10);
      if(!sid) return;
      const shot=S.shots.find(x=>x.id===sid);
      if(!shot) return;
      if(!confirm('Delete this '+shot.peptide+' shot from '+shot.date+' '+(shot.time||'').toUpperCase()+'?')) return;
      const idx=S.shots.indexOf(shot);
      // Credit dose back to vial if applicable
      if(shot.vialId){
        const v=S.vials.find(x=>x.id===shot.vialId);
        if(v){
          const mcg=doseToMcg(shot.dose,shot.doseUnit||'mcg');
          if(mcg>0){
            v.remainingMcg=Math.min(v.totalMcg,v.remainingMcg+mcg);
            if(v.remainingMcg>0&&v.status==='depleted'){ v.status='active'; delete v.depletedDate; }
            recomputeStockFromVials(v.peptideName);
          }
        }
      }
      S.shots=S.shots.filter(x=>x.id!==sid);
      save();
      try{ refreshAfterShotChange(); }catch(_){}
      try{ showUndoToast(shot,idx); }catch(_){}
      return;
    }
    // Multi-select checkbox handled separately via change event below
    const cb=e.target.closest('.lg-row-chk');
    if(cb){ e.stopPropagation(); return; }
    // Click anywhere else on row: just open dose-history chart for that peptide.
    const b=e.target.closest('[data-sid]');
    if(!b) return;
    const s=S.shots.find(x=>x.id===parseInt(b.dataset.sid));
    if(s) showLogEdit(s.id);
  });
  // v33.375-stable-vendor-post-import-review: Multi-select bulk delete
  document.addEventListener('change', e => {
    if(!e.target.classList || !e.target.classList.contains('lg-row-chk')) return;
    updateBulkDelBar();
  });
  function updateBulkDelBar(){
    const bar = g('lg-bulk-bar');
    if(!bar) return;
    const checked = document.querySelectorAll('#lg-tbody .lg-row-chk:checked');
    bar.style.display = checked.length ? 'flex' : 'none';
    const lbl = g('lg-bulk-count');
    if(lbl) lbl.textContent = checked.length;
  }
  window.updateBulkDelBar = updateBulkDelBar;
  // v33.375-stable-vendor-post-import-review: bulk delete handler
  (function(){
    var btn = g('lg-bulk-del');
    var clr = g('lg-bulk-clear');
    if(btn){
      btn.addEventListener('click', function(){
        var checked = document.querySelectorAll('#lg-tbody .lg-row-chk:checked');
        if(!checked.length) return;
        if(!confirm('Delete '+checked.length+' shot'+(checked.length===1?'':'s')+'? This cannot be undone individually.')) return;
        var ids = [];
        checked.forEach(function(cb){ var sid=parseInt(cb.dataset.sid,10); if(sid) ids.push(sid); });
        // Credit doses back to vials before removing
        ids.forEach(function(sid){
          var shot = S.shots.find(function(x){return x.id===sid;});
          if(shot && shot.vialId){
            var v = S.vials.find(function(x){return x.id===shot.vialId;});
            if(v){
              var mcg = doseToMcg(shot.dose, shot.doseUnit||'mcg');
              if(mcg>0){
                v.remainingMcg = Math.min(v.totalMcg, v.remainingMcg+mcg);
                if(v.remainingMcg>0 && v.status==='depleted'){ v.status='active'; delete v.depletedDate; }
                recomputeStockFromVials(v.peptideName);
              }
            }
          }
        });
        S.shots = S.shots.filter(function(s){ return ids.indexOf(s.id) < 0; });
        save();
        try { refreshAfterShotChange(); } catch(_){}
        var bar = g('lg-bulk-bar'); if(bar) bar.style.display='none';
        try {
          var t = g('undo-toast');
          if(t){
            g('undo-msg').textContent = ids.length + ' shot' + (ids.length===1?'':'s') + ' deleted.';
            t.style.display = 'flex';
            t.dataset.bulk = '1';
            setTimeout(function(){ t.style.display='none'; delete t.dataset.bulk; }, 5000);
          }
        } catch(_){}
      });
    }
    if(clr){
      clr.addEventListener('click', function(){
        document.querySelectorAll('#lg-tbody .lg-row-chk:checked').forEach(function(cb){ cb.checked = false; });
        updateBulkDelBar();
      });
    }
  })();
  g('inv-search').addEventListener('input',debouncedRenderInv);
  // v0.27.36: inv-collapse wiring moved out of init() to standalone IIFE at body end.
  g('inv-tbody').addEventListener('click',e=>{
    // v0.27.12 / v0.27.13: family-rollup toggle. Click on the toggle row
    // expands or collapses non-primary rows in the same family.
    const fb = e.target.closest('.inv-fam-toggle');
    if(fb){
      e.stopPropagation();
      const fk = fb.dataset.famkey;
      if(fk){
        const wasExpanded = fb.getAttribute('aria-expanded') === 'true';
        if(wasExpanded) _invFamExpanded.delete(fk); else _invFamExpanded.add(fk);
        _invFamSaveExpanded();
        fb.setAttribute('aria-expanded', wasExpanded ? 'false' : 'true');
        // Update chevron + label in place
        const arrow = fb.querySelector('.inv-fam-arrow');
        const lblSpan = fb.querySelector('span:nth-of-type(2)');
        const tb = e.target.closest('tbody');
        let count = 0;
        if(tb) count = tb.querySelectorAll('tr[data-iid][data-famkey="'+fk+'"]:not([data-fam-primary])').length;
        if(arrow) arrow.textContent = wasExpanded ? '⌄' : '⌃';
        if(lblSpan) lblSpan.textContent = wasExpanded
          ? ('Show ' + count + ' more variant' + (count===1?'':'s'))
          : ('Hide ' + count + ' variant' + (count===1?'':'s'));
        if(tb){
          tb.querySelectorAll('tr[data-iid][data-famkey="'+fk+'"]:not([data-fam-primary])').forEach(r => {
            r.style.display = wasExpanded ? 'none' : '';
          });
        }
      }
      return;
    }
    // Recon button: Freezer -1, Fridge +1, set reconDate=today, also deplete BAC water.
    // Vial-aware path: if this peptide has vials, move the oldest freezer vial
    // to the fridge and stamp its reconDate. Otherwise fall back to the legacy
    // bucket-count move (for peptides added before vial tracking).
    // Rule: only one reconstituted vial per peptide at a time — button only appears when fridge=0.
    const rb=e.target.closest('.inv-recon-btn');
    if(rb){
      e.stopPropagation();
      const it=S.inv.find(i=>i.id===parseInt(rb.dataset.rid));
      if(!it)return;
      const pad=n=>String(n).padStart(2,'0');
      const d=new Date(),today=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
      const bacMl=+it.reconBacMl||0;
      const bacSupply=S.inv.find(x=>x.isSupply&&x.supplyKind==='bac');
      // v0.27.16: same pre-recon hint as the per-vial path. Only fires
      // when this peptide has vial records (not legacy bucket-count items).
      if(hasVials(it.name)){
        const _siblings = _ptCountReconCandidates(it.name, null);
        if(_siblings >= 2){  // >=2 because picking the oldest freezer vial leaves N-1; 2 means there are 2+ candidates
          const _ok = confirm(
            'This peptide has ' + _siblings + ' un-reconstituted vials.\n\n' +
            'If you want to combine them into one pen, click Cancel and use the 🔀 Pool vials button instead — it does both reconstitution and combining in one step.\n\n' +
            'OK = Recon the oldest one\n' +
            'Cancel = Open the Pool wizard'
          );
          if(!_ok){
            if(typeof window.openPoolVialsModal === 'function'){
              window.openPoolVialsModal();
              setTimeout(() => {
                const sel = document.getElementById('vl-pool-pep');
                if(sel){ sel.value = it.name; try{ sel.dispatchEvent(new Event('change')); }catch(_){} }
              }, 120);
            }
            return;
          }
        }
        const fzVial=pickFreezerVial(it.name);
        if(fzVial&&!fridgeVialsFor(it.name).length){
          fzVial.location='fridge';
          fzVial.reconDate=today;
          if(!fzVial.reconExpDays)fzVial.reconExpDays=it.reconExpDays||28;
          if(!fzVial.reconBacMl)fzVial.reconBacMl=bacMl;
          if(bacMl>0&&bacSupply)bacSupply.dk=Math.max(0,(bacSupply.dk||0)-Math.ceil(bacMl));
          recomputeStockFromVials(it.name);
          save();renderInv();if(typeof renderVials==='function')renderVials();
        }
      }else if(it.fz>0&&(it.fr||0)===0){
        // Legacy path
        it.fz=Math.max(0,it.fz-1);it.fr=(it.fr||0)+1;
        it.reconDate=today;
        if(!it.reconExpDays)it.reconExpDays=28;
        if(bacMl>0&&bacSupply)bacSupply.dk=Math.max(0,(bacSupply.dk||0)-Math.ceil(bacMl));
        save();renderInv();
      }
      return;
    }
    // Used button: mark the active fridge vial depleted (or, in legacy mode,
    // decrement the fr counter). Vial-aware path lets us keep the depleted vial
    // around as historical record (status='depleted', remainingMcg=0) so the
    // Vials section can still show "you ran this from May 3 → June 2".
    const ub=e.target.closest('.inv-used-btn');
    if(ub){
      e.stopPropagation();
      const it=S.inv.find(i=>i.id===parseInt(ub.dataset.uid));
      if(!it)return;
      if(hasVials(it.name)){
        const vial=pickFridgeVial(it.name);
        if(vial){
          vial.remainingMcg=0;
          vial.status='depleted';
          vial.depletedDate=td();
          recomputeStockFromVials(it.name);
          save();renderInv();if(typeof renderVials==='function')renderVials();
        }
      }else if((it.fr||0)>0){
        it.fr=Math.max(0,(it.fr||0)-1);
        if(it.fr===0)delete it.reconDate;
        save();renderInv();
      }
      return;
    }
    // Chart button
    const cb=e.target.closest('.inv-chart-btn');
    if(cb){
      e.stopPropagation();swapId=null;delConfirmId=null;
      const it=S.inv.find(i=>i.id===parseInt(cb.dataset.cid));
      if(it)showPeptideChart(it.name);
      return;
    }
    // Edit button
    const eb=e.target.closest('.inv-edit-btn');
    if(eb){
      e.stopPropagation();swapId=null;delConfirmId=null;
      const it=S.inv.find(i=>i.id===parseInt(eb.dataset.eid));
      if(it) openPepEditor(it);
      return;
    }
    // Delete button — show inline confirm on the row
    const db=e.target.closest('.inv-del-btn');
    if(db){
      e.stopPropagation();swapId=null;
      delConfirmId=parseInt(db.dataset.did);
      renderInv();return;
    }
    // Confirm yes — actually delete
    const yb=e.target.closest('.inv-del-yes');
    if(yb){
      e.stopPropagation();
      const id=parseInt(yb.dataset.did);
      const nm=S.inv.find(i=>i.id===id)?.name;
      S.inv=S.inv.filter(i=>i.id!==id);
      if(nm){S.shots=S.shots.filter(s=>s.peptide!==nm);for(let di=0;di<7;di++){delete S.sched[sk(nm,'am',di)];delete S.sched[sk(nm,'pm',di)];}}
      rebuildCM();buildLegend();save();popSel();
      delConfirmId=null;renderInv();rr();return;
    }
    // Confirm no — cancel
    const nb=e.target.closest('.inv-del-no');
    if(nb){e.stopPropagation();delConfirmId=null;renderInv();return;}
    // v0.27.61: row-click swap is now OPT-IN. Without _invSwapMode set,
    // clicking on a row does nothing (avoids accidentally entering swap mode
    // and intercepting Delete/Edit clicks).
    if(!window._invSwapMode) return;
    const row=e.target.closest('[data-iid]');
    if(!row)return;
    const clickedId=parseInt(row.dataset.iid);
    if(swapId===null){
      swapId=clickedId;renderInv();
    } else if(swapId===clickedId){
      swapId=null;renderInv();
    } else {
      const idxA=S.inv.findIndex(i=>i.id===swapId);
      const idxB=S.inv.findIndex(i=>i.id===clickedId);
      if(idxA>=0&&idxB>=0){[S.inv[idxA],S.inv[idxB]]=[S.inv[idxB],S.inv[idxA]];save();rr();}
      swapId=null;renderInv();
    }
  });
  // ───────────── Vials card wiring ─────────────
  // Expand/collapse — persists in localStorage so the user's preference sticks.
  (function(){
    const expandBtn=g('vl-expand-btn'),body=g('vials-body');
    if(!expandBtn||!body)return;
    let open=false;
    try{open=localStorage.getItem('tmp_vials_open')==='1';}catch(e){}
    const apply=()=>{body.style.display=open?'block':'none';expandBtn.textContent=open?'Hide vials':'Show vials';if(open)requestAnimationFrame(()=>renderVials(false));};
    apply();
    expandBtn.addEventListener('click',()=>{open=!open;try{localStorage.setItem('tmp_vials_open',open?'1':'0');}catch(e){}apply();});
  })();
  // Add vial(s) → open form in add mode
  const addBtn=g('vl-add-btn');
  if(addBtn)addBtn.addEventListener('click',()=>{openVialForm(null);});
  const closeBtn=g('vl-close'),cancelBtn=g('vl-cancel'),saveBtn=g('vl-save'),delBtn=g('vl-del');
  if(closeBtn)closeBtn.addEventListener('click',closeVialForm);
  if(cancelBtn)cancelBtn.addEventListener('click',closeVialForm);
  if(saveBtn)saveBtn.addEventListener('click',()=>{saveVialForm();});
  if(delBtn)delBtn.addEventListener('click',()=>{
    if(!_vlEditingId)return;
    const v=S.vials.find(x=>x.id===_vlEditingId);if(!v)return;
    // Inline confirm: clicking once arms a "Confirm delete" message; second click commits.
    if(delBtn.dataset.armed==='1'){
      const pep=v.peptideName;
      S.vials=S.vials.filter(x=>x.id!==_vlEditingId);
      recomputeStockFromVials(pep);
      save();closeVialForm();scheduleInventoryVialRefresh(true);
      delBtn.dataset.armed='0';delBtn.textContent='Delete this vial';
    }else{
      delBtn.dataset.armed='1';delBtn.textContent='Click again to confirm';
      setTimeout(()=>{delBtn.dataset.armed='0';delBtn.textContent='Delete this vial';},3500);
    }
  });
  // v4: 'Delete all of this peptide' — same 2-step armed-button pattern.
  const delAllBtn=g('vl-del-all');
  if(delAllBtn)delAllBtn.addEventListener('click',()=>{
    if(!_vlEditingId)return;
    const v=S.vials.find(x=>x.id===_vlEditingId);if(!v)return;
    const pep=v.peptideName;
    const cnt=(S.vials||[]).filter(x=>x.peptideName===pep).length;
    if(delAllBtn.dataset.armed==='1'){
      // Commit: remove every vial whose peptideName matches.
      S.vials=(S.vials||[]).filter(x=>x.peptideName!==pep);
      recomputeStockFromVials(pep);
      save();closeVialForm();scheduleInventoryVialRefresh(true);
      delAllBtn.dataset.armed='0';delAllBtn.textContent='Delete all of this peptide';
    } else {
      delAllBtn.dataset.armed='1';
      delAllBtn.textContent='Click again to delete all '+cnt+' '+pep+' vials';
      setTimeout(()=>{delAllBtn.dataset.armed='0';delAllBtn.textContent='Delete all '+cnt+' '+pep+' vials';},3500);
    }
  });
  // Location dropdown reveals/hides recon fields
  const locSel=g('vl-loc');
  if(locSel)locSel.addEventListener('change',syncVialReconFields);
  // Search / filter inputs re-render (search debounced — was freezing on every keystroke)
  const vlSearch=g('vl-search');
  if(vlSearch)vlSearch.addEventListener('input',debouncedRenderVials);
  ['vl-filter-loc','vl-filter-pep'].forEach(id=>{
    const el=g(id);if(el)el.addEventListener('change',()=>renderVials(false));
  });
  // Show history toggle
  const histBtn=g('vl-toggle-depleted');
  if(histBtn)histBtn.addEventListener('click',()=>{
    _vlShowDepleted=!_vlShowDepleted;
    histBtn.textContent=_vlShowDepleted?'Hide history':'Show history';
    histBtn.style.background=_vlShowDepleted?'rgba(139,92,246,.15)':'rgba(255,255,255,.55)';
    renderVials(false);
  });
  // Per-row actions on vials list
  const vlList=g('vl-list');
  if(vlList)vlList.addEventListener('click',e=>{
    // v0.27.5: group header toggle (handle BEFORE per-row actions so clicks
    // on the header don't fall through to row buttons).
    const gh = e.target.closest('.vl-group-header');
    if(gh){
      const name = gh.dataset.grp;
      if(name){
        const wasCollapsed = gh.getAttribute('aria-expanded') === 'false';
        // Toggle: flip the user's explicit preference for this group.
        if(wasCollapsed){
          _vlExpanded.add(name); _vlCollapsed.delete(name);
        } else {
          _vlCollapsed.add(name); _vlExpanded.delete(name);
        }
        _vlSaveCollapse();
        // Update DOM in place (no full re-render needed)
        const body = vlList.querySelector('.vl-group-body[data-grp="'+name.replace(/"/g,'\\"')+'"]');
        const arrow = gh.querySelector('.vl-group-arrow');
        if(wasCollapsed){
          if(body) body.style.display = '';
          if(arrow) arrow.style.transform = 'rotate(90deg)';
          gh.setAttribute('aria-expanded','true');
        } else {
          if(body) body.style.display = 'none';
          if(arrow) arrow.style.transform = '';
          gh.setAttribute('aria-expanded','false');
        }
      }
      return;
    }
    // v0.27.8: batch sub-header toggle (nested inside peptide group)
    const bh = e.target.closest('.vl-batch-header');
    if(bh){
      const key = bh.dataset.batchkey;
      if(key){
        const wasCollapsed = bh.getAttribute('aria-expanded') === 'false';
        if(wasCollapsed){
          _vlExpanded.add(key); _vlCollapsed.delete(key);
        } else {
          _vlCollapsed.add(key); _vlExpanded.delete(key);
        }
        _vlSaveCollapse();
        const body = vlList.querySelector('.vl-batch-body[data-batchkey="'+key.replace(/"/g,'\\"')+'"]');
        const arrow = bh.querySelector('.vl-batch-arrow');
        if(wasCollapsed){
          if(body) body.style.display = '';
          if(arrow) arrow.style.transform = 'rotate(90deg)';
          bh.setAttribute('aria-expanded','true');
        } else {
          if(body) body.style.display = 'none';
          if(arrow) arrow.style.transform = '';
          bh.setAttribute('aria-expanded','false');
        }
      }
      return;
    }
    const findV=el=>S.vials.find(v=>v.id===parseInt(el.dataset.vid));
    // Recon — move freezer vial to fridge, stamp recon date, decrement BAC
    const rb=e.target.closest('.vl-row-recon');
    if(rb){
      const v=findV(rb);if(!v)return;
      if(v.location!=='freezer')return;
      // v0.27.16: if 1+ other freezer vials of this peptide exist, nudge
      // user toward the Pool wizard before reconning singly.
      const _siblings = _ptCountReconCandidates(v.peptideName, v.id);
      if(_siblings >= 1){
        const _ok = confirm(
          'This peptide has ' + _siblings + ' other un-reconstituted vial' + (_siblings===1?'':'s') + '.\n\n' +
          'If you want to combine them into one pen, click Cancel and use the 🔀 Pool vials button instead — it does both reconstitution and combining in one step.\n\n' +
          'OK = Recon just this vial\n' +
          'Cancel = Open the Pool wizard'
        );
        if(!_ok){
          if(typeof window.openPoolVialsModal === 'function'){
            window.openPoolVialsModal();
            setTimeout(() => {
              const sel = document.getElementById('vl-pool-pep');
              if(sel){ sel.value = v.peptideName; try{ sel.dispatchEvent(new Event('change')); }catch(_){} }
            }, 120);
          }
          return;
        }
      }
      // If another fridge vial already exists for this peptide, allow it but warn via toast?
      // Phase 1: just allow it. The dose-pick logic uses LIFO so it'll prefer the most recent.
      v.location='fridge';
      v.reconDate=td();
      if(!v.reconExpDays)v.reconExpDays=28;
      const inv=S.inv.find(i=>i.name===v.peptideName);
      if(!v.reconBacMl&&inv)v.reconBacMl=+inv.reconBacMl||0;
      const bacMl=+v.reconBacMl||0;
      if(bacMl>0){
        const bacSupply=S.inv.find(x=>x.isSupply&&x.supplyKind==='bac');
        if(bacSupply)bacSupply.dk=Math.max(0,(bacSupply.dk||0)-Math.ceil(bacMl));
      }
      recomputeStockFromVials(v.peptideName);
      save();scheduleInventoryVialRefresh(true);
      return;
    }
    // Used — mark active vial fully used (remaining=0, status=depleted)
    const ub=e.target.closest('.vl-row-used');
    if(ub){
      const v=findV(ub);if(!v)return;
      v.remainingMcg=0;
      v.status='depleted';
      v.depletedDate=td();
      recomputeStockFromVials(v.peptideName);
      save();scheduleInventoryVialRefresh(true);
      return;
    }
    // Discard — vial went bad (failed recon, contamination, etc.). Keeps the
    // row as historical record but marks it inactive so it doesn't count toward
    // stock. Different from Used because it preserves remainingMcg as a hint
    // that the vial wasn't fully consumed.
    const db=e.target.closest('.vl-row-discard');
    if(db){
      const v=findV(db);if(!v)return;
      v.status='discarded';
      v.depletedDate=td();
      recomputeStockFromVials(v.peptideName);
      save();scheduleInventoryVialRefresh(true);
      return;
    }
    // Edit — open form filled with this vial
    const eb=e.target.closest('.vl-row-edit');
    if(eb){
      const v=findV(eb);if(!v)return;
      _vlConfirmDelId=null;
      openVialForm(v);
      return;
    }
    // Delete (inline confirm) — first click arms, second click deletes
    const xb=e.target.closest('.vl-row-del');
    if(xb){
      _vlConfirmDelId=parseInt(xb.dataset.vid);
      renderVials(true);
      return;
    }
    const yb=e.target.closest('.vl-row-del-yes');
    if(yb){
      const id=parseInt(yb.dataset.vid);
      const v=S.vials.find(x=>x.id===id);
      if(v){
        const pep=v.peptideName;
        S.vials=S.vials.filter(x=>x.id!==id);
        recomputeStockFromVials(pep);
        save();
      }
      _vlConfirmDelId=null;scheduleInventoryVialRefresh(true);
      return;
    }
    const nb=e.target.closest('.vl-row-del-no');
    if(nb){_vlConfirmDelId=null;renderVials(true);return;}
  });
  g('btn-install').addEventListener('click',()=>{if(_pwaPrompt){_pwaPrompt.prompt();_pwaPrompt.userChoice.then(()=>{_pwaPrompt=null;g('btn-install').style.display='none';});}});
  g('btn-pep').addEventListener('click',()=>{const vis=g('pepmgr').style.display==='block';g('pepmgr').style.display=vis?'none':'block';if(!vis){pepEId=null;rlPL();swPT('list');setTimeout(()=>g('pepmgr').scrollIntoView({behavior:'smooth',block:'nearest'}),50);}});
  // Privacy modal — accessible open/close with focus management + Escape handler + focus trap.
  (function(){
    const modal=g('privacy-modal');
    const openBtn=g('privacy-btn');
    const closeBtn=g('privacy-close');
    if(!modal||!openBtn||!closeBtn)return;
    let lastFocused=null;
    // Focusable selectors scoped inside the modal's inner panel.
    const focusableSel='a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),iframe,object,embed,[tabindex]:not([tabindex="-1"]),[contenteditable=true]';
    const getFocusable=()=>Array.from(modal.querySelectorAll(focusableSel)).filter(el=>el.offsetParent!==null);
    function openModal(){
      lastFocused=document.activeElement;
      modal.style.display='flex';
      modal.setAttribute('aria-hidden','false');
      // Defer focus to the next tick so the modal is actually painted before we try to focus inside it.
      setTimeout(()=>{const list=getFocusable();(list[0]||closeBtn).focus();},0);
    }
    function closeModal(){
      modal.style.display='none';
      modal.setAttribute('aria-hidden','true');
      if(lastFocused&&typeof lastFocused.focus==='function')lastFocused.focus();
    }
    openBtn.addEventListener('click',openModal);
    closeBtn.addEventListener('click',closeModal);
    // Backdrop click (only when clicking the outer dimmer, not the inner panel)
    modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});
    // Escape to close; Tab/Shift+Tab to trap focus inside the modal while it's open.
    modal.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();closeModal();return;}
      if(e.key==='Tab'){
        const list=getFocusable();
        if(!list.length)return;
        const first=list[0],last=list[list.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    });
  })();
  // Chart modal close handlers
  g('chart-close').addEventListener('click',hidePeptideChart);
  g('undo-x').addEventListener('click',hideUndoToast);
  g('undo-btn').addEventListener('click',()=>{
    const toast=g('undo-toast');
    try{
      if(toast.dataset.type==='sched'){
        // RC-4: restore scheduled cell(s) from snapshot.
        // Only re-writes the exact keys that were deleted — no other sched state touched.
        const snap=JSON.parse(toast.dataset.sched||'{}');
        Object.keys(snap).forEach(k=>{S.sched[k]=snap[k];});
        save();refreshAfterSchedChange();
      } else {
        // Existing logged-shot undo path — unchanged.
        const shot=JSON.parse(toast.dataset.shot);
        const idx=parseInt(toast.dataset.idx)||S.shots.length;
        S.shots.splice(idx,0,shot);
        // Re-debit the vial, mirroring the credit done in confirmDel. If the vial
        // is gone (user deleted it between delete and undo), the shot keeps its
        // dangling vialId — harmless, just a stale back-pointer.
        if(shot.vialId){
          const v=S.vials.find(x=>x.id===shot.vialId);
          if(v){
            const mcg=doseToMcg(shot.dose,shot.doseUnit||'mcg');
            if(mcg>0){
              v.remainingMcg=Math.max(0,v.remainingMcg-mcg);
              if(v.remainingMcg<=0&&v.status==='active'){
                v.status='depleted';
                v.depletedDate=td();
              }
              recomputeStockFromVials(v.peptideName);
            }
          }
        }
        save();refreshAfterShotChange();
      }
    }catch(e){}
    hideUndoToast();
  });
  g('chart-modal').addEventListener('click',e=>{if(e.target.id==='chart-modal')hidePeptideChart();});
  // Trap Tab inside the chart modal — only the Close button is focusable, so Tab/Shift+Tab
  // always lands back on it rather than escaping to the underlying page.
  g('chart-modal').addEventListener('keydown',e=>{
    if(e.key==='Tab'){
      e.preventDefault();
      const btn=g('chart-close');
      if(btn)btn.focus();
    }
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      if(g('chart-modal').style.display==='flex')hidePeptideChart();
      else if(stackHighlight){stackHighlight=null;applyStackHighlight();}
    }
  });
  // Peptide key legend pill row removed.
  // Daily Stack cell click:
  //   plain click → open the action panel with Log shot / View history / Edit peptide / Open in calculator
  //   shift+click → toggle the highlight outline (preserves the old behavior for users
  //                 who relied on it for visual scanning across rows)
  g('pg-stack').addEventListener('click',e=>{
    const cell=e.target.closest('[data-pep]');
    if(!cell)return;
    if(e.shiftKey){
      stackHighlight=cell.dataset.pep===stackHighlight?null:cell.dataset.pep;
      applyStackHighlight();
      return;
    }
    apShowStack(cell.dataset.pep);
  });
  // Theme toggle — cycles between explicit dark and explicit light (overriding the OS preference).
  // If nothing has been chosen yet, the first click flips to the opposite of the currently-displayed theme.
  function currentTheme(){
    const attr=document.documentElement.getAttribute('data-theme');
    if(attr==='dark'||attr==='light')return attr;
    return (window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches)?'dark':'light';
  }
  function updateThemeBtn(){
    const dark=currentTheme()==='dark';
    const icon=dark?'☀️':'🌙';
    g('btn-theme').textContent=icon;
    const hdr=g('btn-theme-hdr');
    if(hdr){
      const iconEl=hdr.querySelector('.tt-icon');
      const hintEl=hdr.querySelector('.tt-hint');
      if(iconEl)iconEl.textContent=icon;
      if(hintEl)hintEl.textContent=dark?'light':'dark';
      hdr.title=dark?'Switch to light mode':'Switch to dark mode';
    }
  }
  updateThemeBtn();
  const hdrBtn=g('btn-theme-hdr');
  if(hdrBtn)hdrBtn.addEventListener('click',()=>g('btn-theme').click());
  g('btn-theme').addEventListener('click',()=>{
    const next=currentTheme()==='dark'?'light':'dark';
    document.documentElement.setAttribute('data-theme',next);
    try{localStorage.setItem('peptideTrackerTheme',next);}catch(e){}
    updateThemeBtn();
    // Keep theme-color meta in sync so the browser chrome matches
    const tc=document.getElementById('meta-theme-color');
    if(tc)tc.content=next==='dark'?'#302f2c':'#ffffff';
  });
  // PWA: register service worker for offline support (optional companion sw.js).
  // If the file isn't deployed alongside the HTML, registration fails silently
  // and the app continues to work — just without SW-level caching. When present,
  // the SW enables true offline use and smart update-on-next-visit caching.
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
  // PWA: intercept Chrome/Android install prompt. Event fires once per page load
  // when the browser has determined the app is installable; we stash it for
  // later use by the install banner's "Install" button.
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();_pwaPrompt=e;
    const btn=g('btn-install');if(btn)btn.style.display='';
    applyInstallBanner();
  });
  window.addEventListener('appinstalled',()=>{
    _pwaPrompt=null;const btn=g('btn-install');if(btn)btn.style.display='none';
    applyInstallBanner();
  });
  // Export: download full state as JSON.
  // Embed a schema version + export metadata at the top of the payload so future app versions
  // can detect format drift and run migrations. All import-time migration logic already lives
  // in load()/runPeptideTrackerImport() — the version field here is the signal those migrations
  // will key off of. Bump TMP_SCHEMA_VERSION when the state shape changes in a breaking way.
  const TMP_SCHEMA_VERSION=1;
  function doExport(prefix){
    // Flush in-memory state (especially vials) before serializing so backups never miss
    // rows that were saved in the UI but not yet written to storage.
    try{if(typeof save==='function')save();}catch(e){console.warn('pre-export save failed:',e);}
    // Clone S and add metadata as top-level fields. ALLOWED_IMPORT_KEYS covers all S fields;
    // the new metadata fields are prefixed with _export_ so they're obviously non-user-data
    // and easy to skip on import without bloating the allow-list.
    const payload=Object.assign(
      {_export_schema:TMP_SCHEMA_VERSION,_export_at:new Date().toISOString(),_export_app:'PeptideGenius'},
      S
    );
    const data=JSON.stringify(payload,null,2);
    const blob=new Blob([data],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    const ts=td();
    a.href=url;a.download=(prefix||'peptide-tracker-')+ts+'.json';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    URL.revokeObjectURL(url);
    try{
      localStorage.setItem('tmp.backupReminder.lastBackupAt',String(Date.now()));
      // After a successful manual backup, quiet regular + event reminders for a week.
      const until=String(Date.now()+7*24*60*60*1000);
      localStorage.setItem('tmp.backupReminder.nextAt',until);
      localStorage.setItem('tmp.backupReminder.nextEventAt',until);
    }catch(_){}
  }
  // Make doExport accessible to the storage-banner's Backup button (defined in outer scope)
  window.doExport=doExport;
  (function wireLogoBackupReveal(){
    let taps=0,tmr=null;
    const gapMs=900;
    const wrap=g('logo-reveal-actions');
    const btn=g('logo-backup-btn');
    const lim=g('logo-import-btn');
    if(!wrap||!btn||!lim)return;
    function goTop(){
      const topBtn=document.getElementById('pt-back-to-top');
      if(topBtn){topBtn.click();return;}
      try{window.scrollTo({top:0,behavior:'smooth'});}
      catch(e){window.scrollTo(0,0);}
    }
    function flushTapWindow(){
      const n=taps;
      taps=0;
      tmr=null;
      if(n>=1&&n<3)goTop();
    }
    // Canonical owner: visible logo image — single click scroll, triple-tap backup reveal.
    const logo=document.querySelector('img.gpt-site-logo');
    if(!logo)return;
    const onTap=e=>{
      e.preventDefault();
      clearTimeout(tmr);
      taps++;
      if(taps>=3){
        clearTimeout(tmr);
        taps=0;
        tmr=null;
        wrap.style.display='flex';
        try{btn.focus();}catch(err){}
        return;
      }
      tmr=setTimeout(flushTapWindow,gapMs);
    };
    logo.addEventListener('click',onTap);
    btn.addEventListener('click',()=>{
      if(typeof window.doExport!=='function'){alert('Please wait for the app to finish loading, then try again.');return;}
      window.doExport('my-tracker-manual-');
      wrap.style.display='none';
    });
    lim.addEventListener('click',()=>{g('import-file').click();});
  })();
  g('import-file').addEventListener('change',e=>{
    const f=e.target.files&&e.target.files[0];if(!f){e.target.value='';return;}
    const inp=e.target;
    const reader=new FileReader();
    reader.onload=ev=>{runPeptideTrackerImport(ev.target.result,()=>{inp.value='';});};
    reader.readAsText(f);
  });
  // Drag a saved tracker file onto the page to import (same as Import).
  (function wireJsonFileDropImport(){
    function isJsonFile(f){return f&&(f.type==='application/json'||/\.json$/i.test(f.name||''));}
    function hasExternalFiles(dt){
      if(!dt||!dt.types)return false;
      try{return Array.from(dt.types).indexOf('Files')>=0;}catch(e){return false;}
    }
    document.addEventListener('dragover',e=>{
      if(!hasExternalFiles(e.dataTransfer))return;
      e.preventDefault();
      e.dataTransfer.dropEffect='copy';
    });
    document.addEventListener('drop',e=>{
      if(!hasExternalFiles(e.dataTransfer))return;
      const f=e.dataTransfer.files&&e.dataTransfer.files[0];
      if(!f||!isJsonFile(f))return;
      e.preventDefault();
      const reader=new FileReader();
      reader.onload=ev=>{runPeptideTrackerImport(ev.target.result,null);};
      reader.readAsText(f);
    });
  })();
  g('pep-x').addEventListener('click',()=>g('pepmgr').style.display='none');
  g('ptl-btn').addEventListener('click',()=>swPT('list'));g('ptf-btn').addEventListener('click',()=>swPT('form'));
  // v0.27.2: Vials tab inside the peptide manager — switches to Inventory page,
  // expands the Vials card, scrolls to it, opens the + Add form.
  (function(){
    const vb = document.getElementById('pt-vials-tab-btn');
    if(!vb) return;
    vb.addEventListener('click', () => {
      // Close the peptide manager so the user lands cleanly on Inventory
      const mgr = document.getElementById('pepmgr');
      if(mgr) mgr.style.display = 'none';
      // Click the Inventory nav so the page switches with all the standard side-effects
      const navBtn = document.querySelector('#nav [data-pg="inventory"]');
      if(navBtn) navBtn.click();
      // Expand the Vials card if collapsed
      const vbody = document.getElementById('vials-body');
      if(vbody && vbody.style.display === 'none'){
        const expandBtn = document.getElementById('vl-expand-btn');
        if(expandBtn) expandBtn.click();
        else vbody.style.display = 'block';
      }
      // Scroll to and pulse the vials card; auto-open the + Add vial form.
      setTimeout(() => {
        const card = document.getElementById('vials-card');
        if(card){
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
          card.style.transition = 'box-shadow .25s ease';
          const oldShadow = card.style.boxShadow;
          card.style.boxShadow = '0 0 0 3px #C4B5FD, 0 4px 14px rgba(139,92,246,.35)';
          setTimeout(() => { card.style.boxShadow = oldShadow; }, 1400);
        }
        const addBtn = document.getElementById('vl-add-btn');
        if(addBtn) addBtn.click();
      }, 150);
    });
  })();
  // ==== Supply add/edit modal (independent of peptide manager) ====
  (function(){
    const modal=g('sup-modal');if(!modal)return;
    let editingId=null;
    window.openSupplyModal=function(supply){
      editingId=supply?supply.id:null;
      if(supply){
        sv('sup-name',supply.name||'');
        sv('sup-kind',supply.supplyKind||'other');
        sv('sup-qty',supply.dk||0);
        sv('sup-unit',supply.customUnit||(supply.supplyKind==='bac'?'mL':'ct'));
        g('sup-title').textContent='Edit supply';
        g('sup-save').textContent='Save changes';
        g('sup-delete').style.display='inline-flex';
        // v4: show 'Delete all of this kind' only when 2+ supplies share this kind
        (function(){
          const allBtn=g('sup-delete-all');if(!allBtn||!editingId)return;
          const it=S.inv.find(i=>i.id===editingId);if(!it){allBtn.style.display='none';return;}
          const kind=it.supplyKind||'other';
          const sameKind=(S.inv||[]).filter(x=>x.isSupply&&((x.supplyKind||'other')===kind));
          if(sameKind.length>=2){
            allBtn.style.display='inline-flex';
            allBtn.dataset.armed='0';
            allBtn.textContent='Delete all '+sameKind.length+' '+kind+' supplies';
          } else {
            allBtn.style.display='none';
          }
        })();
      }else{
        sv('sup-name','');sv('sup-kind','other');sv('sup-qty','');sv('sup-unit','');
        g('sup-title').textContent='Add a new supply';
        g('sup-save').textContent='+ Add supply';
        g('sup-delete').style.display='none';
        (function(){const a=g('sup-delete-all');if(a){a.style.display='none';a.dataset.armed='0';}})();
      }
      g('sup-msg').textContent='';
      modal.style.display='block';
      setTimeout(()=>{const n=g('sup-name');if(n)n.focus();},50);
    };
    const close=()=>{modal.style.display='none';editingId=null;};
    const btn=g('btn-supply-add');if(btn)btn.addEventListener('click',()=>window.openSupplyModal(null));
    g('sup-x').addEventListener('click',close);
    g('sup-cancel').addEventListener('click',close);
    modal.addEventListener('click',e=>{if(e.target===modal)close();});
    g('sup-kind').addEventListener('change',()=>{
      const kind=gv('sup-kind'),unitEl=g('sup-unit');
      if(!unitEl.value.trim()){unitEl.value=kind==='bac'?'mL':'ct';}
    });
    // v4: replaced native confirm() with inline 2-step armed button (matches vial pattern).
    g('sup-delete').addEventListener('click',()=>{
      if(!editingId)return;
      const it=S.inv.find(i=>i.id===editingId);if(!it)return;
      const btn=g('sup-delete');
      if(btn.dataset.armed==='1'){
        S.inv=S.inv.filter(i=>i.id!==editingId);
        save();if(typeof rr==='function')rr();else if(typeof renderInv==='function')renderInv();
        btn.dataset.armed='0';btn.textContent='Delete';
        close();
      } else {
        btn.dataset.armed='1';btn.textContent='Click again to delete '+it.name;
        setTimeout(()=>{btn.dataset.armed='0';btn.textContent='Delete';},3500);
      }
    });
    // v4: 'Delete all of this kind' — wipes every supply with the same supplyKind.
    g('sup-delete-all').addEventListener('click',()=>{
      if(!editingId)return;
      const it=S.inv.find(i=>i.id===editingId);if(!it)return;
      const kind=it.supplyKind||'other';
      const matches=(S.inv||[]).filter(x=>x.isSupply&&((x.supplyKind||'other')===kind));
      const btn=g('sup-delete-all');
      if(btn.dataset.armed==='1'){
        S.inv=(S.inv||[]).filter(x=>!(x.isSupply&&((x.supplyKind||'other')===kind)));
        save();if(typeof rr==='function')rr();else if(typeof renderInv==='function')renderInv();
        btn.dataset.armed='0';btn.textContent='Delete all of this kind';
        close();
      } else {
        btn.dataset.armed='1';
        btn.textContent='Click again to delete all '+matches.length+' '+kind+' supplies';
        setTimeout(()=>{btn.dataset.armed='0';btn.textContent='Delete all '+matches.length+' '+kind+' supplies';},3500);
      }
    });
    g('sup-save').addEventListener('click',()=>{
      const m=g('sup-msg');
      const name=gv('sup-name').trim();
      if(!name){m.textContent='Enter a name.';m.style.color='#A32D2D';return;}
      const dupe=S.inv.find(i=>i.name.toLowerCase()===name.toLowerCase()&&i.id!==editingId);
      if(dupe){m.textContent='A supply or peptide with this name already exists.';m.style.color='#A32D2D';return;}
      const kind=gv('sup-kind')||'other';
      const qty=Math.max(0,parseInt(gv('sup-qty'))||0);
      const unit=gv('sup-unit').trim()||(kind==='bac'?'mL':'ct');
      if(editingId){
        const it=S.inv.find(i=>i.id===editingId);
        if(!it){close();return;}
        it.name=name;it.supplyKind=kind;it.dk=qty;
        it.customUnit=kind==='other'?unit:undefined;
        it.isSupply=true;
      }else{
        if(!S.nI||S.nI<1)S.nI=Math.max(0,...S.inv.map(i=>i.id||0))+1;
        const newId=S.nI++;
        S.inv.push({id:newId,name:name,isSupply:true,supplyKind:kind,customUnit:kind==='other'?unit:undefined,fz:0,fr:0,dk:qty,nd:0,days:[]});
      }
      save();if(typeof rr==='function')rr();else if(typeof renderInv==='function')renderInv();
      m.textContent='Saved!';m.style.color='#0F6E56';
      setTimeout(close,500);
    });
    // Delegated listener for supply tile Edit clicks (supplies-grid is not under inv-tbody)
    const grid=g('supplies-grid');
    if(grid){
      grid.addEventListener('click',e=>{
        const eb=e.target.closest('.inv-edit-btn');
        if(!eb)return;
        e.stopPropagation();
        const id=parseInt(eb.dataset.eid);
        const it=S.inv.find(i=>i.id===id);
        if(it&&it.isSupply)window.openSupplyModal(it);
      });
    }
  })();
  g('pti-btn').addEventListener('click',()=>swPT('inv'));
  // "+ From inventory" quick-add: populate the dropdown with non-supply inventory peptides
  window.popInvAdd=function(){
    const sel=g('pia-sel');
    const items=(S.inv||[]).filter(i=>!i.isSupply&&i.name);
    items.sort((a,b)=>a.name.localeCompare(b.name));
    sel.innerHTML='<option value="">— select from inventory —</option>'+items.map(i=>{
      const inAm=[0,1,2,3,4,5,6].some(di=>S.sched[sk(i.name,'am',di)]);
      const inPm=[0,1,2,3,4,5,6].some(di=>S.sched[sk(i.name,'pm',di)]);
      const tag=inAm&&inPm?' · scheduled AM+PM':inAm?' · scheduled AM':inPm?' · scheduled PM':'';
      return '<option value="'+i.id+'">'+i.name+tag+'</option>';
    }).join('');
    sv('pia-dose','');sv('pia-doseu','mg');sv('pia-stk','am');
    g('pia-daypick').querySelectorAll('.dbtn').forEach(b=>b.classList.remove('on'));
    g('pia-msg').textContent='';
  };
  g('pia-sel').addEventListener('change',()=>{
    const it=S.inv.find(i=>i.id===parseInt(gv('pia-sel')));
    if(!it)return;
    sv('pia-dose',it.dose||'');sv('pia-doseu',it.doseUnit||'mg');
    const amDays=[0,1,2,3,4,5,6].filter(di=>S.sched[sk(it.name,'am',di)]);
    const pmDays=[0,1,2,3,4,5,6].filter(di=>S.sched[sk(it.name,'pm',di)]);
    sv('pia-stk',amDays.length&&pmDays.length?'both':pmDays.length?'pm':'am');
    const allDays=new Set([...amDays,...pmDays]);
    g('pia-daypick').querySelectorAll('.dbtn').forEach(b=>b.classList.toggle('on',allDays.has(parseInt(b.dataset.d))));
    g('pia-msg').textContent='';
  });
  g('pia-daypick').querySelectorAll('.dbtn').forEach(b=>b.addEventListener('click',()=>b.classList.toggle('on')));
  g('pia-cancel').addEventListener('click',()=>swPT('list'));
  g('pia-add').addEventListener('click',()=>{
    const m=g('pia-msg');
    const it=S.inv.find(i=>i.id===parseInt(gv('pia-sel')));
    if(!it){m.textContent='Pick a peptide from your inventory.';m.style.color='#A32D2D';return;}
    const days=[...g('pia-daypick').querySelectorAll('.dbtn.on')].map(b=>parseInt(b.dataset.d));
    if(!days.length){m.textContent='Tick at least one day.';m.style.color='#A32D2D';return;}
    const stk=gv('pia-stk');
    const sides=piaStackToSides(stk);
    // Dose override if user edited it
    const newDose=+gv('pia-dose')||0;
    if(newDose>0)it.dose=newDose;
    const newDu=gv('pia-doseu');if(newDu)it.doseUnit=newDu;
    tmpAllowCalSched(it.name);
    for(let di=0;di<7;di++){
      delete S.sched[sk(it.name,'am',di)];
      delete S.sched[sk(it.name,'pm',di)];
      ['breakfast','lunch','dinner','bedtime'].forEach(lane=>{delete S.sched[sk(it.name,lane,di)];});
    }
    if(sides.am)days.forEach(di=>{S.sched[sk(it.name,'am',di)]=true;});
    if(sides.pm)days.forEach(di=>{S.sched[sk(it.name,'pm',di)]=true;});
    if(['breakfast','lunch','dinner','bedtime'].includes(String(stk||'').toLowerCase())){
      it.stackLane=String(stk).toLowerCase();
      it.days=days.slice();
    }
    m.textContent='Schedule saved!';m.style.color='#0F6E56';
    closePepMgr();
    try{window.tmpInventoryToast('✓ Scheduled "' + it.name + '" on the weekly calendar');}catch(_){}
    try{if(typeof window.tmpRequestBackupReminder==='function')window.tmpRequestBackupReminder('schedule');}catch(_){}
    requestAnimationFrame(()=>{
      try{rebuildCM();buildLegend();save();popSel();}catch(_){}
      try{window.renderCal&&renderCal();}catch(_){}
    });
  });
  g('peplist').addEventListener('click',e=>{const xb=e.target.closest('[data-xid]');if(xb){e.stopPropagation();pepEId=parseInt(xb.dataset.xid);const it=S.inv.find(i=>i.id===pepEId);if(it){fillPF(it);g('ptf-btn').textContent='Editing: '+it.name;buildPFA(true);swPT('form');g('pep-dbox').style.display='block';}return;}const r=e.target.closest('[data-pid]');if(r){const it=S.inv.find(i=>i.id===parseInt(r.dataset.pid));if(it)openPepEditor(it);}});
  // v16: legacy pep-dbox wiring. v7 replaced the dialog markup so pd-yes
  // no longer exists — calling addEventListener on null aborted init and
  // broke EVERYTHING wired below this line (color picker, day picker, save
  // button, etc.). pd-no still exists (Cancel button kept the same id) but
  // its handler is also wired by the v7 archive script, so the duplicate is
  // harmless. Guarded with optional chaining for safety against future
  // dialog redesigns.
  (function(){
    const pdNo = g('pd-no');
    if (pdNo && !pdNo.__legacyWired){
      pdNo.__legacyWired = true;
      pdNo.addEventListener('click',()=>g('pep-dbox').style.display='none');
    }
    const pdYes = g('pd-yes');
    if (pdYes) pdYes.addEventListener('click', delPep);  // dead path — element no longer in DOM after v7
  })();
  // Price comparison editors (legacy pt-* matrix — skip when vpr row template is active)
  wireId('pt-add-vendor','click',()=>openVendorEdit(null));
  wireId('pt-add-pep','click',promptAddPeptide);
  wireId('ve-close','click',closeVendorEdit);
  wireId('ve-cancel','click',closeVendorEdit);
  wireId('ve-save','click',saveVendorEdit);
  wireId('ve-del','click',deleteVendor);
  wireId('pt-head','click',e=>{
    const h=e.target.closest('.v-hdr');
    if(h){openVendorEdit(h.dataset.v);}
  });
  wireId('pt-body','click',e=>{
    if(editingCell)return;
    const cell=e.target.closest('.price-cell');
    if(cell){beginCellEdit(cell,cell.dataset.pep,cell.dataset.v);return;}
    const pc=e.target.closest('.pep-cell');
    if(pc){promptRenamePeptide(pc.dataset.pep);}
  });
  g('calc-dose-unit')&&g('calc-dose-unit').addEventListener('change',doCalc);
  g('calc-freq')&&g('calc-freq').addEventListener('change',doCalc);
  g('tit-add-btn').addEventListener('click',()=>{g('tit-add-form').style.display='block';sv('tit-date',td());});
  g('tit-cancel-btn').addEventListener('click',()=>{g('tit-add-form').style.display='none';});
  g('tit-save-btn').addEventListener('click',()=>{
    const nm=gv('tit-sel');
    if(!nm){
      alert('Pick a peptide from the dropdown first.');
      return;
    }
    const ref=(typeof PEPTIDE_REF!=='undefined' ? PEPTIDE_REF.find(r=>r.n===nm) : null)||{};
    const userIt=(S.inv||[]).find(i=>i && !i.isSupply && i.name===nm)||{};
    const startD=parseFloat(gv('tit-start-d'))||ref.startD||userIt.dose||0;
    const unit=gv('tit-start-u')||ref.unit||userIt.doseUnit||'mcg';
    const freq=gv('tit-freq')||ref.freq||'Daily';
    if(!S.tit)S.tit={};
    let startDate=gv('tit-date')||td();
    const weekNow=Math.max(1, parseInt(gv('tit-week-now'),10)||1);
    if(weekNow>1){
      try {
        const shiftDays=(weekNow-1)*7;
        const d=new Date(startDate+'T12:00:00');
        d.setDate(d.getDate()-shiftDays);
        const pad=n=>String(n).padStart(2,'0');
        startDate=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
      } catch(_){}
    }
    S.tit[nm]={
      startDate,
      startDose:startD,
      targetDose:ref.targetD||startD,
      incrAmt:ref.incrAmt||0,
      incrWks:ref.incrWks||0,
      cycleOn:ref.cycleOn||12,
      cycleOff:ref.cycleOff||4,
      unit, freq
    };
    save();g('tit-add-form').style.display='none';
    sv('tit-week-now', 1);
    renderTitList();
  });
  g('tit-sel').addEventListener('change',function(){
    const nm=this.value; if(!nm) return;
    // v15: check user's own inventory entry first; fall back to PEPTIDE_REF
    // catalog. This way a user-added peptide gets pre-filled from their own
    // dose settings instead of being left blank.
    const userIt=(S.inv||[]).find(i=>i && !i.isSupply && i.name===nm);
    const ref=(typeof PEPTIDE_REF!=='undefined') ? PEPTIDE_REF.find(r=>r.n===nm) : null;
    if(userIt && (userIt.dose>0)){
      sv('tit-start-d',userIt.dose);
      sv('tit-start-u',userIt.doseUnit||'mcg');
    } else if(ref){
      sv('tit-start-d',ref.startD);
      sv('tit-start-u',ref.unit);
    }
    if(ref && ref.freq){
      const opts=[...g('tit-freq').options].map(o=>o.value);
      if(opts.indexOf(ref.freq)>=0)sv('tit-freq',ref.freq);
    }
  });
  g('ref-filter-btns').querySelectorAll('.qbtn').forEach(b=>b.addEventListener('click',function(){
    g('ref-filter-btns').querySelectorAll('.qbtn').forEach(x=>x.classList.remove('on'));
    this.classList.add('on');renderRefGrid(this.dataset.cat);
  }));
  g('daypick').querySelectorAll('.dbtn').forEach(b=>b.addEventListener('click',()=>b.classList.toggle('on')));
  document.querySelectorAll('.pf-day-preset').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.preventDefault();
      const key=btn.dataset.pfDays;
      if(key&&PF_DAY_PRESETS[key])setDayPickSelection(PF_DAY_PRESETS[key]);
    });
  });
  g('pf-stk').addEventListener('change',updateDayPicker);
  g('pf-nm').addEventListener('input',updatePepRefCard);
  // Blend UI wiring — checkbox toggles Composition section + dose-unit swap;
  // "+ Add component" inserts a fresh empty row. When switching blend mode ON
  // for a new peptide with no components yet, prepopulate one empty row so
  // the user isn't staring at nothing after clicking.
  const bcb=g('pf-is-blend');
  if(bcb)bcb.addEventListener('change',()=>{
    refreshBlendUI();
    if(bcb.checked){
      const host=g('pf-blend-components');
      if(host&&host.children.length===0)host.appendChild(buildCompositionRow());
    }
  });
  const bad=g('pf-blend-add');
  if(bad)bad.addEventListener('click',()=>{
    const host=g('pf-blend-components');
    if(host)host.appendChild(buildCompositionRow());
  });
  // Build color swatches in the form
  const cpick=g('pf-colorpick');
  PEP_PALETTE.forEach((p,i)=>{
    const b=document.createElement('button');
    b.type='button';b.className='cbtn';b.dataset.ci=String(i);
    b.title='Color '+(i+1);
    b.style.cssText='width:28px;height:28px;border-radius:50%;border:.5px solid '+p.border+';background:'+p.bg+';cursor:pointer;flex-shrink:0;';
    b.innerHTML='<span style="display:block;width:14px;height:14px;border-radius:50%;background:'+p.border+';margin:auto"></span>';
    b.addEventListener('click',()=>setColorSwatch(i));
    cpick.appendChild(b);
  });
  setColorSwatch(-1);
  popSel();

  /* ████████████████████████████████████████████████████████████████████████████
     SECTION: Price Importer Subsystem
     ████████████████████████████████████████████████████████████████████████████

     EXTRACTION CANDIDATE — if this file is ever split, pull this out first.

     Scope: ~1,100 lines, starting here and running to just above init()'s
     closing brace. Everything below this banner is nested *inside* init(),
     so its function names don't leak to the global scope.

     Interaction with the rest of the app is narrow:
       reads   — S.prices, S.vendors, PEPTIDE_CATALOG
       writes  — S.prices, S.vendors (via save())
       triggers — renderPrices()
     That's it. No cross-calls into calendar / inventory / calculator / etc.

     Nested subsystems inside this block (in order):
       • parsePriceText()        — main line-by-line parser (tab/space/PDF)
       • matchPeptideName()      — fuzzy-match parsed names to catalog
       • renderImportPreview()   — preview modal with per-row toggles
       • takePriceSnapshot()/clearPriceSnapshot() — undo support
       • computeNormalizationPlan() / applyNormalization()
             — consolidate RT20 / Reta20 / Retatrutide20 → one row
       • suspicionReason() / suggestForCleanup() / aliasLookup()
             — junk-row detection + rename suggestions
       • findRedundancyClusters() / applyRedundancyMerges()
             — cross-vendor de-duplication
       • openCleanup() / renderCleanupRows() / closeCleanup()
       • openImporter() / closeImporter() / loadPdfjs()
             — modal lifecycle + lazy pdf.js loader

     Extraction notes (for future-you):
       - The functions close over `g`, `gv`, `sv`, `escH`, `save`, `renderPrices`
         and a couple of `let` state vars defined above this banner. If pulling
         into a module, either import those or pass them in as a dependencies
         object — don't try to globalize them.
       - pdf.js is loaded from a CDN inside loadPdfjs(); that's the only
         external dep and it's feature-gated by HAS_PRICE_IMPORT.
       - The sample-data buttons (JEEP / HKMS demo paste) are also in here
         and can stay together with the importer if extracted.
     ████████████████████████████████████████████████████████████████████████████ */

  // ========== Vendor price importer ==========
  // Parse pasted text into {name, dose, price} rows. Finds a price token per line,
  // extracts nearby dose, and uses remaining text as the peptide name (stripping
  // obvious SKU codes and pack-size phrases).
  function parsePriceText(text){
    if(!text)return[];
    // Normalize some unicode whitespace/separators to regular spaces/tabs
    text=text.replace(/[\u00A0\u2002-\u200B]/g,' ');
    const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0);
    const rows=[];
    // When rows are grouped by product (LN Peptides style — name only on first row),
    // carry forward the last seen Full Name for continuation rows — but ONLY when the
    // current SKU shares a group root with the previous SKU (SM10 → SM15 → SM20 all
    // share "SM", but AA10 → SLU-PP-332 don't, so don't leak the name across groups).
    let lastProductName='';
    let lastSku='';
    const skuGroupRoot=s=>{
      if(!s)return'';
      const m=s.match(/^(.+?)\d+[A-Z]{0,2}$/);
      if(m)return m[1].toLowerCase();
      // Fallback: vendor SKUs with digits BEFORE the letters (e.g. "2AD", "5AD", "10AD") — use the letter signature.
      // Mirrors the way a human reads "these all end in AD, same product family".
      const letters=s.replace(/\d+/g,'').toLowerCase();
      return letters.length>=1?letters:s.toLowerCase();
    };
    for(const line of lines){
      // Skip header rows and empty separator lines
      if(/^(product|name|sku|item|code|price|dose|size|warehouse|stock|qty|spc|short|full|unit|specification)\b/i.test(line))continue;
      if(/^\W*$/.test(line))continue;
      // Skip raw-powder rows (multi-price per line — can't disambiguate)
      if(/\braw\s*powder\b/i.test(line))continue;
      // Skip notes, shipping terms, crypto payment lines, and common vendor disclaimers
      if(/^(notes?|note)[\s:]/i.test(line))continue;
      if(/\b(shipping|reship|moq|usdt|erc20|trc20|segwit|solana|whatsapp|telegram)\b/i.test(line))continue;
      if(/(remote\s+area|benzyl\s*alcohol|\*\s*some\s+areas|fedex\/ups|additional\s+(fee|charge))/i.test(line))continue;
      // ---- Extract potential SKU (first short token) ----
      let sku='';
      const firstTok=line.match(/^\s*(\S+)\s+/);
      if(firstTok&&firstTok[1].length<=14)sku=firstTok[1];
      // ---- Find the price ----
      let price=null,priceIdx=-1;
      // Priority 1: explicit currency symbol ($, €, £, or USD/EUR/GBP suffix)
      const curMatch=line.match(/[\$€£]\s*(\d+(?:[\.,]\d+)?)|(\d+(?:[\.,]\d+)?)\s*(?:USD|EUR|GBP)\b/i);
      if(curMatch){
        const priceStr=(curMatch[1]||curMatch[2]||'').replace(',','.');
        price=parseFloat(priceStr);
        priceIdx=curMatch.index;
      }else{
        // Priority 2: last standalone positive number on the line, after masking out size/stock phrases.
        // Used for vendors whose sheets have no currency symbol (e.g. HKMS), where prices sit in the final column.
        let masked=line;
        // Mask "5mg*10vials" / "10mg+10vials" / "5mg × 10vials" / "10ml*1vials" and plain "5mg" / "10iu" forms
        masked=masked.replace(/\d+(?:\.\d+)?\s*(?:mg|mcg|μg|ug|ml|units|iu)(?:\s*[\*\+xX×·]\s*\d+\s*vials?)?/gi,m=>' '.repeat(m.length));
        masked=masked.replace(/\d+\s*vials?(?:\s*\/\s*kit)?/gi,m=>' '.repeat(m.length));
        masked=masked.replace(/\d+(?:\.\d+)?\s*(?:mg|mcg|μg|ug|ml|units|iu)\s*\/\s*vial/gi,m=>' '.repeat(m.length));
        // Collect standalone numbers (\b avoids numbers embedded in SKU codes like "KCU60")
        const nums=[...masked.matchAll(/\b(\d+(?:\.\d+)?)\b/g)];
        const positives=nums.filter(m=>parseFloat(m[1])>0);
        if(positives.length>0){
          const last=positives[positives.length-1];
          price=parseFloat(last[1]);
          priceIdx=last.index;
        }
      }
      if(price===null||!isFinite(price)||price<=0)continue;
      // ---- Dose: prefer the spec-form dose (the one immediately before *Nvials) ----
      // For combo products like "BPC 5mg + TB 5mg 10mg*10vials", this gives us the total "10mg"
      // rather than grabbing "5mg" from an ingredient mention.
      const specDoseMatch=line.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|μg|ug|ml|units|iu)(?=\s*[\*\+xX×·]\s*\d+\s*vials?)/i);
      const anyDoseMatch=line.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|μg|ug|ml|units|iu)\b/i);
      const doseMatch=specDoseMatch||anyDoseMatch;
      const doseNum=doseMatch?doseMatch[1]:'';
      let doseUnit=doseMatch?doseMatch[2].toLowerCase():'';
      if(doseUnit==='μg'||doseUnit==='ug')doseUnit='mcg';
      const dose=doseNum?doseNum+doseUnit:'';
      // ---- Name extraction ----
      let name=line.slice(0,priceIdx);
      // Drop pack-size phrases ("5mg*10vials", "10mg+10vials", "10mg × 10vials", "10vials/kit", "50mg/vial", bare "10vials")
      name=name.replace(/\d+(?:\.\d+)?\s*(?:mg|mcg|μg|ug|ml|units|iu)\s*[\*\+xX×·]\s*\d+\s*vials?/gi,' ');
      name=name.replace(/\d+\s*vials?\s*\/?\s*kit/gi,' ');
      name=name.replace(/\d+(?:\.\d+)?\s*(?:mg|mcg|μg|ug|ml|units|iu)\s*\/\s*vial/gi,' ');
      name=name.replace(/\d+\s*vials?\b/gi,' ');
      // Drop capsule phrasing ("100caps/bottle", "60 caps", etc.)
      name=name.replace(/\d+\s*caps(?:ules?)?\s*(?:\/\s*bottle)?/gi,' ');
      // Drop the dose token ONLY if it's the generic fallback (spec-form already handled above)
      if(doseMatch&&!specDoseMatch)name=name.replace(doseMatch[0],' ');
      // Drop any remaining standalone numbers (stock counts etc.)
      name=name.replace(/(^|\s)(\d+(?:\.\d+)?)(?=\s|$)/g,'$1');
      // Collapse tabs & runs of whitespace and drop stray separators
      name=name.replace(/\t+/g,' ').replace(/\s{2,}/g,' ').replace(/[\|•·,;]+/g,' ').trim();
      // Drop leading SKU-like codes — three strategies so we catch more formats:
      //   1. Token containing both letters and digits, short ("GLOW50", "RT30", "BPC10", "2S10", "IGF-01")
      //   2. First token equals second token (JEEP's "KPV KPV" case)
      //   3. Short ALL-CAPS token that's a prefix of the next token ("ABC ABC-123")
      let tokens=name.split(/\s+/).filter(Boolean);
      if(tokens.length>1){
        const norm=s=>s.toLowerCase().replace(/[-_\s]/g,'');
        const t0=tokens[0],t1=tokens[1];
        const looksLikeSku=/[A-Za-z]/.test(t0)&&/\d/.test(t0)&&t0.length<=10;
        const duplicate=norm(t0)===norm(t1);
        const isCapsCode=/^[A-Z][A-Z0-9-]{1,7}$/.test(t0);
        const prefixOfNext=isCapsCode&&norm(t1).startsWith(norm(t0))&&norm(t1).length>norm(t0).length;
        if(looksLikeSku||duplicate||prefixOfNext)tokens.shift();
      }
      name=tokens.join(' ').trim();
      // Drop trailing punctuation/stops
      name=name.replace(/[\s\-:]+$/,'').trim();
      // Continuation-row handling: if the only surviving name is the SKU (or empty),
      // this is a sub-row in a grouped product listing — inherit the last seen product name,
      // but ONLY when the current SKU shares a group root with the previous one.
      const normedName=name.toLowerCase().replace(/[-_\s]/g,'');
      const normedSku=(sku||'').toLowerCase().replace(/[-_\s]/g,'');
      const currentRoot=skuGroupRoot(sku);
      const prevRoot=skuGroupRoot(lastSku);
      if(!name||normedName===normedSku){
        if(lastProductName&&currentRoot&&prevRoot&&currentRoot===prevRoot){
          name=lastProductName;
        }
      }else if(name.length>=2&&!/shipping|email|whatsapp|phone|contact|trust|worthy/i.test(name)){
        // Remember the most recently seen product name for upcoming continuation rows
        lastProductName=name;
      }
      if(sku)lastSku=sku;
      if(name.length<2&&!sku)continue;
      // Skip obvious non-peptide text
      if(/shipping|email|whatsapp|phone|contact|trust|worthy/i.test(name))continue;
      // Strip leading junk punctuation/asterisks that survived cleanup ("/FTTP" → "FTTP", "* 500mg" → "500mg")
      name=name.replace(/^[\s\*\/\-_.,;:+]+/,'').trim();
      // Reject rows where nothing meaningful survived cleanup
      //   · pure punctuation/whitespace ("/", "*", "---")
      //   · dose-only residue ("40mg", "100iu", "10ml")
      //   · asterisk-number shrapnel from combo-product columns ("* 526mg")
      if(/^[\s\*\/\-_.,;:+]*$/.test(name))continue;
      if(/^\s*\d+(?:\.\d+)?\s*(?:mg|mcg|μg|ug|ml|iu|units)\s*$/i.test(name))continue;
      if(/^[\*\/]\s*\d/.test(name))continue;
      if(name.length<=2&&!/[a-z]/i.test(name))continue;
      // Normalize to canonical catalog form so vendor name/SKU variants ("RT20", "Reta 20mg",
      // "Retatrutide20", "R20" etc.) all land on the same row "Retatrutide 20mg".
      // Falls back to the parsed name if the catalog has no match.
      const canonical=normalizePeptideName(name,sku,dose);
      if(canonical){name=canonical;}
      rows.push({name,dose,price,sku});
    }
    return rows;
  }
  // Best-effort match of a parsed row to existing peptides. Tries SKU exact → name exact → name fuzzy.
  function matchPeptideName(parsed,existingNames){
    const norm=s=>(s||'').toLowerCase().replace(/[-_\s]/g,'');
    const nameN=norm(parsed.name);
    const skuN=norm(parsed.sku);
    // SKU exact
    if(parsed.sku){for(const p of existingNames){if(norm(p)===skuN)return{type:'sku',match:p};}}
    // Name exact
    if(nameN){for(const p of existingNames){if(norm(p)===nameN)return{type:'exact',match:p};}}
    // Name fuzzy (substring either way, ≥3 chars)
    if(nameN.length>=3){
      for(const p of existingNames){
        const np=norm(p);
        if(np.length>=3&&(nameN.includes(np)||np.includes(nameN)))return{type:'fuzzy',match:p};
      }
    }
    return{type:'new',match:null};
  }
  // Parsed-rows UI state (kept in closure)
  let piRows=[];
  function renderImportPreview(){
    const existing=Object.keys(S.prices||{});
    const tbody=g('pi-rows');
    tbody.innerHTML=piRows.map((r,i)=>{
      const m=matchPeptideName(r,existing);
      let badge,skuHint='';
      if(r.sku&&r.sku!==r.name)skuHint='<div style="font-size:10px;color:var(--color-text-tertiary);margin-top:2px">SKU <code style="background:var(--color-background-secondary);padding:0 4px;border-radius:3px">'+r.sku+'</code>'+(r.originalName&&r.originalName!==r.name?' · <span style="color:var(--color-text-tertiary)">parsed as: '+r.originalName.replace(/</g,'&lt;')+'</span>':'')+'</div>';
      if(m.type==='sku')badge='<span title="Matched by SKU '+r.sku+'" style="font-size:10px;background:#D1FAE5;color:var(--accent-green-fg);padding:2px 7px;border-radius:10px;font-weight:600">SKU → '+m.match+'</span>';
      else if(m.type==='exact')badge='<span style="font-size:10px;background:#D1FAE5;color:var(--accent-green-fg);padding:2px 7px;border-radius:10px;font-weight:600">name match</span>';
      else if(m.type==='fuzzy')badge='<span title="Looks close to '+m.match+'" style="font-size:10px;background:#FEF3C7;color:var(--accent-amber-fg);padding:2px 7px;border-radius:10px;font-weight:600">≈ '+m.match+'</span>';
      else badge='<span style="font-size:10px;background:#DBEAFE;color:var(--accent-blue-fg);padding:2px 7px;border-radius:10px;font-weight:600">new</span>';
      return '<tr data-i="'+i+'" style="border-top:.5px solid var(--color-border-tertiary)">'
        +'<td style="padding:6px 10px;vertical-align:top"><input type="checkbox" data-pi-chk="'+i+'"'+(r.include?' checked':'')+'></td>'
        +'<td style="padding:6px 10px"><input type="text" data-pi-name="'+i+'" value="'+r.name.replace(/"/g,'&quot;')+'" list="pi-existing-dl" style="font-size:12px;padding:4px 8px">'+skuHint+'</td>'
        +'<td style="padding:6px 10px;vertical-align:top"><input type="text" data-pi-dose="'+i+'" value="'+(r.dose||'').replace(/"/g,'&quot;')+'" placeholder="—" style="font-size:12px;padding:4px 8px"></td>'
        +'<td style="padding:6px 10px;vertical-align:top"><input type="number" min="0" step="0.01" data-pi-price="'+i+'" value="'+r.price+'" style="font-size:12px;padding:4px 8px"></td>'
        +'<td style="padding:6px 10px;vertical-align:top">'+badge+'</td>'
      +'</tr>';
    }).join('');
    // existing peptides datalist for autocomplete
    const dl=g('pi-existing-dl')||(function(){const d=document.createElement('datalist');d.id='pi-existing-dl';document.body.appendChild(d);return d;})();
    dl.innerHTML=existing.map(p=>'<option value="'+p+'">').join('');
    // Summary
    const checked=piRows.filter(r=>r.include).length;
    const skuMatches=piRows.filter(r=>matchPeptideName(r,existing).type==='sku').length;
    const newCnt=piRows.filter(r=>matchPeptideName(r,existing).type==='new').length;
    g('pi-summary').innerHTML='Parsed <strong>'+piRows.length+'</strong> row(s) · <strong>'+checked+'</strong> selected · <strong>'+skuMatches+'</strong> matched by SKU · <strong>'+newCnt+'</strong> new peptide(s)';
    // Bind inputs
    tbody.querySelectorAll('[data-pi-chk]').forEach(cb=>cb.addEventListener('change',function(){piRows[+this.dataset.piChk].include=this.checked;renderImportPreview();}));
    tbody.querySelectorAll('[data-pi-name]').forEach(inp=>inp.addEventListener('input',function(){piRows[+this.dataset.piName].name=this.value;}));
    tbody.querySelectorAll('[data-pi-dose]').forEach(inp=>inp.addEventListener('input',function(){piRows[+this.dataset.piDose].dose=this.value;}));
    tbody.querySelectorAll('[data-pi-price]').forEach(inp=>inp.addEventListener('input',function(){piRows[+this.dataset.piPrice].price=parseFloat(this.value)||0;}));
  }
  // ---- Price table undo snapshot (session-only) ----
  let priceSnapshot=null;
  let priceSnapshotLabel='';
  function takePriceSnapshot(label){
    priceSnapshot={prices:JSON.parse(JSON.stringify(S.prices||{})),vendors:[...(S.vendors||[])]};
    priceSnapshotLabel=label||'last change';
    const btn=g('tmp-undo');if(btn){btn.style.display='';btn.title='Revert '+priceSnapshotLabel;}
  }
  function clearPriceSnapshot(){
    priceSnapshot=null;priceSnapshotLabel='';
    const btn=g('tmp-undo');if(btn)btn.style.display='none';
  }
  wireId('tmp-undo','click',()=>{
    if(!priceSnapshot)return;
    if(!confirm('Undo the '+priceSnapshotLabel+'? This restores the price table to its previous state.'))return;
    S.prices=priceSnapshot.prices;
    S.vendors=priceSnapshot.vendors;
    save();renderPrices();clearPriceSnapshot();
  });
  wireId('tmp-clear','click',()=>{
    const pepCount=Object.keys(S.prices||{}).length;
    const vendorCount=(S.vendors||[]).length;
    if(pepCount===0&&vendorCount===0){alert('The price table is already empty.');return;}
    if(!confirm('Delete the entire vendor pricing table?\n\nThis removes '+pepCount+' peptide(s) and '+vendorCount+' vendor(s). The action is reversible via Undo until you refresh or take another action.'))return;
    takePriceSnapshot('clear');
    S.prices={};S.vendors=[];
    save();renderPrices();
  });

  // ---- Normalize price table ----
  // Compute a proposed rename/merge plan based on PEPTIDE_CATALOG.
  // Rows whose names (or inferred SKU-like prefix) map to the same canonical form
  // get consolidated into one row; same-vendor collisions keep the lowest price.
  function computeNormalizationPlan(){
    const names=Object.keys(S.prices||{});
    const proposals=[];  // {from, to, reason}
    const seenKeys=new Set();
    names.forEach(n=>{
      // Try to infer a canonical form from the existing name.
      // Strategy: split the name into a "word" part and an optional dose part,
      // then feed both into normalizePeptideName as name+dose.
      const dose=extractDoseFromName(n);
      // Treat the leading token as a potential SKU (useful for rows stored as "RT20" etc.)
      const firstTok=(n.trim().split(/\s+/)[0]||'');
      // The "name" passed to the normalizer is the part without the dose.
      const nameOnly=dose?n.replace(new RegExp('\\s*'+dose.replace(/([.*+?^${}()|[\]\\])/g,'\\$1')+'\\b','i'),'').trim():n;
      const canonical=normalizePeptideName(nameOnly,firstTok,dose);
      if(!canonical||canonical===n)return;
      proposals.push({from:n,to:canonical,reason:dose?'catalog + dose':'catalog'});
      seenKeys.add(canonical);
    });
    // Compute merge targets — same canonical used by multiple source rows
    const targets={};
    proposals.forEach(p=>{if(!targets[p.to])targets[p.to]=[];targets[p.to].push(p.from);});
    // Also flag rows that already match an existing canonical row — those get merged into the existing
    names.forEach(n=>{
      if(proposals.some(p=>p.from===n))return;
      // Row keeps its name; but if another row is being renamed TO this name, merging applies
      if(targets[n]){targets[n].push(n);}
    });
    return{proposals,targets,names};
  }

  function openNormalizer(){
    const plan=computeNormalizationPlan();
    const{proposals,targets,names}=plan;
    const renameCount=proposals.length;
    const mergePairs=Object.values(targets).filter(arr=>arr.length>1);
    const mergeCount=mergePairs.reduce((s,arr)=>s+arr.length-1,0);
    g('pn-intro').innerHTML='The normalizer uses the built-in peptide catalog to consolidate vendor-specific names and SKUs (e.g. <b>RT20</b>, <b>Reta 20mg</b>, <b>Retatrutide20</b>) into a single canonical form like <b>Retatrutide 20mg</b>. Prices from different vendors for the same canonical peptide will end up in the same row.';
    if(renameCount===0){
      g('pn-summary').innerHTML='<div style="padding:1.5rem 1rem;text-align:center;color:var(--color-text-secondary);background:var(--color-background-secondary);border-radius:8px"><div style="font-size:32px;margin-bottom:.5rem">✨</div><div style="font-weight:600;color:var(--color-text-primary);margin-bottom:4px">Nothing to normalize</div><div style="font-size:12px">All '+names.length+' of your existing rows already use canonical names (or the catalog has no mapping for them).</div></div>';
      g('pn-preview').innerHTML='';
      g('pn-apply').disabled=true;g('pn-apply').style.opacity='.5';
    }else{
      g('pn-apply').disabled=false;g('pn-apply').style.opacity='1';
      g('pn-summary').innerHTML='<b>'+renameCount+'</b> row'+(renameCount===1?'':'s')+' will be renamed'+(mergeCount>0?(', merging <b>'+mergeCount+'</b> duplicate'+(mergeCount===1?'':'s')+' (same-vendor collisions keep the lowest price)'):'')+'.';
      // Build preview, grouped by target canonical
      const byTarget={};proposals.forEach(p=>{(byTarget[p.to]||(byTarget[p.to]=[])).push(p);});
      // Include existing rows that are themselves the target of merges
      Object.keys(byTarget).forEach(t=>{if(names.indexOf(t)>=0)byTarget[t].push({from:t,to:t,reason:'existing',existing:true});});
      const groups=Object.keys(byTarget).sort().map(t=>{
        const group=byTarget[t];
        const rows=group.map(p=>{
          const vendors=Object.keys(S.prices[p.from]||{}).length;
          const badge=p.existing?'<span style="font-size:10px;padding:2px 6px;border-radius:5px;background:#F3F4F6;color:#4B5563;margin-left:6px">existing</span>':'<span style="font-size:10px;padding:2px 6px;border-radius:5px;background:#FEF3C7;color:var(--accent-amber-fg);margin-left:6px">'+p.reason+'</span>';
          return'<div style="padding:3px 0 3px 14px;font-size:12px;color:var(--color-text-primary);display:flex;align-items:center"><span style="color:var(--color-text-secondary);margin-right:4px">↳</span><span style="font-family:ui-monospace,Menlo,Consolas,monospace">'+escH(p.from)+'</span>'+badge+'<span style="color:var(--color-text-tertiary);font-size:10.5px;margin-left:auto">'+vendors+' vendor'+(vendors===1?'':'s')+'</span></div>';
        }).join('');
        const multi=group.length>1;
        return'<div style="padding:10px 12px;border-bottom:.5px solid var(--color-border-tertiary)">'
          +'<div style="font-weight:600;font-size:13px;color:'+(multi?'#0E7490':'var(--color-text-primary)')+'">'+(multi?'🔀 ':'→ ')+escH(t)+(multi?'<span style="font-size:10.5px;color:var(--color-text-tertiary);font-weight:500;margin-left:8px">merged from '+group.length+' rows</span>':'')+'</div>'
          +rows
          +'</div>';
      }).join('');
      g('pn-preview').innerHTML=groups||'<div style="padding:1rem;color:var(--color-text-secondary);font-size:12px">No changes proposed.</div>';
    }
    g('pn-modal').style.display='block';
  }
  function closeNormalizer(){g('pn-modal').style.display='none';}
  function applyNormalization(){
    const plan=computeNormalizationPlan();
    if(!plan.proposals.length){closeNormalizer();return;}
    takePriceSnapshot('normalization');
    // Rebuild S.prices with consolidated keys
    const newPrices={};
    // Seed newPrices with any existing entries that AREN'T being renamed
    const renameMap={};
    plan.proposals.forEach(p=>{renameMap[p.from]=p.to;});
    Object.keys(S.prices||{}).forEach(oldName=>{
      const target=renameMap[oldName]||oldName;
      if(!newPrices[target])newPrices[target]={};
      const vendorPrices=S.prices[oldName]||{};
      Object.keys(vendorPrices).forEach(v=>{
        const existing=newPrices[target][v];
        const incoming=vendorPrices[v];
        // On vendor collision during merge, keep the lower price (more favorable / typically the "real" one)
        if(existing==null||(+incoming>0&&+incoming<+existing))newPrices[target][v]=incoming;
        else if(existing==null)newPrices[target][v]=incoming;
      });
    });
    S.prices=newPrices;
    save();closeNormalizer();renderPrices();
  }
  wireId('pt-normalize','click',openNormalizer);
  wireId('pn-close','click',closeNormalizer);
  wireId('pn-cancel','click',closeNormalizer);
  wireId('pn-apply','click',applyNormalization);

  // ---- Cleanup: find & fix rows that look like parser residue ----
  // Returns {reason, canRecover, autoDelete?} for a row name that looks suspicious, or null if the row looks fine.
  // autoDelete=true means "definitely garbage, nuke without prompting" (Cleanup skips the review UI for these).
  function suspicionReason(name){
    const t=(name||'').trim();
    if(!t)return{reason:'empty',canRecover:false,autoDelete:true};
    if(/^[\s\*\/\-_.,;:+]*$/.test(t))return{reason:'punctuation only',canRecover:false,autoDelete:true};
    // Contact handles — Discord, Telegram, WeChat, WhatsApp, Signal with handle-like content
    if(/\b(discord|telegram|wechat|whatsapp|signal|skype|line|kakao|viber)\s*[:：]/i.test(t))return{reason:'contact handle',canRecover:false,autoDelete:true};
    if(/@[a-z0-9_]+|[a-z0-9_]+#\d{3,}/i.test(t)&&t.length<40)return{reason:'contact handle',canRecover:false,autoDelete:true};
    // Pure shipping/carrier references — UPS, FedEx, DHL, EMS alone or in combination
    if(/^\s*(ups|fedex|dhl|ems|usps|china\s*post|royal\s*mail|tnt)(\s*[\/,&+]\s*(ups|fedex|dhl|ems|usps|china\s*post|royal\s*mail|tnt))*\s*$/i.test(t))return{reason:'shipping carrier',canRecover:false,autoDelete:true};
    // Category labels that slipped in as peptide names
    if(/^(kit|kits|kit\s*kits|research|peptides?|chemicals?|supplements?|capsules?|nasal\s*spray|tablets?|powder|liquid|injectable|oral|topical|blend|combo|stack|bundle|special|promo|sale|new|test|sample)s?$/i.test(t))return{reason:'category label',canRecover:false,autoDelete:true};
    if(/^\s*\d+(?:\.\d+)?\s*(?:mg|mcg|μg|ug|ml|iu|units)\s*$/i.test(t))return{reason:'pure dose residue',canRecover:false};
    if(/^[\*\/]\s*\d/.test(t))return{reason:'combo/shipping shrapnel',canRecover:false};
    if(/(remote\s+area|benzyl\s*alcohol|fedex\/ups|shipping|additional\s+(fee|charge)|\*\s*some\s+areas)/i.test(t))return{reason:'shipping / vendor note',canRecover:false};
    if(t.length<=2&&!/[a-z]/i.test(t))return{reason:'too short / no letters',canRecover:false};
    // Short unrecognized SKU-like codes ("2AD", "10AD", "BA10") — catalog couldn't map them, worth human review
    if(t.length<=6&&/[a-z]/i.test(t)&&/\d/.test(t)&&!normalizePeptideName(t,t,'')){
      return{reason:'unrecognized SKU',canRecover:true};
    }
    return null;
  }

  // Cross-reference multiple strategies to guess what a junk row actually was.
  // Returns {name, conf: 'high'|'medium'|'low', reason} or null if nothing plausible.
  function suggestForCleanup(rowName){
    const t=(rowName||'').trim();
    if(!t)return null;
    // Strategy 1 — Digit-then-letter vendor codes ("2AD", "10AD", "5AD") → AOD9604
    let m=t.match(/^(\d+)AD$/i);
    if(m)return{name:'AOD9604 '+m[1]+'mg',conf:'high',reason:'"'+m[0]+'" is the <size>AD code → AOD9604'};
    // Strategy 2 — FTTP alias (may appear with junk prefix like "/FTTP")
    if(/\bF{1,2}TTP\b/i.test(t)){
      const sz=t.match(/(\d+(?:\.\d+)?)\s*(mg|mcg)/i);
      return{name:'Adipotide'+(sz?' '+sz[1]+sz[2].toLowerCase():''),conf:'high',reason:'"FTTP" is an alias for Adipotide'};
    }
    // Strategy 3 — Benzyl alcohol in name = BAC water
    if(/benzyl\s*alcohol/i.test(t)){
      const ba=t.match(/\bBA\s*(\d+)\b/i);
      const ml=t.match(/(\d+)\s*ml/i);
      const sz=ba?ba[1]:(ml?ml[1]:null);
      return{name:'BAC Water'+(sz?' '+sz+'ml':''),conf:'high',reason:'"benzyl alcohol" means bacteriostatic water'};
    }
    // Strategy 4 — LN Peptides Lipo-C family product codes (LC120, LC216, LC425, LC526, LC553)
    m=t.match(/\bLC\s*0*(120|216|425|526|553|600|1200)\b/i);
    if(m){
      const lipoMap={'120':['Lipo-C','10ml'],'216':['MIC (Lipo-C + B12)','10ml'],'425':['Lipo-C FOCUS','10ml'],'526':['Lipo-C FAT BLASTER','10ml'],'553':['Super Shred','10ml'],'600':['L-carnitine','600mg'],'1200':['L-carnitine','1200mg']};
      const[nm,sz]=lipoMap[m[1]];
      return{name:nm+' '+sz,conf:'high',reason:'"LC'+m[1]+'" is a Lipo-C product code'};
    }
    // Strategy 5 — Strip leading junk punctuation, re-run the catalog lookup
    //   Handles "/FTTP" → FTTP → Adipotide, "* 1200mg" → 1200mg (falls through to dose heuristics),
    //   "*KPV" → KPV → matches catalog, etc.
    const stripped=t.replace(/^[\s\*\/\-_.,;:+]+/,'').trim();
    if(stripped&&stripped!==t&&stripped.length>=2){
      const dose=extractDoseFromName(stripped);
      const base=dose?stripped.replace(new RegExp(dose.replace(/([.*+?^${}()|[\]\\])/g,'\\$1'),'i'),'').trim():stripped;
      const canonical=normalizePeptideName(base,base,dose);
      if(canonical)return{name:canonical,conf:'medium',reason:'stripped leading "'+t.charAt(0)+'" then matched catalog'};
    }
    // Strategy 6 — Embedded SKU scan. Look for any SKU-prefix+digits substring anywhere in the name.
    //   Catches cases where the real signal is buried in noise.
    const tokens=t.match(/\b[A-Za-z][A-Za-z0-9-]{0,8}\d+\b/gi)||[];
    for(const tok of tokens){
      const normed=_normPepStr(tok);
      for(const entry of PEPTIDE_CATALOG){
        for(const p of entry[2]||[]){
          const np=_normPepStr(p);
          if(np.length>=2&&normed.startsWith(np)&&/^\d/.test(normed.slice(np.length))){
            const size=normed.slice(np.length);
            // Solvents and liquids are in ml; everything else defaults to mg
            const unit=entry[3]==='Solvent'?'ml':'mg';
            return{name:entry[0]+' '+size+unit,conf:'medium',reason:'embedded code "'+tok+'" → '+entry[0]};
          }
        }
      }
    }
    // Strategy 7 — Dose-only rows. Map a handful of signature doses to their canonical peptide.
    //   Only rules where a single peptide dominates the market for that exact dose.
    const doseOnly=stripped.match(/^(\d+(?:\.\d+)?)\s*(mg|mcg|ml|iu|units)$/i);
    if(doseOnly){
      const val=parseFloat(doseOnly[1]);
      const unit=doseOnly[2].toLowerCase();
      if(unit==='mg'&&val===0.1)return{name:'IGF-1 LR3 0.1mg',conf:'medium',reason:'0.1mg is the standard IGF-1 LR3 size'};
      if(unit==='mg'&&val===1000)return{name:'NAD+ 1000mg',conf:'medium',reason:'1000mg is an NAD+ signature size'};
      if(unit==='mg'&&val===500)return{name:'NAD+ 500mg',conf:'medium',reason:'500mg fits NAD+ standard'};
      if(unit==='mg'&&val===1200)return{name:'L-carnitine 1200mg',conf:'high',reason:'1200mg is a standard L-carnitine size'};
      if(unit==='mg'&&val===600)return{name:'L-carnitine 600mg',conf:'high',reason:'600mg is a standard L-carnitine size'};
      // These numerals are LN Peptides Lipo-C codes that got reinterpreted as mg-doses by the parser
      if(unit==='mg'&&val===216)return{name:'MIC (Lipo-C + B12) 10ml',conf:'medium',reason:'"216mg" is likely LC216 product code'};
      if(unit==='mg'&&val===526)return{name:'Lipo-C FAT BLASTER 10ml',conf:'medium',reason:'"526mg" is likely LC526 product code'};
      if(unit==='mg'&&val===425)return{name:'Lipo-C FOCUS 10ml',conf:'medium',reason:'"425mg" is likely LC425 product code'};
      if(unit==='mg'&&val===553)return{name:'Super Shred 10ml',conf:'medium',reason:'"553mg" is likely LC553 product code'};
      if(unit==='mg'&&val===120)return{name:'Lipo-C 10ml',conf:'low',reason:'"120mg" may be LC120 product code'};
      if(unit==='iu'&&val===75)return{name:'HMG 75iu',conf:'high',reason:'75iu is HMG signature'};
      if(unit==='iu'&&val>=2000)return{name:'HCG '+val+'iu',conf:'medium',reason:'high-iu dose fits HCG range'};
      if(unit==='iu'&&val>=10&&val<=36)return{name:'HGH '+val+'iu',conf:'medium',reason:'iu in HGH range (10–36iu)'};
      if(unit==='ml'&&val===10)return{name:'Lipo-C variant 10ml',conf:'low',reason:'10ml liquid — Lipo-C family or BAC water'};
    }
    // Strategy 8 (v21) — Price fingerprint match. When the textual strategies
    // above didn't crack it, fall back to: for every CLEAN row in the price
    // table, score how well its (vendor, warehouse, price) tuples agree with
    // this flagged row. The clean row with the highest exact-price overlap
    // wins (if it scores >= the threshold). Catches rows like "(P021) US"
    // where the only signal is "MED@US$285 happens to match Retatrutide@MED@US$285".
    try {
      if (typeof window.tmpFingerprintMatch === 'function'){
        // Build the candidate list lazily: every other row in S.prices
        // EXCEPT ones whose name itself looks suspicious. Cheap heuristic
        // for the candidate filter — punctuation prefix or <3 alpha chars.
        const candidateNames = Object.keys(S.prices||{}).filter(other => {
          if (other === t) return false;
          const o = (other||'').trim();
          if (!o) return false;
          if (/^[,\.\(\)'\/+\-_=:;]/.test(o)) return false;
          if ((o.match(/[a-zA-Z]/g)||[]).length < 3) return false;
          return true;
        });
        const best = window.tmpFingerprintMatch(t, candidateNames, { minScore:5 });
        if (best){
          const conf = best.score >= 10 ? 'high' : 'medium';
          return {
            name: best.target,
            conf,
            reason: 'price fingerprint matched <b>'+best.target+'</b> (score '+best.score+')'
          };
        }
      }
    } catch(_){ /* fingerprint helper not loaded yet — fall through */ }
    return null;
  }

  // In-memory state for the cleanup modal: per-row action selection
  let cleanupState={};  // name -> { action: 'delete'|'keep'|'merge'|'rename', target?: string }
  // In-memory state for redundancy cluster merges: clusterIdx -> { canonical: <name>, skip: bool }
  let redundancyChoices={};

  // ---- REDUNDANCY DETECTION ----
  // Groups rows that are likely the same peptide written differently.
  // Uses normalizePeptideName() to compute a canonical form and clusters by that.
  // Returns: Array<{ members: string[], canonical: string, signature: string }>
  // A cluster is only returned if it has 2+ members (no point reviewing clusters of 1).
  // ---- PEPTIDE ALIAS MAP ----
  // Maps common SKU prefixes / short codes to their canonical peptide name.
  // Used by findRedundancyClusters to cluster "RT20" with "Retatrutide 20mg" etc.
  // Keys are lowercase, no spaces/dashes. Values are the canonical root name.
  const PEPTIDE_ALIAS_ROOTS={
    // Retatrutide
    rt:'Retatrutide',reta:'Retatrutide',retatrutide:'Retatrutide',ret:'Retatrutide',
    // Tirzepatide
    tz:'Tirzepatide',tzp:'Tirzepatide',tirz:'Tirzepatide',tirze:'Tirzepatide',tirzepatide:'Tirzepatide',tirzep:'Tirzepatide',
    // Semaglutide
    sg:'Semaglutide',sem:'Semaglutide',sema:'Semaglutide',semaglutide:'Semaglutide',semag:'Semaglutide',
    // Ipamorelin
    ipa:'Ipamorelin',ipam:'Ipamorelin',ipamorelin:'Ipamorelin',
    // CJC-1295
    cjc:'CJC-1295',cjc1295:'CJC-1295',
    // BPC-157
    bpc:'BPC-157',bpc157:'BPC-157',
    // TB-500
    tb:'TB-500',tb500:'TB-500',
    // A few more common ones
    ghk:'GHK-Cu',ghkcu:'GHK-Cu',
    kpv:'KPV',
    pt141:'PT-141',pt:'PT-141',
    ghrp2:'GHRP-2',ghrp6:'GHRP-6',
    mt1:'Melanotan-1',mt2:'Melanotan-2',melanotan1:'Melanotan-1',melanotan2:'Melanotan-2',
    mots:'MOTS-c',motsc:'MOTS-c',
    epitalon:'Epitalon',epi:'Epitalon',
    hexarelin:'Hexarelin',hex:'Hexarelin',
    selank:'Selank',
    semax:'Semax',
    ss31:'SS-31',ss:'SS-31',
    // Compatibility: PEPTIDE_ALIASES was the old name used in some logs
  };
  window.PEPTIDE_ALIASES=PEPTIDE_ALIAS_ROOTS;

  // Peptide root names that CONTAIN numbers as part of the name itself (not a dose).
  // For these, we need to match the full "root+number" as the root before looking for dose.
  const PEPTIDE_NUMERIC_ROOTS=[
    // [regex-matching-the-name-with-number, canonical-root]
    [/^cjc[\s\-_]*1295/i,'CJC-1295'],
    [/^bpc[\s\-_]*157/i,'BPC-157'],
    [/^tb[\s\-_]*500/i,'TB-500'],
    [/^ghrp[\s\-_]*2/i,'GHRP-2'],
    [/^ghrp[\s\-_]*6/i,'GHRP-6'],
    [/^igf[\s\-_]*1(?:[\s\-_]*lr3)?/i,'IGF-1 LR3'],
    [/^ss[\s\-_]*31/i,'SS-31'],
    [/^mots[\s\-_]*c/i,'MOTS-c'],
    [/^pt[\s\-_]*141/i,'PT-141'],
    [/^mt[\s\-_]*1/i,'Melanotan-1'],
    [/^mt[\s\-_]*2/i,'Melanotan-2'],
    [/^aod[\s\-_]*9604/i,'AOD9604'],
  ];

  // Try to split a name like "RT20" or "Reta-20" into {root: 'Retatrutide', dose: '20mg'}.
  // Returns null if we can't parse it confidently.
  function aliasLookup(name){
    const t=(name||'').trim();
    if(!t)return null;
    const cleaned=t.replace(/^[\s\*\/\-_.,;:+]+/,'').trim();
    // FIRST — check if this is a "numeric root" peptide (CJC-1295, BPC-157, etc.).
    // Strip the root match, then look for the dose in what's left.
    for(const[pattern,root]of PEPTIDE_NUMERIC_ROOTS){
      const match=cleaned.match(pattern);
      if(match){
        const rest=cleaned.slice(match[0].length).trim();
        // Look for a dose in the remainder, allowing trailing junk
        const doseM=rest.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|iu|ml)?\b/i);
        if(doseM){
          const unit=(doseM[2]||'mg').toLowerCase();
          return{root,dose:doseM[1]+unit};
        }
        // No dose found — the row is just the root name ("BPC-157" with no dose)
        return{root,dose:''};
      }
    }
    // Fall back to simple short-alias matching
    const m=cleaned.match(/^([A-Za-z][A-Za-z\-]*?)[\s\-_]*(\d+(?:\.\d+)?)\s*(mg|mcg|iu|ml)?\b/i);
    if(!m)return null;
    const rootKey=m[1].toLowerCase().replace(/[\-_]/g,'');
    const canonicalRoot=PEPTIDE_ALIAS_ROOTS[rootKey];
    if(!canonicalRoot)return null;
    const unit=(m[3]||'mg').toLowerCase();
    const dose=m[2]+unit;
    return{root:canonicalRoot,dose};
  }

  function findRedundancyClusters(rowNames){
    const bySig={};
    rowNames.forEach(name=>{
      // Strategy 1: try alias lookup first — catches short SKUs like "RT20" that the catalog misses
      const aliased=aliasLookup(name);
      let canonical=null;
      let knownDose='';
      if(aliased){
        canonical=aliased.dose?aliased.root+' '+aliased.dose:aliased.root;
        knownDose=aliased.dose||'';
      }else{
        // Strategy 2: use the existing catalog machinery
        const dose=extractDoseFromName(name)||'';
        knownDose=dose;
        const base=dose?name.replace(new RegExp(dose.replace(/([.*+?^${}()|[\]\\])/g,'\\$1'),'i'),'').trim():name;
        canonical=normalizePeptideName(base,name,dose);
        if(!canonical){
          // Strategy 3: aggressive manual normalization as last resort
          const manual=_normPepStr(name);
          if(!manual||manual.length<3)return;  // skip — too ambiguous
          canonical=manual;
        }
      }
      // Normalize signature: strip any dose baked into canonical, then re-append a normalized
      // version of the known dose. This fixes the case where normalizePeptideName() returns
      // "Retatrutide" for one variant and "Retatrutide 20mg" for another — now both get the
      // same sig ("retatrutide20mg").
      const canonicalBase=canonical.replace(/\s*\d+(?:\.\d+)?\s*(mg|mcg|ml|iu|units)\s*$/i,'').trim();
      const normDose=(knownDose||'').toLowerCase().replace(/\s+/g,'');
      const sig=(canonicalBase.toLowerCase().replace(/\s+/g,'').replace(/[-_]/g,''))+normDose;
      if(!bySig[sig])bySig[sig]={members:[],canonical:canonicalBase+(knownDose?' '+knownDose:''),signature:sig};
      bySig[sig].members.push(name);
    });
    return Object.values(bySig)
      .filter(c=>c.members.length>=2)
      .map(c=>{
        // Default canonical: prefer a member that looks closest to the canonical form (has a dose)
        const withDose=c.members.filter(m=>extractDoseFromName(m));
        const pool=withDose.length?withDose:c.members;
        const suggested=[...pool].sort((a,b)=>b.length-a.length||a.localeCompare(b))[0];
        return{...c,canonical:suggested};
      })
      .sort((a,b)=>b.members.length-a.members.length);
  }

  function renderRedundancyClusters(clusters){
    const host=g('pc-clusters');
    if(!host)return;
    redundancyChoices={};
    if(!clusters.length){
      host.innerHTML='';
      host.style.display='none';
      return;
    }
    host.style.display='';
    const header='<h4 style="margin:1.25rem 0 .5rem;font-size:13px;font-weight:700;color:var(--accent-blue-fg);letter-spacing:.04em;text-transform:uppercase">🔀 Redundancy clusters — same peptide, different names</h4><div style="font-size:11.5px;color:var(--color-text-secondary);margin-bottom:.5rem">Pick which name should win for each cluster. When merged, price cells from all variants combine onto the canonical row (lowest price wins if a vendor had entries in multiple variants).</div>';
    const clusterRows=clusters.map((c,idx)=>{
      redundancyChoices[idx]={canonical:c.canonical,skip:false};
      const options=c.members.map(m=>'<option value="'+m.replace(/"/g,'&quot;')+'"'+(m===c.canonical?' selected':'')+'>'+escH(m)+'</option>').join('');
      const memberChips=c.members.map(m=>'<span class="mem-chip" style="display:inline-block;font-size:11px;padding:2px 8px;border-radius:5px;background:#EFF6FF;color:var(--accent-blue-fg);border:.5px solid #93C5FD;margin:1px 2px">'+escH(m)+'</span>').join('');
      return '<div class="redundancy-cluster" data-idx="'+idx+'" style="padding:10px 12px;border:.5px solid var(--color-border-secondary);border-radius:8px;margin-bottom:8px;background:var(--color-background-primary)">'
        +'<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">'
          +'<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;background:#EFF6FF;color:var(--accent-blue-fg)">'+c.members.length+' variants</span>'
          +'<div style="flex:1;min-width:180px">'+memberChips+'</div>'
        +'</div>'
        +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
          +'<span style="font-size:11px;color:var(--color-text-secondary);font-weight:600">Merge into:</span>'
          +'<select class="cluster-canon" data-idx="'+idx+'" style="font-size:12px;padding:3px 8px;border-radius:6px;flex:1;min-width:180px">'+options+'</select>'
          +'<label style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--color-text-secondary);cursor:pointer"><input type="checkbox" class="cluster-skip" data-idx="'+idx+'"> skip (keep all)</label>'
        +'</div>'
      +'</div>';
    }).join('');
    host.innerHTML=header+clusterRows;
    // Wire selection changes
    host.querySelectorAll('.cluster-canon').forEach(sel=>sel.addEventListener('change',e=>{
      const idx=parseInt(e.target.dataset.idx);
      if(redundancyChoices[idx])redundancyChoices[idx].canonical=e.target.value;
    }));
    host.querySelectorAll('.cluster-skip').forEach(cb=>cb.addEventListener('change',e=>{
      const idx=parseInt(e.target.dataset.idx);
      if(redundancyChoices[idx])redundancyChoices[idx].skip=e.target.checked;
      // Grey out the whole cluster when skipped
      const card=host.querySelector('.redundancy-cluster[data-idx="'+idx+'"]');
      if(card)card.style.opacity=e.target.checked?.5:1;
    }));
  }

  // Merge all non-skipped clusters: for each cluster, take the canonical row and
  // combine price cells from the other members. Lowest price wins per vendor.
  // Then delete the non-canonical rows.
  function applyRedundancyMerges(){
    let merged=0;
    Object.entries(redundancyChoices).forEach(([idx,choice])=>{
      if(choice.skip)return;
      const cluster=cleanupClusters[idx];
      if(!cluster||!cluster.members)return;
      const canonical=choice.canonical;
      const canonicalRow=S.prices[canonical]||(S.prices[canonical]={});
      cluster.members.forEach(m=>{
        if(m===canonical)return;
        const srcRow=S.prices[m]||{};
        Object.entries(srcRow).forEach(([vendor,price])=>{
          if(price==null)return;
          const existing=canonicalRow[vendor];
          if(existing==null||(+price>0&&+price<+existing)){
            canonicalRow[vendor]=price;
          }
        });
        delete S.prices[m];
      });
      merged++;
    });
    return merged;
  }

  function openCleanup(){
    // PASS 1 — Auto-delete trivial garbage (Discord handles, category labels, UPS/FedEx, etc.)
    // These rules are conservative enough that we don't need to ask for confirmation.
    const autoDeletedNames=[];
    const peps=Object.keys(S.prices||{});
    peps.forEach(p=>{
      const r=suspicionReason(p);
      if(r&&r.autoDelete){
        delete S.prices[p];
        autoDeletedNames.push(p);
      }
    });
    if(autoDeletedNames.length){
      save();
      renderPrices();
    }
    // PASS 2 — Build the flagged list from remaining suspicious rows (minus the ones we already deleted)
    const remaining=Object.keys(S.prices||{});
    const flagged=[];
    remaining.forEach(p=>{
      const r=suspicionReason(p);
      if(r&&!r.autoDelete){
        const suggestion=suggestForCleanup(p);
        flagged.push({name:p,reason:r.reason,canRecover:r.canRecover,suggestion});
      }
    });
    // PASS 3 — Redundancy clusters. Group rows by their normalized-canonical name.
    const redundancyClusters=findRedundancyClusters(remaining);
    // Diagnostic: log signatures to help debug clustering. Remove once the feature is proven.
    try{
      const sigMap={};
      remaining.forEach(name=>{
        const aliased=aliasLookup(name);
        let canonical=null;
        if(aliased){canonical=aliased.dose?aliased.root+' '+aliased.dose:aliased.root;}
        else{
          const dose=extractDoseFromName(name)||'';
          const base=dose?name.replace(new RegExp(dose.replace(/([.*+?^${}()|[\]\\])/g,'\\$1'),'i'),'').trim():name;
          canonical=normalizePeptideName(base,name,dose);
          if(!canonical){const manual=_normPepStr(name);if(manual&&manual.length>=3)canonical=manual;else return;}
        }
        const sig=canonical.toLowerCase().replace(/\s+/g,'').replace(/[-_]/g,'');
        if(!sigMap[sig])sigMap[sig]=[];
        sigMap[sig].push(name);
      });
      const dupes=Object.entries(sigMap).filter(([_,names])=>names.length>=2);
      dbg('[cleanup] '+remaining.length+' rows scanned, '+Object.keys(sigMap).length+' unique sigs, '+dupes.length+' duplicate groups');
      if(dupes.length)dbg('[cleanup] duplicate groups:',dupes);
      // Show a few sample canonical mappings so we can see if detection is working
      dbg('[cleanup] sample mappings:',remaining.slice(0,10).map(n=>{
        const a=aliasLookup(n);
        return {name:n,alias:a?(a.dose?a.root+' '+a.dose:a.root):null};
      }));
    }catch(e){console.warn('[cleanup] diag failed:',e);}
    cleanupState={};
    flagged.forEach(f=>{cleanupState[f.name]={action:f.canRecover?'keep':'delete',target:''};});
    const targets=remaining.filter(p=>!flagged.some(f=>f.name===p)).sort();
    const withSuggestions=flagged.filter(f=>f.suggestion).length;
    // Summary line — show what auto-deleted, what's flagged, and how many clusters found
    const summaryBits=[];
    if(autoDeletedNames.length)summaryBits.push('✅ Auto-deleted <b>'+autoDeletedNames.length+'</b> garbage row'+(autoDeletedNames.length===1?'':'s'));
    if(flagged.length)summaryBits.push('⚠ <b>'+flagged.length+'</b> flagged for review'+(withSuggestions>0?' · <b style="color:var(--accent-green-fg)">💡 '+withSuggestions+' with suggestions</b>':''));
    if(redundancyClusters.length)summaryBits.push('🔀 <b>'+redundancyClusters.length+'</b> redundancy cluster'+(redundancyClusters.length===1?'':'s')+' (same peptide, different spellings)');
    if(!summaryBits.length){
      g('pc-summary').innerHTML='<div style="padding:1.5rem 1rem;text-align:center;color:var(--color-text-secondary);background:var(--color-background-secondary);border-radius:8px"><div style="font-size:32px;margin-bottom:.5rem">✨</div><div style="font-weight:600;color:var(--color-text-primary);margin-bottom:4px">Everything looks clean</div><div style="font-size:12px">No garbage or redundancy found across '+remaining.length+' peptide rows.</div></div>';
    }else{
      g('pc-summary').innerHTML=summaryBits.join(' · ');
    }
    cleanupFlagged=flagged;cleanupTargets=targets;cleanupClusters=redundancyClusters;
    renderCleanupRows(flagged,targets);
    renderRedundancyClusters(redundancyClusters);
    updateCleanupPending();
    g('pc-apply').disabled=flagged.length===0&&redundancyClusters.length===0;
    g('pc-apply').style.opacity=(flagged.length===0&&redundancyClusters.length===0)?.5:1;
    g('pc-suggest-all').style.display=withSuggestions>0?'':'none';
    g('pc-modal').style.display='block';
  }
  let cleanupFlagged=[];let cleanupTargets=[];let cleanupClusters=[];
  function renderCleanupRows(flagged,targets){
    const targetOpts='<option value="">— pick target —</option>'+targets.map(t=>'<option value="'+t.replace(/"/g,'&quot;')+'">'+escH(t)+'</option>').join('');
    g('pc-rows').innerHTML=flagged.map(f=>{
      const row=S.prices[f.name]||{};
      const vendorList=Object.keys(row).filter(v=>row[v]!=null);
      const pricesText=vendorList.length?vendorList.map(v=>v+': $'+row[v]).join(' · '):'no prices';
      const state=cleanupState[f.name]||{action:'keep',target:''};
      const reasonColor=f.canRecover?'#92400E':'#A32D2D';
      const reasonBg=f.canRecover?'#FEF3C7':'#FEE2E2';
      // Suggestion block (if any). Confidence sets the background color.
      let sugHtml='';
      if(f.suggestion){
        const confBg={high:'#D1FAE5',medium:'#DBEAFE',low:'#F3F4F6'}[f.suggestion.conf]||'#F3F4F6';
        const confColor={high:'#065F46',medium:'#1E40AF',low:'#4B5563'}[f.suggestion.conf]||'#4B5563';
        sugHtml='<div class="pc-suggestion" data-name="'+f.name.replace(/"/g,'&quot;')+'" data-target="'+f.suggestion.name.replace(/"/g,'&quot;')+'" style="display:flex;align-items:center;gap:8px;margin:4px 0 6px;padding:6px 10px;background:'+confBg+';border-radius:6px;font-size:11.5px;color:'+confColor+'">'
          +'<span>💡</span><span><b>Looks like:</b> '+escH(f.suggestion.name)+' <span style="opacity:.75">('+f.suggestion.conf+' confidence — '+escH(f.suggestion.reason)+')</span></span>'
          +'<button class="btn pc-sug-apply" data-name="'+f.name.replace(/"/g,'&quot;')+'" style="margin-left:auto;padding:2px 9px;font-size:11px;border-color:'+confColor+';color:'+confColor+'">Apply suggestion</button>'
        +'</div>';
      }
      return'<div class="pc-row" data-name="'+f.name.replace(/"/g,'&quot;')+'" style="padding:10px 12px;border-bottom:.5px solid var(--color-border-tertiary)">'
        +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">'
          +'<span style="font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:600;color:var(--color-text-primary);font-size:12.5px">'+escH(f.name)+'</span>'
          +'<span style="font-size:10px;padding:2px 7px;border-radius:5px;background:'+reasonBg+';color:'+reasonColor+';font-weight:600">'+f.reason+'</span>'
          +'<span style="font-size:10.5px;color:var(--color-text-tertiary);margin-left:auto">'+vendorList.length+' vendor'+(vendorList.length===1?'':'s')+'</span>'
        +'</div>'
        +(vendorList.length?'<div style="font-size:10.5px;color:var(--color-text-secondary);margin-bottom:6px;font-family:ui-monospace,Menlo,Consolas,monospace;line-height:1.45">'+escH(pricesText)+'</div>':'')
        +sugHtml
        +'<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
          +'<label class="pc-act" style="display:inline-flex;align-items:center;gap:3px;font-size:11.5px;cursor:pointer;padding:3px 8px;border-radius:6px;'+(state.action==='delete'?'background:#FEE2E2;color:var(--accent-red-fg);font-weight:600':'color:var(--color-text-secondary)')+'"><input type="radio" name="pc-'+encodeURIComponent(f.name)+'" value="delete" '+(state.action==='delete'?'checked':'')+' style="margin:0"> 🗑 Delete</label>'
          +'<label class="pc-act" style="display:inline-flex;align-items:center;gap:3px;font-size:11.5px;cursor:pointer;padding:3px 8px;border-radius:6px;'+(state.action==='merge'?'background:#DBEAFE;color:var(--accent-blue-fg);font-weight:600':'color:var(--color-text-secondary)')+'"><input type="radio" name="pc-'+encodeURIComponent(f.name)+'" value="merge" '+(state.action==='merge'?'checked':'')+' style="margin:0"> 🔀 Merge into</label>'
          +'<select class="pc-merge-target" data-name="'+f.name.replace(/"/g,'&quot;')+'" style="font-size:11.5px;padding:3px 7px;max-width:220px;'+(state.action==='merge'?'':'opacity:.5;pointer-events:none')+'">'+targetOpts+'</select>'
          +'<label class="pc-act" style="display:inline-flex;align-items:center;gap:3px;font-size:11.5px;cursor:pointer;padding:3px 8px;border-radius:6px;'+(state.action==='rename'?'background:#D1FAE5;color:var(--accent-green-fg);font-weight:600':'color:var(--color-text-secondary)')+'"><input type="radio" name="pc-'+encodeURIComponent(f.name)+'" value="rename" '+(state.action==='rename'?'checked':'')+' style="margin:0"> ✎ Rename</label>'
          +'<input type="text" class="pc-rename-val" data-name="'+f.name.replace(/"/g,'&quot;')+'" placeholder="new name" value="'+(state.action==='rename'?(state.target||'').replace(/"/g,'&quot;'):'')+'" style="font-size:11.5px;padding:3px 7px;max-width:180px;'+(state.action==='rename'?'':'opacity:.5;pointer-events:none')+'">'
          +'<label class="pc-act" style="display:inline-flex;align-items:center;gap:3px;font-size:11.5px;cursor:pointer;padding:3px 8px;border-radius:6px;'+(state.action==='keep'?'background:var(--color-background-secondary);color:var(--color-text-primary);font-weight:600':'color:var(--color-text-secondary)')+'"><input type="radio" name="pc-'+encodeURIComponent(f.name)+'" value="keep" '+(state.action==='keep'?'checked':'')+' style="margin:0"> Keep</label>'
        +'</div>'
      +'</div>';
    }).join('')||'<div style="padding:1rem;color:var(--color-text-secondary);font-size:12px">No flagged rows.</div>';
  }
  function updateCleanupPending(){
    const counts={delete:0,merge:0,rename:0,keep:0};
    Object.values(cleanupState).forEach(s=>{counts[s.action]=(counts[s.action]||0)+1;});
    const parts=[];
    if(counts.delete)parts.push('🗑 '+counts.delete+' to delete');
    if(counts.merge)parts.push('🔀 '+counts.merge+' to merge');
    if(counts.rename)parts.push('✎ '+counts.rename+' to rename');
    if(counts.keep)parts.push(counts.keep+' keep');
    g('pc-pending').textContent=parts.join(' · ');
  }
  function closeCleanup(){g('pc-modal').style.display='none';}

  wireId('pc-rows','click',e=>{
    const sa=e.target.closest('.pc-sug-apply');
    if(!sa)return;
    const name=sa.dataset.name;
    const row=sa.closest('.pc-row');
    const sugBlock=row?row.querySelector('.pc-suggestion'):null;
    const target=sugBlock?sugBlock.dataset.target:'';
    if(!target)return;
    cleanupState[name]={action:'rename',target};
    renderCleanupRows(cleanupFlagged,cleanupTargets);
    updateCleanupPending();
  });
  wireId('pc-suggest-all','click',()=>{
    let applied=0;
    cleanupFlagged.forEach(f=>{
      if(f.suggestion){
        cleanupState[f.name]={action:'rename',target:f.suggestion.name};
        applied++;
      }
    });
    renderCleanupRows(cleanupFlagged,cleanupTargets);
    updateCleanupPending();
  });
  wireId('pc-rows','change',e=>{
    const radio=e.target.closest('input[type=radio]');
    if(radio){
      const card=radio.closest('.pc-row');if(!card)return;
      const name=card.dataset.name;
      cleanupState[name]=cleanupState[name]||{action:'keep',target:''};
      cleanupState[name].action=radio.value;
      // Re-render this single row to update styling + input enabled state
      const flagged=Object.keys(cleanupState).map(n=>{const r=suspicionReason(n);return{name:n,reason:r?r.reason:'flagged',canRecover:r?r.canRecover:false};});
      const targets=Object.keys(S.prices||{}).filter(p=>!cleanupState[p]).sort();
      renderCleanupRows(flagged,targets);
      updateCleanupPending();
      return;
    }
    const mt=e.target.closest('.pc-merge-target');
    if(mt){
      const name=mt.dataset.name;
      cleanupState[name]=cleanupState[name]||{action:'merge',target:''};
      cleanupState[name].target=mt.value;
      cleanupState[name].action='merge';
      return;
    }
  });
  wireId('pc-rows','input',e=>{
    const rn=e.target.closest('.pc-rename-val');
    if(!rn)return;
    const name=rn.dataset.name;
    cleanupState[name]=cleanupState[name]||{action:'rename',target:''};
    cleanupState[name].target=rn.value;
  });
  wireId('pc-mark-all-del','click',()=>{
    Object.keys(cleanupState).forEach(n=>{cleanupState[n].action='delete';cleanupState[n].target='';});
    renderCleanupRows(cleanupFlagged,cleanupTargets);
    updateCleanupPending();
  });
  wireId('pc-mark-all-keep','click',()=>{
    Object.keys(cleanupState).forEach(n=>{cleanupState[n].action='keep';cleanupState[n].target='';});
    renderCleanupRows(cleanupFlagged,cleanupTargets);
    updateCleanupPending();
  });
  wireId('pc-close','click',closeCleanup);
  wireId('pc-cancel','click',closeCleanup);
  wireId('pc-apply','click',()=>{
    const flagged=Object.keys(cleanupState);
    const hasClusters=Object.keys(redundancyChoices||{}).length>0;
    if(!flagged.length&&!hasClusters){closeCleanup();return;}
    // Validate merge/rename selections
    const missing=[];
    flagged.forEach(n=>{
      const s=cleanupState[n];
      if(s.action==='merge'&&!s.target)missing.push(n+' (merge target not selected)');
      if(s.action==='rename'&&!(s.target||'').trim())missing.push(n+' (new name not filled in)');
    });
    if(missing.length){alert('Cannot apply — the following rows are incomplete:\n\n'+missing.slice(0,6).join('\n')+(missing.length>6?'\n…and '+(missing.length-6)+' more':''));return;}
    takePriceSnapshot('cleanup');
    flagged.forEach(n=>{
      const s=cleanupState[n];
      if(s.action==='delete'){
        delete S.prices[n];
      }else if(s.action==='merge'){
        const target=s.target;
        if(!S.prices[target])S.prices[target]={};
        const source=S.prices[n]||{};
        Object.keys(source).forEach(v=>{
          const existing=S.prices[target][v];
          const incoming=source[v];
          if(existing==null)S.prices[target][v]=incoming;
          else if(+incoming>0&&+incoming<+existing)S.prices[target][v]=incoming;
        });
        delete S.prices[n];
      }else if(s.action==='rename'){
        const newName=s.target.trim();
        if(newName&&newName!==n){
          // If the new name already exists, merge; otherwise rename key
          if(S.prices[newName]){
            const source=S.prices[n]||{};
            Object.keys(source).forEach(v=>{
              const existing=S.prices[newName][v];
              const incoming=source[v];
              if(existing==null)S.prices[newName][v]=incoming;
              else if(+incoming>0&&+incoming<+existing)S.prices[newName][v]=incoming;
            });
          }else{
            S.prices[newName]=S.prices[n];
          }
          delete S.prices[n];
        }
      }
      // 'keep' is a no-op
    });
    // Apply redundancy cluster merges
    const mergedClusters=applyRedundancyMerges();
    save();closeCleanup();renderPrices();
    if(mergedClusters>0){
      // Brief toast-style message via the save indicator
      try{showSaved();}catch(e){}
    }
  });
  wireId('pt-cleanup','click',openCleanup);

  // Filter + sort bar (legacy pv-* matrix — skip when vpr row template is active)
  let pvSearchTimer=null;
  // Auto-detect pf-cat from pf-nm when the cat field is empty
  (function(){
    const nm=g('pf-nm');
    if(nm && !nm.__catWire){
      nm.__catWire=true;
      nm.addEventListener('blur', autoDetectCatFromName);
    }
  })();
  wireId('pv-search','input',e=>{
    clearTimeout(pvSearchTimer);
    pvSearchTimer=setTimeout(()=>{priceView.search=e.target.value.trim();renderPrices();},150);
  });
  wireId('pv-category','change',e=>{priceView.category=e.target.value;renderPrices();});
  wireId('pv-vendor','change',e=>{priceView.vendor=e.target.value;renderPrices();});
  wireId('pv-sort','change',e=>{priceView.sort=e.target.value;renderPrices();});
  // Top-N toggle pill + metric dropdown
  (function(){
    const STORE='tmp.priceView.topN', STORE_M='tmp.priceView.topMetric';
    try{
      const saved=localStorage.getItem(STORE);
      if(saved==='1')priceView.topN=true;
      const m=localStorage.getItem(STORE_M);
      if(m==='vendors'||m==='cheapest'||m==='spread')priceView.topMetric=m;
    }catch(_){}
    const tBtn=g('pv-topn-toggle'), mSel=g('pv-topn-metric');
    if(!tBtn||!mSel)return;
    function paint(){
      if(priceView.topN){
        tBtn.style.background='#FBBF24';
        tBtn.style.borderColor='#D97706';
        tBtn.style.color='#78350F';
        tBtn.textContent='✓ Top 20';
        mSel.style.display='';
      }else{
        tBtn.style.background='var(--color-background-primary)';
        tBtn.style.borderColor='var(--color-border-secondary)';
        tBtn.style.color='var(--color-text-secondary)';
        tBtn.textContent='⭐ Top 20';
        mSel.style.display='none';
      }
      mSel.value=priceView.topMetric;
    }
    paint();
    tBtn.addEventListener('click',()=>{
      priceView.topN=!priceView.topN;
      try{localStorage.setItem(STORE,priceView.topN?'1':'0');}catch(_){}
      paint();renderPrices();
    });
    mSel.addEventListener('change',e=>{
      priceView.topMetric=e.target.value;
      try{localStorage.setItem(STORE_M,priceView.topMetric);}catch(_){}
      renderPrices();
    });
  })();
  wireId('pv-reset','click',()=>{
    priceView={search:'',category:'',vendor:'',sort:'name-asc',topN:false,topMetric:'vendors'};
    sv('pv-search','');sv('pv-category','');sv('pv-vendor','');sv('pv-sort','name-asc');
    try{localStorage.setItem('tmp.priceView.topN','0');}catch(_){}
    const _tBtn=g('pv-topn-toggle'),_mSel=g('pv-topn-metric');
    if(_tBtn){_tBtn.style.background='var(--color-background-primary)';_tBtn.style.borderColor='var(--color-border-secondary)';_tBtn.style.color='var(--color-text-secondary)';_tBtn.textContent='⭐ Top 20';}
    if(_mSel){_mSel.style.display='none';_mSel.value='vendors';}
    renderPrices();
  });

  function openImporter(){
    // VP-1-fix: ensure prices table and layout are current before showing importer
    window.__renderPricesForceNext=true;
    renderPrices();
    applyPricesLayout();
    // Populate vendor datalist
    const dl=g('pi-vendors-dl');
    dl.innerHTML=(S.vendors||[]).map(v=>'<option value="'+v.replace(/"/g,'&quot;')+'">').join('');
    g('pi-step1').style.display='block';
    g('pi-step2').style.display='none';
    g('pi-err').textContent='';
    g('pi-modal').style.display='block';
    setTimeout(()=>g('pi-vendor').focus(),50);
  }
  function closeImporter(){g('pi-modal').style.display='none';}

  // ---- PDF → text (lazy-loads PDF.js from CDN on first use) ----
  let _pdfjsPromise=null;
  function loadPdfjs(){
    if(_pdfjsPromise)return _pdfjsPromise;
    _pdfjsPromise=new Promise((resolve,reject)=>{
      const existing=window['pdfjs-dist/build/pdf']||window.pdfjsLib;
      if(existing){resolve(existing);return;}
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload=()=>{
        const lib=window['pdfjs-dist/build/pdf']||window.pdfjsLib;
        if(!lib){reject(new Error('PDF.js loaded but global was not found'));return;}
        lib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(lib);
      };
      s.onerror=()=>reject(new Error('Failed to fetch PDF.js — check your network connection'));
      document.head.appendChild(s);
    });
    return _pdfjsPromise;
  }
  async function extractPdfText(file,onProgress){
    const lib=await loadPdfjs();
    const buf=await file.arrayBuffer();
    const pdf=await lib.getDocument({data:buf}).promise;
    const allLines=[];
    for(let i=1;i<=pdf.numPages;i++){
      if(onProgress)onProgress(i,pdf.numPages);
      const page=await pdf.getPage(i);
      const content=await page.getTextContent();
      // Bucket text items by rounded Y so items on the same visual line group together.
      // PDFs report positions from the bottom-left, so higher Y = higher on the page.
      const byLine=new Map();
      for(const item of content.items){
        if(!item.str||!item.str.trim())continue;
        const y=Math.round(item.transform[5]);
        // Merge Y values within 2px of an existing line (handles small baseline jitter)
        let key=y;
        for(const existingY of byLine.keys()){if(Math.abs(existingY-y)<=2){key=existingY;break;}}
        if(!byLine.has(key))byLine.set(key,[]);
        byLine.get(key).push({x:item.transform[4],str:item.str});
      }
      const ys=[...byLine.keys()].sort((a,b)=>b-a);
      for(const y of ys){
        const items=byLine.get(y).sort((a,b)=>a.x-b.x);
        // Join items on the same line with a tab so the parser can treat them as columns.
        // Also collapse runs of large X gaps into tabs.
        let line='';
        let lastEnd=null;
        for(const it of items){
          if(lastEnd!==null&&it.x-lastEnd>8)line+='\t';
          else if(lastEnd!==null)line+=' ';
          line+=it.str;
          lastEnd=it.x+(it.str.length*4); // crude width estimate
        }
        if(line.trim())allLines.push(line.trim());
      }
    }
    return allLines.join('\n');
  }

  wireId('pi-pdf-file','change',async function(){
    const file=this.files&&this.files[0];
    const status=g('pi-pdf-status');
    const clearBtn=g('pi-pdf-clear');
    if(!file){status.textContent='';clearBtn.style.display='none';return;}
    if(file.type&&file.type.indexOf('pdf')<0){status.style.color='#A32D2D';status.textContent='Not a PDF file.';return;}
    status.style.color='var(--color-text-secondary)';
    status.textContent='Loading PDF.js library…';
    clearBtn.style.display='';
    try{
      const text=await extractPdfText(file,(cur,total)=>{status.textContent='Reading page '+cur+' of '+total+'…';});
      if(!text||!text.trim()){
        status.style.color='#92400E';
        status.textContent='⚠ No text found. This looks like a scanned/image PDF — OCR would be needed. Try the paste method instead.';
        return;
      }
      sv('pi-text',text);
      // Auto-detect vendor from PDF (filename → first 20 lines), only if user
      // hasn't already typed one. Word-boundary, case-insensitive matching
      // against S.vendors. Filename hyphens/underscores normalized to spaces
      // so "jeep-pricelist.pdf" matches the vendor "JEEP".
      let detectedVendor=null;
      const vendorEl=g('pi-vendor');
      if(vendorEl && !vendorEl.value.trim() && Array.isArray(S.vendors) && S.vendors.length){
        const fname=(file.name||'').replace(/\.pdf$/i,'').replace(/[-_.]+/g,' ').toUpperCase();
        for(const v of S.vendors){
          const vU=String(v).toUpperCase();
          if(!vU)continue;
          const re=new RegExp('\\b'+vU.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b');
          if(re.test(fname)){detectedVendor=v;break;}
        }
        if(!detectedVendor){
          const head=text.split(/\r?\n/).slice(0,20).join(' ').toUpperCase();
          const scores={};
          for(const v of S.vendors){
            const vU=String(v).toUpperCase();
            if(!vU)continue;
            const re=new RegExp('\\b'+vU.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','g');
            const matches=head.match(re);
            if(matches&&matches.length)scores[v]=matches.length;
          }
          const top=Object.entries(scores).sort((a,b)=>b[1]-a[1])[0];
          if(top)detectedVendor=top[0];
        }
        if(detectedVendor)sv('pi-vendor',detectedVendor);
      }
      status.style.color='#065F46';
      status.textContent='✓ Extracted '+text.split(/\r?\n/).length+' line(s) from '+file.name+(detectedVendor?' · vendor: '+detectedVendor:'')+'. Review the text below, then click Parse.';
    }catch(err){
      console.error(err);
      status.style.color='#A32D2D';
      status.textContent='✕ '+(err.message||'Failed to read PDF.');
    }
  });
  wireId('pi-pdf-clear','click',()=>{
    g('pi-pdf-file').value='';
    g('pi-pdf-status').textContent='';
    g('pi-pdf-clear').style.display='none';
  });
  wireId('pt-import','click',openImporter);
  wireId('pi-close','click',closeImporter);
  wireId('pi-modal','click',e=>{if(e.target.id==='pi-modal')closeImporter();});
  wireId('pi-parse','click',()=>{
    const vendor=gv('pi-vendor').trim();
    const txt=gv('pi-text');
    const err=g('pi-err');err.textContent='';
    if(!vendor){err.textContent='Enter a vendor name.';return;}
    if(!txt.trim()){err.textContent='Paste the vendor\'s price list text first.';return;}
    const parsed=parsePriceText(txt);
    if(parsed.length===0){err.textContent='No price-bearing lines detected. The text needs price tokens on each row.';return;}
    // Match each row to existing peptides before deciding whether to dose-suffix for dedup.
    // This way if the user has RT20, RT30 etc., SKU matches make the import update existing rows
    // instead of creating parallel "Retatrutide 20mg" entries.
    const existing=Object.keys(S.prices||{});
    parsed.forEach(r=>{r.originalName=r.name;});
    parsed.forEach(r=>{
      const m=matchPeptideName(r,existing);
      if(m.type==='sku'||m.type==='exact')r.name=m.match;
    });
    // Prevent silent overwrites: when multiple parsed rows end up pointing at the same name
    // (e.g. "Reta 5mg / Reta 20mg / Reta 30mg" all matched the existing "Reta" peptide),
    // keep the first row as-is and dose-suffix the rest so every size becomes its own entry.
    const seen=new Set();
    parsed.forEach(r=>{
      if(seen.has(r.name)&&r.dose)r.name=r.name+' '+r.dose;
      seen.add(r.name);
      r.include=true;
    });
    piRows=parsed;
    g('pi-step1').style.display='none';
    g('pi-step2').style.display='block';
    renderImportPreview();
  });
  wireId('pi-back','click',()=>{g('pi-step1').style.display='block';g('pi-step2').style.display='none';});
  wireId('pi-toggle-all','click',()=>{
    const anyOff=piRows.some(r=>!r.include);
    piRows.forEach(r=>r.include=anyOff);
    renderImportPreview();
  });
  wireId('pi-commit','click',()=>{
    const vendorInput=gv('pi-vendor').trim();
    if(!vendorInput)return;
    // Snapshot current price state so the user can Undo this import later
    takePriceSnapshot('last import');
    // Always use the canonical vendor name that matches the table column.
    // If a vendor with the same name (case-insensitive) already exists, reuse its casing
    // so prices land under the same key the price-table lookup uses.
    // v17: vendors are stored UPPERCASE; match case-insensitively, push uppercase.
    const _vUp=String(vendorInput||'').trim().toUpperCase();
    let vendor=S.vendors.find(v=>String(v||'').toUpperCase()===_vUp);
    if(!vendor){vendor=_vUp;S.vendors.push(vendor);}
    let imported=0,added=0;
    piRows.filter(r=>r.include).forEach(r=>{
      const nm=r.name.trim();if(!nm||!r.price)return;
      if(!S.prices[nm]){S.prices[nm]={};added++;}
      S.prices[nm][vendor]=r.price;
      imported++;
    });
    save();closeImporter();renderPrices();
    // Brief confirmation
    const msg=document.createElement('div');
    msg.textContent='✓ Imported '+imported+' price(s) for '+vendor+(added?' · '+added+' new peptide(s) added':'');
    msg.style.cssText='position:fixed;top:20px;right:20px;background:#059669;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600;z-index:10000;box-shadow:0 4px 16px rgba(5,150,105,0.35)';
    document.body.appendChild(msg);
    setTimeout(()=>msg.remove(),3200);
  });
  // Sample demo text (JEEP vendor — transcribed from a sample price list)
  wireId('pi-demo','click',()=>{
    if(!gv('pi-vendor'))sv('pi-vendor','JEEP');
    sv('pi-text',
      'GLOW50\tGLOW(CU30+BP10+TB5)mixed\t50mg\t$155\t10vials/kit\t50mg/vial\n'
      +'GLOW70\tGLOW(CU50+BP10+TB10)mixed\t70mg\t$180\t10vials/kit\t70mg/vial\n'
      +'TB10\tTB-500\t10mg\t$130\t10vials/kit\t10mg/vial\n'
      +'CU50\tGHK-CU\t50mg\t$48\t10vials/kit\t50mg/vial\n'
      +'CU100\tGHK-CU\t100mg\t$78\t10vials/kit\t100mg/vial\n'
      +'KLOW80\tKlow (cu+bpc+tb+kpv) mixed\t80mg\t$190\t10vials/kit\t80mg/vial\n'
      +'BPC10\tBPC-157\t10mg\t$60\t10vials/kit\t10mg/vial\n'
      +'RT10\tRetatrutide\t10mg\t$110\t10vials/kit\t10mg/vial\n'
      +'RT20\tRetatrutide\t20mg\t$170\t10vials/kit\t20mg/vial\n'
      +'RT30\tRetatrutide\t30mg\t$230\t10vials/kit\t30mg/vial\n'
      +'RT40\tRetatrutide\t40mg\t$280\t10vials/kit\t40mg/vial\n'
      +'RT50\tRetatrutide\t50mg\t$320\t10vials/kit\t50mg/vial\n'
      +'RT60\tRetatrutide\t60mg\t$360\t10vials/kit\t60mg/vial\n'
      +'TR10\tTirzepatide\t10mg\t$78\t10vials/kit\t10mg/vial\n'
      +'TR20\tTirzepatide\t20mg\t$108\t10vials/kit\t20mg/vial\n'
      +'TR30\tTirzepatide\t30mg\t$138\t10vials/kit\t30mg/vial\n'
      +'TR40\tTirzepatide\t40mg\t$170\t10vials/kit\t40mg/vial\n'
      +'TR60\tTirzepatide\t60mg\t$250\t10vials/kit\t60mg/vial\n'
      +'TESA10\tTesamorelin\t10mg\t$158\t10vials/kit\t10mg/vial\n'
      +'MOTS-C10\tMots-c\t10mg\t$70\t10vials/kit\t10mg/vial\n'
      +'MOTS-C40\tMots-c\t40mg\t$200\t10vials/kit\t40mg/vial\n'
      +'SX10\tSemax\t10mg\t$55\t10vials/kit\t10mg/vial\n'
      +'SK10\tSelank\t10mg\t$55\t10vials/kit\t10mg/vial\n'
      +'EPI10\tEpithalon\t10mg\t$55\t10vials/kit\t10mg/vial\n'
      +'SS31\tSS31\t10mg\t$100\t10vials/kit\t10mg/vial\n'
      +'IPA10\tIpamorelin\t10mg\t$75\t10vials/kit\t10mg/vial\n'
      +'CJC10\tCJC10 1295(NO DAC)\t10mg\t$155\t10vials/kit\t10mg/vial\n'
      +'BB10\tTB5+BPC5\t10mg\t$120\t10vials/kit\t10mg/vial\n'
      +'KPV\tKPV\t10mg\t$55\t10vials/kit\t10mg/vial\n'
      +'BAC3\tBACwater\t3ml\t$10\t10vials/kit\t3ml\n'
      +'BAC10\tBACwater\t10ml\t$25\t10vials/kit\t10ml'
    );
  });
  // Sample demo text (HKMS vendor — no currency symbol, multiple warehouse columns)
  wireId('pi-demo-hkms','click',()=>{
    if(!gv('pi-vendor'))sv('pi-vendor','HKMS');
    sv('pi-text',
      'SM5\tSemaglutide\t5mg*10vials\t122\t0\t44\n'
      +'SM10\tSemaglutide\t10mg*10vials\t0\t0\t55\n'
      +'SM20\tSemaglutide\t20mg*10vials\t0\t0\t85\n'
      +'TR5\tTIRZ\t5mg*10vials\t0\t7\t45\n'
      +'TR10\tTIRZ\t10mg*10vials\t0\t114\t65\n'
      +'TR15\tTIRZ\t15mg*10vials\t0\t50\t82\n'
      +'TR30\tTIRZ\t30mg*10vials\t200\t0\t129\n'
      +'TR40\tTIRZ\t40mg*10vials\t0\t0\t175\n'
      +'TR60\tTIRZ\t60mg*10vials\t0\t0\t240\n'
      +'RT5\tRETA\t5mg*10vials\t0\t0\t75\n'
      +'RT10\tRETA\t10mg*10vials\t0\t0\t110\n'
      +'RT20\tRETA\t20mg*10vials\t0\t0\t180\n'
      +'RT30\tRETA\t30mg*10vials\t100\t0\t250\n'
      +'H10\tHGH\t10iu*10vials\t150\t2\t56\n'
      +'H12\tHGH\t12iu*10vials\t0\t0\t70\n'
      +'H20\tHGH\t20iu*10vials\t0\t0\t97\n'
      +'H24\tHGH\t24iu*10vials\t0\t0\t107\n'
      +'H36\tHGH\t36iu*10vials\t0\t0\t169\n'
      +'BC5\tBPC 157\t5mg*10vials\t168\t63\t44\n'
      +'BC10\tBPC 157\t10mg*10vials\t0\t0\t80\n'
      +'TB5\tTB500\t5mg*10vials\t43\t83\t77\n'
      +'BB10\tBPC 5mg + TB 5mg\t10mg*10vials\t0\t0\t108\n'
      +'GLOW\tBPC 157 10mg+GHK-CU\t70mg*10vials\t50\t0\t219\n'
      +'2S10\tSS-31\t10mg*10vials\t0\t0\t80\n'
      +'5AD\tAOD9604\t5mg*10vials\t0\t0\t90\n'
      +'MS10\tMOTS-c\t10mg*10vials\t0\t0\t73\n'
      +'MT2\tMT-2 (Melanotan 2 Acetate)\t10mg*10vials\t0\t0\t66\n'
      +'G65\tGHRP-6 Acetate\t5mg*10vials\t508\t3\t50\n'
      +'PT41\tPT-141\t10mg*10vials\t0\t33\t71\n'
      +'ET10\tEpithalon\t10mg*10vials\t38\t51\t62\n'
      +'DS10\tDSIP\t10mg*10vials\t43\t0\t70\n'
      +'KP10\tKPV\t10mg*10vials\t149\t371\t62\n'
      +'XA10\tSemax\t10mg*10vials\t162\t286\t90\n'
      +'SK10\tSelank\t10mg*10vials\t0\t0\t90\n'
      +'CGL5\tCagrilintide\t5mg*10vials\t0\t93\t100\n'
      +'IP5\tIpamorelin\t5mg*10vials\t0\t0\t50\n'
      +'CU50\tGHK-CU\t50mg*10vials\t0\t0\t36\n'
      +'G25\tGHRP-2 Acetate\t5mg*10vials\t489\t5\t50\n'
      +'TSM10\tTesamorelin\t10mg*10vials\t0\t0\t180\n'
      +'G10K\tHCG\t10000IU*10vials\t0\t0\t138\n'
      +'G5K\tHCG\t5000IU*10vials\t176\t0\t77\n'
      +'TC250\tTestosterone cypionate\t10ml*1vials\t0\t0\t17\n'
      +'KLOW\tBPC 157 10mg+GHK-CU\t80mg*10vials\t50\t0\t249\n'
      +'5AM\t5-amino-1\t5mg*10vials\t0\t0\t57\n'
      +'TA5\tthymosin Alpha-1 5mg\t5mg*10vials\t0\t100\t130\n'
      +'SMO10\tsermorlin Acetate 10mg\t10mg*10vials\t100\t0\t180\n'
      +'TY10\tthymalin 10mg\t10mg*10vials\t194\t241\t75\n'
      +'KCU60\tKPV10mg+ GHKCU50mg\t60mg*10vials\t0\t0\t75\n'
      +'KS5\tKisspeptin\t5mg*10vials\t298\t151\t52\n'
      +'CP10\tCJC-1295 No DAC +IPA\t10mg*10vials\t0\t0\t125\n'
      +'TE250\tTE\t10ml*1vials\t0\t0\t17\n'
      +'EQ250\tBoldenone Undecylenate\t10ml*1vials\t0\t0\t22'
    );
  });
}

// Global page navigation controls: TOP / UP / DOWN
// Always visible on all pages. Fixed bottom-right. Runs before init() so a
// partial init failure (e.g. legacy vendor-pricing DOM removed) cannot hide it.
(function installScrollNav(){
  if(document.getElementById('pt-scroll-nav'))return;
  const nav=document.createElement('div');
  nav.id='pt-scroll-nav';
  nav.setAttribute('aria-label','Page navigation');
  function mkBtn(id,label,title){
    const b=document.createElement('button');
    b.id=id;b.type='button';b.title=title;b.setAttribute('aria-label',title);
    b.textContent=label;return b;
  }
  const btnTop=mkBtn('pt-snav-top','⇑','Go to top');
  const btnUp =mkBtn('pt-snav-up', '↑','Scroll up ~90%');
  const btnDn =mkBtn('pt-snav-dn', '↓','Scroll down ~90%');
  nav.appendChild(btnTop);nav.appendChild(btnUp);nav.appendChild(btnDn);
  document.body.appendChild(nav);
  btnTop.addEventListener('click',function(){
    try{window.scrollTo({top:0,behavior:'smooth'});}catch(_){window.scrollTo(0,0);}
  });
  btnUp.addEventListener('click',function(){
    var d=-(window.innerHeight*0.9);
    try{window.scrollBy({top:d,behavior:'smooth'});}catch(_){window.scrollBy(0,d);}
  });
  btnDn.addEventListener('click',function(){
    var d=window.innerHeight*0.9;
    try{window.scrollBy({top:d,behavior:'smooth'});}catch(_){window.scrollBy(0,d);}
  });
})();
init();


// ===== extracted core runtime script =====
(function(){
  function ready(fn){ if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn); else fn(); }
  function esc(s){ return String(s||'').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  const APP_SITES = [
    {key:'F1', value:'front-1', side:'front', num:'1/4', label:'Front left shoulder', route:'SQ+IM', x:21.240200, y:19.180819, w:4.632929, h:6.493506},
    {key:'F2', value:'front-2', side:'front', num:'3/6', label:'Front right shoulder', route:'SQ+IM', x:37.205987, y:18.981019, w:4.561654, h:6.393606},
    {key:'F3', value:'front-3', side:'front', num:'17/18', label:'Front abdomen upper left', route:'SQ', x:24.620100, y:33.375, w:4.076978, h:5.974026},
    {key:'F4', value:'front-4', side:'front', num:'19/20', label:'Front abdomen upper right', route:'SQ', x:33.375, y:33.375, w:4.187455, h:5.994006},
    {key:'F5', value:'front-5', side:'front', num:'21/20.5 → lower left', label:'Front abdomen lower left', route:'SQ', x:24.548824, y:41.381119, w:4.076978, h:5.844156},
    {key:'F6', value:'front-6', side:'front', num:'24/24.5 → lower right', label:'Front abdomen lower right', route:'SQ', x:33.375, y:41.883117, w:4.098361, h:5.744256},
    {key:'F16', value:'front-16', side:'front', num:'29/31', label:'Front left thigh', route:'SQ+IM', x:23.592302, y:55.844156, w:4.775481, h:6.593407},
    {key:'F17', value:'front-17', side:'front', num:'40/42', label:'Front right thigh', route:'SQ+IM', x:36.065574, y:55.844156, w:4.846757, h:6.693307},
    {key:'B3', value:'back-3', side:'back', num:'1/4', label:'Back left shoulder', route:'SQ+IM', x:56.521739, y:20.079920, w:4.918033, h:6.893107},
    {key:'B4', value:'back-4', side:'back', num:'3/6', label:'Back right shoulder', route:'SQ+IM', x:72.416251, y:19.980020, w:4.918033, h:6.893107},
    {key:'B7', value:'back-7', side:'back', num:'7L', label:'Back left triceps', route:'SQ', x:55.167498, y:27.072927, w:3.635068, h:5.094905},
    {key:'B8', value:'back-8', side:'back', num:'7R', label:'Back right triceps', route:'SQ', x:74.554526, y:27.172827, w:3.635068, h:4.995005},
    {key:'B10', value:'back-10', side:'back', num:'10', label:'Back left lower back', route:'SQ', x:59.158945, y:38.561439, w:3.278689, h:4.695305},
    {key:'B12', value:'back-12', side:'back', num:'12', label:'Back right lower back', route:'SQ', x:69.636493, y:38.161838, w:3.278689, h:4.595405},
    {key:'B13', value:'back-13', side:'back', num:'13', label:'Back left glute', route:'IM', x:60.228083, y:44.255744, w:3.635068, h:5.194805},
    {key:'B18', value:'back-18', side:'back', num:'18', label:'Back right glute', route:'IM', x:69.493942, y:44.255744, w:3.635068, h:5.194805},
    // Front-face — small square over the lower nose / just above the mouth (mapped-hotspot uses translate(-50%,-50%)).
    {key:'IN', value:'intranasal', side:'front', num:'IN', label:'Intranasal (nose)', route:'IN', x:29.15, y:10.75, w:2.05, h:2.05}
  ];

  function installSiteModel(){
    try{
      if(typeof SITE_REGIONS === 'object' && SITE_REGIONS){
        Object.keys(SITE_REGIONS).forEach(function(k){ delete SITE_REGIONS[k]; });
      }
      if(typeof SITE_CELLS !== 'undefined' && Array.isArray(SITE_CELLS)){
        SITE_CELLS.length = 0;
      }

      APP_SITES.forEach(function(s){
        const sideChar = s.side === 'front' ? 'f' : 'b';
        const regionKey = s.value.replace('-', '_');

        if(typeof SITE_REGIONS === 'object' && SITE_REGIONS){
          SITE_REGIONS[regionKey] = {
            side: sideChar,
            label: '#' + s.num + ' ' + s.label,
            short: s.label,
            type: s.route,
            cells: [s.num],
            px: s.x, py: s.y, pw: s.w, ph: s.h,
            legacyZone: s.value
          };
        }
        if(typeof SITE_CELLS !== 'undefined' && Array.isArray(SITE_CELLS)){
          SITE_CELLS.push({
            id: sideChar + '-' + s.num,
            cellId: s.value,
            regionKey: regionKey,
            number: s.num,
            region: {
              key: regionKey,
              side: sideChar,
              label: '#' + s.num + ' ' + s.label,
              short: s.label,
              type: s.route,
              cells: [s.num],
              px: s.x, py: s.y, pw: s.w, ph: s.h,
              legacyZone: s.value
            }
          });
        }
      });

      if(typeof LEGACY_SITE_MAP === 'object' && LEGACY_SITE_MAP){
        Object.keys(LEGACY_SITE_MAP).forEach(function(k){ delete LEGACY_SITE_MAP[k]; });
        Object.assign(LEGACY_SITE_MAP, {
          'SQ Abdomen UL':'front-3',  'SQ Abdomen UR':'front-4',
          'SQ Abdomen ML':'front-5',  'SQ Abdomen MR':'front-6',
          'SQ Abdomen LL':'front-7',  'SQ Abdomen LR':'front-8',
          'SQ Abdomen':'front-5','SQ Abdomen L':'front-5','SQ Abdomen R':'front-6',
          'SQ Flank L':'front-9','SQ Flank R':'front-10',
          'SQ Thigh L':'front-13','SQ Thigh R':'front-14','SQ Thigh':'front-13',
          'SQ Triceps L':'back-17','SQ Triceps R':'back-18',
          'IM Deltoid L':'front-1','IM Deltoid R':'front-2','IM Deltoid':'front-1',
          'IM Glute L':'back-21','IM Glute R':'back-22','IM Glute':'back-21',
          'Intranasal':'intranasal','IN':'intranasal','Nose':'intranasal','Nasal':'intranasal'
        });
      }
      try{ if(typeof SITE_COLORS==='object'&&SITE_COLORS) SITE_COLORS.intranasal='#38BDF8'; }catch(_){}
    }catch(err){
      console.warn('Site-model install warning:', err);
    }
  }

  function selectedValue(){
    var el = document.getElementById('lg-site');
    return el ? el.value : '';
  }

  function setSelectedValue(v){
    var el = document.getElementById('lg-site');
    if(!el) return;
    if(v) el.dataset.resolvedSite = v;
    else delete el.dataset.resolvedSite;
    var exists = Array.from(el.options).some(function(o){ return o.value === v; });
    el.value = exists ? v : 'Other';
    el.dispatchEvent(new Event('change', {bubbles:true}));
  }

  function labelForValue(v){
    if(!v) return 'Choose a site';
    if(v === 'intranasal') return 'IN — Intranasal (nose)';
    var site = APP_SITES.find(function(s){ return s.value === v; });
    return site ? ('#' + site.num + ' ' + site.label) : (v || 'Choose a site');
  }

  function renderMap(){
    installSiteModel();

    var wrap = document.getElementById('rotation-svg-wrap');
    var summary = document.getElementById('rotation-summary');
    var countEl = document.getElementById('rotation-shot-count');
    if(!wrap) return;

    var selected = selectedValue();

    var html = '<div class="mapped-infographic-shell">'
      + '<div class="mapped-infographic-wrap">'
      + '<img src="' + SITE_PHOTO_DATA_URL + '" alt="Injection site infographic map">';

    APP_SITES.forEach(function(s){
      html += '<button type="button" class="mapped-hotspot'
        + (s.value === 'intranasal' ? ' mapped-hotspot-nasal' : '') + '"'
        + ' aria-label="' + esc('#' + s.num + ' ' + s.label) + '"'
        + ' title="' + esc('#' + s.num + ' ' + s.label) + '"'
        + ' data-site="' + esc(s.value) + '"'
        + ' data-selected="' + (selected === s.value ? 'true' : 'false') + '"'
        + ' style="left:' + s.x + '%;top:' + s.y + '%;width:' + s.w + '%;height:' + s.h + '%;"></button>';
    });

    html += '</div>'
      + '<div class="mapped-helper">'
      + '<div>Click any visible number on the map to set the Injection site dropdown.</div>'
      + '</div>'
      + '</div>';

    wrap.innerHTML = html;

    wrap.querySelectorAll('.mapped-hotspot').forEach(function(btn){
      btn.addEventListener('click', function(){
        setSelectedValue(btn.dataset.site);
      });
    });

    var total = (window.S && Array.isArray(S.shots)) ? S.shots.length : 0;
    if(summary){
      summary.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between">'
        + '<div><strong>Selected:</strong> ' + esc(labelForValue(selected)) + '</div>'
        + '<div style="color:var(--color-text-tertiary)">Mapped directly to the visible numbered infographic</div>'
        + '</div>';
    }
    if(countEl){
      countEl.textContent = total ? ('Tracking ' + total + ' shot' + (total !== 1 ? 's' : '')) : 'No shots logged yet';
    }
  }

  window.renderRotation = renderMap;

  ready(function(){
    installSiteModel();
    var siteSelect = document.getElementById('lg-site');
    if(siteSelect){
      siteSelect.addEventListener('change', function(){
        setTimeout(renderMap, 0);
      });
    }
    setTimeout(renderMap, 0);
  });
})();
