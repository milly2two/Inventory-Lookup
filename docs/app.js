const STORE_KEY = 'myapt_inventory_searcher_v2';
const ENDPOINT_KEY = 'myapt_inventory_endpoint_v1';
// Do not remove/rename these keys. Flags live in browser localStorage and must survive deploys.
const FLAGS_KEY = 'myapt_inventory_flags_v1';
const FLAGS_BACKUP_KEY = 'chicago_apartment_co_inventory_flags_v1';
const FLAGS_KEYS = [FLAGS_KEY, FLAGS_BACKUP_KEY];
const FLAGS_SYNC_ENDPOINT = 'https://ncsniper.app.n8n.cloud/webhook/chiaptco-inventory-flags';
const INVENTORY_CACHE_MS = 30 * 60 * 1000;
const INVENTORY_SCHEMA_VERSION = 'building-details-v2';
const DEFAULT_ENDPOINT = 'https://raw.githubusercontent.com/milly2two/Inventory-Lookup/main/docs/inventory-live.json';
const LEGACY_INVENTORY_ENDPOINTS = ['https://ncsniper.app.n8n.cloud/webhook/myapt-inventory-live'];
const WD_FILTERS = [
  ['In Unit', 'In-unit W/D- all units'],
  ['Some', 'Some'],
  ['On Site', 'On-site laundry'],
];

let state = loadState();
let filtered = [];
let ui = { tab: 'search' };

function $(id){ return document.getElementById(id); }
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function money(n){ const x = Number(String(n ?? '').replace(/[^0-9.]/g,'')); return x ? `$${Math.round(x).toLocaleString()}` : 'Price TBD'; }
function num(n){ const x = Number(String(n ?? '').replace(/[^0-9.]/g,'')); return Number.isFinite(x) ? x : 0; }
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200); }
function hasRentSpecial(u){
  const net = num(u.net_rent || u.price);
  const market = num(u.market_rent);
  return !!net && !!market && net !== market;
}
function rentLabel(u){
  return `${esc(money(u.price))}${hasRentSpecial(u) ? '<span class="rent-asterisk" aria-label="Net rent differs from market rent">*</span>' : ''}`;
}

function normalizeUnit(raw, idx=0){
  const pick = (...keys) => keys.map(k => raw?.[k]).find(v => v !== undefined && v !== null && String(v).trim() !== '');
  const building = pick('building_name','property_name','property','building','name','Building Name','Property Name') || '';
  const unit = pick('unit_number','unit','unit_name','Unit','Unit Number','name') || '';
  const neighborhood = pick('neighborhood','Neighborhood','area','Area') || '';
  const special = pick('special','Special') || '';
  const specialAge = pick('special_age','Special Age','specialAge') || '';
  return {
    id: String(pick('id','unit_id','ygl_unit_id','Unit ID') || `${building}-${unit}-${idx}`),
    building_key: pick('building_key','Building Key') || '',
    building_name: building || 'Unknown property',
    neighborhood,
    unit_number: unit,
    beds: pick('beds','bed','bedrooms','Bed','Beds','Bedrooms') ?? '',
    baths: pick('baths','bath','bathrooms','Bath','Baths','Bathrooms') ?? '',
    sqft: pick('sq_ft','sqft','square_feet','Sqft','SQFT','Square Feet') ?? '',
    price: pick('net_rent','price','effective_rent','rent_price','rent','market_rent','Net Rent','Price','Effective Rent','Rent Price','Rent','Market Rent') ?? '',
    market_rent: pick('market_rent','Market Rent') ?? '',
    net_rent: pick('net_rent','Net Rent') ?? '',
    special,
    special_age: specialAge,
    available_date: pick('available_date','availability_date','move_date','available','Available Date','Move Date','Available') ?? '',
    last_available_date: pick('last_available_date','Last Available Date') ?? '',
    hold_days: pick('hold_days','HoldDays','Hold Days') ?? '',
    hold_notes: pick('hold_notes','HoldUnitNotes','Hold Unit Notes') ?? '',
    ygl_update_date: pick('ygl_update_date','YGL Update Date','Last Web Sync') ?? '',
    building_address: pick('building_address','Address') ?? '',
    building_units: pick('building_units','Units') ?? '',
    floors: pick('floors','Floors') ?? '',
    working_with_brokers: pick('working_with_brokers','WorkingWithBrokers') ?? '',
    website_url: pick('website_url','WebsitePricePage','Website URL') ?? '',
    phone: pick('phone','Phone1','Phone') ?? '',
    email: pick('email','Email1','Email') ?? '',
    email2: pick('email2','Email2') ?? '',
    online_scheduling: pick('online_scheduling','OnlineScheduling') ?? '',
    online_scheduling_notes: pick('online_scheduling_notes','OnlineSchedulingNotes','Online Scheduling Notes') ?? '',
    yieldstar_pricing: pick('yieldstar_pricing','Yieldstar') ?? '',
    parking_for_tours: pick('parking_for_tours','ParkingForTour') ?? '',
    admin_fee: pick('admin_fee','AdminFee') ?? '',
    app_fee: pick('app_fee','ApplicationFee','AppFee') ?? '',
    lowest_paid_lease_term: pick('lowest_paid_lease_term','LowestPaidLeaseTerm') ?? '',
    pool: pick('pool','Pool') ?? '',
    gym: pick('gym','Gym') ?? '',
    gym_notes: pick('gym_notes','GymNotes','AmenitiesNotes') ?? '',
    jacuzzi_sauna: pick('jacuzzi_sauna','JacuzziSauna','Hot Tub','Steam Room','Sauna') ?? '',
    outdoor_space: pick('outdoor_space','OutdoorSpace') ?? '',
    bike_storage: pick('bike_storage','BikeStorage') ?? '',
    doorman_status: pick('doorman_status','DoormanStatus','Security') ?? '',
    laundry_status: pick('laundry_status','Laundry') ?? '',
    laundry_notes: pick('laundry_notes','LaundryNotes') ?? '',
    central_air: pick('central_air','CentralAir') ?? '',
    utilities_included_in_rent: pick('utilities_included_in_rent','UtilitiesIncludedInRent') ?? '',
    utilities_included_in_package: pick('utilities_included_in_package','UtilitiesIncludedInPackage') ?? '',
    utility_notes_package_cost: pick('utility_notes_package_cost','UtilityNotesPackageCost') ?? '',
    internet_provider: pick('internet_provider','InternetProvider') ?? '',
    cable_provider: pick('cable_provider','CableProvider') ?? '',
    utilities_notes: pick('utilities_notes','UtilitiesNotes') ?? '',
    covered_parking: pick('covered_parking','CoveredParking') ?? '',
    covered_parking_notes: pick('covered_parking_notes','CoveredParkingNotes') ?? '',
    uncovered_parking: pick('uncovered_parking','UncoveredParking') ?? '',
    uncovered_parking_notes: pick('uncovered_parking_notes','UncoveredParkingNotes') ?? '',
    reserved_parking: pick('reserved_parking','ReservedParking') ?? '',
    reserved_parking_notes: pick('reserved_parking_notes','ReservedParkingNotes') ?? '',
    valet_parking: pick('valet_parking','ValetParking') ?? '',
    valet_parking_notes: pick('valet_parking_notes','ValetParkingNotes') ?? '',
    electric_charging: pick('electric_charging','ElectricCharging') ?? '',
    off_site_parking_options: pick('off_site_parking_options','OffSiteParkingOptions') ?? '',
    dog_run: pick('dog_run','DogRun') ?? '',
    pet_fee: pick('pet_fee','PetFee') ?? '',
    pet_fee_notes: pick('pet_fee_notes','PetFeeNotes') ?? '',
    pet_rent_notes: pick('pet_rent_notes','PetRentNotes') ?? '',
    wd: pick('wd','WD','W/D') ?? '',
    air_type: pick('air_type','Air Type') ?? '',
    floorplan_name: pick('floorplan_name','floorplan','Floorplan','Floor Plan') ?? '',
    address: pick('address','Address') ?? '',
    url: pick('url','website','link','URL','Website','Link') ?? '',
    raw,
  };
}
function loadState(){
  const stored = localStorage.getItem(STORE_KEY);
  if(stored){ try { return JSON.parse(stored); } catch(e){} }
  return { units: (window.MYAPT_INVENTORY_SEED || []).map(normalizeUnit), updated_at: null, source: 'sample', inventory_schema_version: INVENTORY_SCHEMA_VERSION };
}
function save(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function saveInventoryMeta(){
  const { units, ...meta } = state;
  localStorage.setItem(STORE_KEY, JSON.stringify({ ...meta, units: [] }));
}
function parseFlagStore(key){
  try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch(e){ return {}; }
}
function loadFlags(){
  const merged = FLAGS_KEYS.reduce((acc, key)=>({ ...acc, ...parseFlagStore(key) }), {});
  const legacy = parseFlagStore(FLAGS_KEY);
  const backup = parseFlagStore(FLAGS_BACKUP_KEY);
  if(Object.keys(legacy).length !== Object.keys(merged).length || Object.keys(backup).length !== Object.keys(merged).length) saveFlags(merged);
  return merged;
}
function saveFlags(flags){ FLAGS_KEYS.forEach(key=>localStorage.setItem(key, JSON.stringify(flags))); }
function flagKey(scope, id){ return `${scope}:${id}`; }
function buildingFlagId(u){ return buildingKey(u); }
function getFlag(scope, id){ return loadFlags()[flagKey(scope, id)]; }
function flagCount(){ return Object.keys(loadFlags()).length; }
function mergeFlags(a, b){ return { ...(a || {}), ...(b || {}) }; }
async function flagsApi(payload){
  const res = await fetch(FLAGS_SYNC_ENDPOINT, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload || { action:'list' }) });
  const json = await res.json();
  if(!json.ok) throw new Error(json.error || 'Flag sync failed');
  return json;
}
async function syncFlagsFromRemote(){
  try {
    const local = loadFlags();
    const remote = (await flagsApi({ action:'list' })).flags || {};
    const merged = mergeFlags(remote, local);
    saveFlags(merged);
    if(Object.keys(merged).length !== Object.keys(remote).length) await flagsApi({ action:'replaceAll', flags: merged });
    render();
  } catch(err) { console.warn('Flag sync failed', err); }
}
async function syncFlagUpsert(flag){ try { await flagsApi({ action:'upsert', flag }); } catch(err){ toast('Saved locally — flag sync failed'); } }
async function syncFlagDelete(scope, id){ try { await flagsApi({ action:'delete', scope, id }); } catch(err){ toast('Removed locally — flag sync failed'); } }
function dateValue(s){ const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; }
function formatDate(s){ const d = dateValue(s); return d ? d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : 'Move date TBD'; }
function bedLabel(v){ const n = Number(v); return n === 0 ? 'Studio' : n ? `${n} bed` : 'Beds TBD'; }
function bathLabel(v){ const n = Number(v); return n ? `${Number.isInteger(n) ? n : n.toFixed(1)} bath` : 'Baths TBD'; }
function badge(label, cls=''){ return `<span class="badge ${cls}">${esc(label)}</span>`; }
function lastUpdateLabel(value, slot){
  const d = dateValue(value);
  if(!d) return 'Last Update pending';
  const time = slot || d.toLocaleTimeString('en-US', { timeZone:'America/Chicago', hour:'numeric', minute:'2-digit' }).replace(':00 ', ' ');
  const date = d.toLocaleDateString('en-US', { timeZone:'America/Chicago', month:'short', day:'numeric' });
  return `Last Update (${time} on ${date})`;
}

function selectedChips(id){
  return [...document.querySelectorAll(`#${id} .multi-chip.active`)].map(btn=>btn.dataset.value);
}
function chipLabel(type, v){
  if(type==='beds') return Number(v) === 0 ? 'Studio' : `${v} bed`;
  if(type==='wd') return WD_FILTERS.find(([, value])=>value===v)?.[0] || v;
  return v;
}
function buildMultiChips(id, values, type){
  $(id).innerHTML = values.map(v=>`<button type="button" class="multi-chip" data-value="${esc(v)}">${esc(chipLabel(type, v))}</button>`).join('');
  document.querySelectorAll(`#${id} .multi-chip`).forEach(btn=>btn.onclick=()=>{ btn.classList.toggle('active'); applyFilters(); });
}
function populateFilters(){
  const units = state.units || [];
  const beds = [...new Set(units.map(u=>String(u.beds)).filter(v=>v!==''))].sort((a,b)=>Number(a)-Number(b));
  const baths = [...new Set(units.map(u=>String(u.baths)).filter(v=>v!==''))].sort((a,b)=>Number(a)-Number(b));
  const hood = [...new Set(units.map(u=>u.neighborhood).filter(Boolean))].sort();
  buildMultiChips('bedsFilter', beds, 'beds');
  $('bathsFilter').innerHTML = '<option value="any">Any baths</option>' + baths.map(v=>`<option value="${esc(v)}">${esc(v)} bath</option>`).join('');
  buildMultiChips('neighborhoodFilter', hood, 'neighborhood');
  buildMultiChips('wdFilter', WD_FILTERS.map(([, value])=>value), 'wd');
}

function applyFilters(){
  const q = $('searchInput').value.trim().toLowerCase();
  const beds = selectedChips('bedsFilter');
  const baths = $('bathsFilter').value;
  const hood = selectedChips('neighborhoodFilter');
  const wd = selectedChips('wdFilter');
  const min = num($('minPriceFilter').value);
  const max = num($('maxPriceFilter').value);
  const moveBy = $('moveDateFilter').value ? new Date($('moveDateFilter').value + 'T23:59:59') : null;
  filtered = (state.units || []).filter(u => {
    if(beds.length && !beds.includes(String(u.beds))) return false;
    if(baths !== 'any' && String(u.baths) !== baths) return false;
    if(hood.length && !hood.includes(u.neighborhood)) return false;
    if(wd.length && !wd.includes(u.wd)) return false;
    const price = num(u.price);
    if(min && (!price || price < min)) return false;
    if(max && (!price || price > max)) return false;
    if(moveBy){ const d = dateValue(u.available_date); if(!d || d > moveBy) return false; }
    if(q){ const hay = [u.building_name,u.unit_number,u.neighborhood,u.floorplan_name,u.address,u.building_key].join(' ').toLowerCase(); if(!hay.includes(q)) return false; }
    return true;
  });
  sortFiltered();
  render();
}
function sortFiltered(){
  const sort = $('sortSelect').value;
  filtered.sort((a,b)=>{
    if(sort==='dateAsc') return (dateValue(a.available_date)?.getTime() || Infinity) - (dateValue(b.available_date)?.getTime() || Infinity);
    if(sort==='bedsDesc') return Number(b.beds || -1) - Number(a.beds || -1);
    if(sort==='sqftDesc') return num(b.sqft) - num(a.sqft);
    return (num(a.price) || Infinity) - (num(b.price) || Infinity);
  });
}
function renderStats(){
  const prices = filtered.map(u=>num(u.price)).filter(Boolean);
  const soonest = filtered.map(u=>dateValue(u.available_date)).filter(Boolean).sort((a,b)=>a-b)[0];
  const hoods = new Set(filtered.map(u=>u.neighborhood).filter(Boolean)).size;
  $('statsGrid').innerHTML = [
    ['Matches', filtered.length],
    ['Avg price', prices.length ? money(prices.reduce((a,b)=>a+b,0)/prices.length) : '—'],
    ['Neighborhoods', hoods],
    ['Soonest', soonest ? soonest.toLocaleDateString(undefined,{month:'short',day:'numeric'}) : '—'],
  ].map(([l,v])=>`<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
}
function setTab(tab){
  ui.tab = tab;
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  $(`${tab}Panel`).classList.add('active');
  render();
}
function flagLabel(scope){ return scope === 'building' ? 'Building flag' : 'Unit flag'; }
function openFlag(scope, id){
  const flags = loadFlags();
  const existing = flags[flagKey(scope, id)];
  $('flagTargetType').value = scope;
  $('flagTargetId').value = id;
  $('flagScope').innerHTML = scope === 'unit' ? '<option value="building">Flag building</option><option value="unit">Flag unit</option>' : '<option value="building">Flag building</option>';
  $('flagScope').value = scope;
  $('flagReason').value = existing?.reason || '';
  $('removeFlagBtn').style.display = existing ? 'inline-flex' : 'none';
  const context = scope === 'unit' ? unitTitle(findUnit(id)) : buildingTitle(id);
  $('flagFormTitle').textContent = existing ? `Edit flag — ${context}` : `Flag ${context}`;
  openDrawer('flagDrawer');
}
function saveFlag(e){
  e.preventDefault();
  const scope = $('flagScope').value;
  const originalScope = $('flagTargetType').value;
  const originalId = $('flagTargetId').value;
  const unit = originalScope === 'unit' ? findUnit(originalId) : null;
  const id = scope === 'building' ? (unit ? buildingFlagId(unit) : originalId) : (unit ? unit.id : originalId);
  const reason = $('flagReason').value.trim();
  if(!reason){ toast('Add a Flag Reason first'); return; }
  const flags = loadFlags();
  delete flags[flagKey(originalScope, originalId)];
  const flag = { scope, id, reason, created_at: flags[flagKey(scope, id)]?.created_at || new Date().toISOString(), updated_at: new Date().toISOString() };
  flags[flagKey(scope, id)] = flag;
  saveFlags(flags);
  syncFlagUpsert(flag);
  closeDrawer('flagDrawer');
  toast(scope === 'building' ? 'Building flagged' : 'Unit flagged');
  render();
}
function removeCurrentFlag(){
  const scope = $('flagTargetType').value;
  const id = $('flagTargetId').value;
  const flags = loadFlags();
  delete flags[flagKey(scope, id)];
  saveFlags(flags);
  syncFlagDelete(scope, id);
  closeDrawer('flagDrawer');
  toast('Flag removed');
  render();
}
function findUnit(id){ return (state.units || []).find(u=>String(u.id)===String(id)); }
function unitTitle(u){ return u ? `${u.building_name}${u.unit_number ? ` #${u.unit_number}` : ''}` : 'unit'; }
function buildingTitle(id){ const u=(state.units||[]).find(x=>buildingKey(x)===id); return u?.building_name || id || 'building'; }
function isFlagged(scope, id){ return !!getFlag(scope, id); }
function flagButton(scope, id){
  const active = isFlagged(scope, id);
  return `<button type="button" class="small-btn flag-btn ${active?'active':''}" data-flag-${scope}="${esc(id)}">${active?'🚩 Flagged':'🚩 Flag'}</button>`;
}
function displayValue(v){
  return v !== undefined && v !== null && String(v).trim() !== '' ? String(v) : '—';
}
function detailRow(label, value){
  return `<div class="detail-row"><label>${esc(label)}</label><div>${esc(displayValue(value))}</div></div>`;
}
function detailSection(title, rows){
  const body = rows.length ? rows.join('') : '<div class="detail-empty">Mapping pending.</div>';
  return `<details class="detail-section"><summary>${esc(title)}</summary><div class="detail-section-body">${body}</div></details>`;
}
function wireFlagButtons(){
  document.querySelectorAll('[data-flag-unit]').forEach(btn=>btn.onclick=e=>{ e.stopPropagation(); openFlag('unit', btn.dataset.flagUnit); });
  document.querySelectorAll('[data-flag-building]').forEach(btn=>btn.onclick=e=>{ e.stopPropagation(); openFlag('building', btn.dataset.flagBuilding); });
}
function unitCard(u){
  const meta = [u.floorplan_name, u.sqft ? `${u.sqft} sqft` : '', u.unit_number ? `Unit ${u.unit_number}` : '', u.special ? `Special: ${u.special}` : '', u.special_age ? `Special age: ${u.special_age}` : ''].filter(Boolean).join(' · ');
  const flagged = isFlagged('unit', u.id) || isFlagged('building', buildingFlagId(u));
  return `<article class="card unit-card ${flagged?'flagged':''}" data-unit="${esc(u.id)}"><div><div class="card-title">${u.unit_number ? `Unit ${esc(u.unit_number)}` : esc(u.building_name)}</div><div class="card-sub">${esc(meta)}</div><div class="badges">${flagged?badge('Flagged','red'):''}${u.special?badge('Special','green'):''}${badge(bedLabel(u.beds),'blue')}${badge(bathLabel(u.baths),'gold')}${badge(formatDate(u.available_date),'green')}</div></div><div class="unit-actions"><div class="price-pill">${rentLabel(u)}</div>${flagButton('unit', u.id)}</div></article>`;
}
function buildingKey(u){ return u.building_key || u.building_name || 'Unknown property'; }
function minPrice(units){ const prices = units.map(u=>num(u.price)).filter(Boolean); return prices.length ? Math.min(...prices) : 0; }
function groupResultsHtml(){
  if(!filtered.length) return '<div class="empty">No units match those filters.</div>';
  const selectedHoods = selectedChips('neighborhoodFilter');
  const hoodOrder = new Map(selectedHoods.map((h,i)=>[h,i]));
  const hoodMap = new Map();
  filtered.forEach(u=>{
    const hood = u.neighborhood || 'No master neighborhood';
    if(!hoodMap.has(hood)) hoodMap.set(hood, []);
    hoodMap.get(hood).push(u);
  });
  const neighborhoods = [...hoodMap.entries()].sort(([a],[b])=>{
    const ai = hoodOrder.has(a) ? hoodOrder.get(a) : 9999;
    const bi = hoodOrder.has(b) ? hoodOrder.get(b) : 9999;
    if(ai !== bi) return ai - bi;
    if(a === 'No master neighborhood') return 1;
    if(b === 'No master neighborhood') return -1;
    return a.localeCompare(b);
  });
  let buildingIndex = 0;
  return neighborhoods.map(([hood, units])=>{
    const buildingMap = new Map();
    units.forEach(u=>{
      const key = buildingKey(u);
      if(!buildingMap.has(key)) buildingMap.set(key, []);
      buildingMap.get(key).push(u);
    });
    const buildings = [...buildingMap.entries()].sort(([,aUnits],[,bUnits])=>{
      const an = aUnits[0]?.building_name || '';
      const bn = bUnits[0]?.building_name || '';
      return an.localeCompare(bn);
    });
    const unitCount = units.length;
    return `<section class="neighborhood-group"><div class="neighborhood-head"><div><div class="eyebrow">Neighborhood</div><h3>${esc(hood)}</h3></div><span>${buildings.length} building${buildings.length===1?'':'s'} · ${unitCount} unit${unitCount===1?'':'s'}</span></div><div class="building-list">${buildings.map(([key, bUnits])=>{
      buildingIndex++;
      const first = bUnits[0] || {};
      const open = buildingIndex <= 8 ? ' open' : '';
      const beds = [...new Set(bUnits.map(u=>bedLabel(u.beds)))].join(' · ');
      return `<details class="building-group"${open}><summary><div><div class="card-title">${esc(first.building_name || key)}</div><div class="card-sub">${esc(beds)} · ${bUnits.length} available unit${bUnits.length===1?'':'s'}</div></div><div class="building-summary-actions"><div class="price-pill">From ${esc(money(minPrice(bUnits)))}</div>${flagButton('building', buildingFlagId(first))}</div></summary><div class="building-units">${bUnits.map(unitCard).join('')}</div></details>`;
    }).join('')}</div></section>`;
  }).join('');
}
function render(){
  $('flaggedTabCount').textContent = flagCount() ? `(${flagCount()})` : '';
  if(ui.tab === 'search'){
    if($('lastUpdateTag')) $('lastUpdateTag').textContent = lastUpdateLabel(state.updated_at, state.update_slot);
    renderStats();
    const buildingCount = new Set(filtered.map(buildingKey)).size;
    $('resultsTitle').textContent = `${filtered.length.toLocaleString()} unit${filtered.length===1?'':'s'} in ${buildingCount.toLocaleString()} building${buildingCount===1?'':'s'}`;
    const syncText = state.updated_at ? new Date(state.updated_at).toLocaleString() : 'recently';
    const warningText = state.warning ? ` ${state.warning}` : '';
    $('resultsSub').textContent = state.source === 'live' ? `Grouped by neighborhood, then building. Snapshot updated ${syncText}.${warningText}` : 'Sample data shown. Add the Apps Script endpoint in Settings to pull Inventory LIVE.';
    $('inventoryList').innerHTML = groupResultsHtml();
    document.querySelectorAll('[data-unit]').forEach(el=>el.onclick=()=>openUnit(el.dataset.unit));
    wireFlagButtons();
  }
  renderFlagged();
}
function renderFlagged(){
  const flags = loadFlags();
  const entries = Object.values(flags).sort((a,b)=>String(b.updated_at||b.created_at).localeCompare(String(a.updated_at||a.created_at)));
  if(!$('flaggedList')) return;
  $('flaggedList').innerHTML = entries.length ? entries.map(flagCard).join('') : '<div class="empty">No flagged inventory yet. Tap “Flag” on a building or unit to add one.</div>';
  document.querySelectorAll('#flaggedList [data-unit]').forEach(el=>el.onclick=()=>openUnit(el.dataset.unit));
  wireFlagButtons();
}
function flagCard(f){
  const unit = f.scope === 'unit' ? findUnit(f.id) : null;
  const buildingUnits = f.scope === 'building' ? (state.units || []).filter(u=>buildingKey(u)===f.id) : [];
  const sample = unit || buildingUnits[0] || {};
  const title = f.scope === 'building' ? (sample.building_name || f.id) : unitTitle(unit);
  const sub = f.scope === 'building' ? `${sample.neighborhood || 'Neighborhood TBD'} · ${buildingUnits.length} matching unit${buildingUnits.length===1?'':'s'}` : [sample.neighborhood, sample.unit_number ? `Unit ${sample.unit_number}` : '', sample.price ? money(sample.price) : ''].filter(Boolean).join(' · ');
  return `<article class="card flagged-card ${f.scope==='building'?'building-flag':''}" ${f.scope==='unit' ? `data-unit="${esc(f.id)}"` : ''}><div><div class="badges">${badge(flagLabel(f.scope),'red')}</div><div class="card-title">${esc(title)}</div><div class="card-sub">${esc(sub)}</div><div class="flag-reason"><b>Flag Reason:</b> ${esc(f.reason)}</div></div><div class="unit-actions">${flagButton(f.scope, f.id)}</div></article>`;
}
function openUnit(id){
  const u = (state.units || []).find(x=>x.id===id); if(!u) return;
  const unitRows = [
    detailRow('Market Rent', u.market_rent ? money(u.market_rent) : ''),
    detailRow('Net Rent', u.net_rent ? money(u.net_rent) : money(u.price)),
    detailRow('Special', u.special),
    detailRow('Special Age', u.special_age),
    detailRow('Available', u.available_date),
    detailRow('Hold Days', u.hold_days),
    detailRow('Hold Notes', u.hold_notes),
    detailRow('Laundry Status', u.laundry_status || u.wd),
    detailRow('Laundry Notes', u.laundry_notes),
    detailRow('Central Air', u.central_air || u.air_type),
    detailRow('Last Web Sync', u.ygl_update_date),
  ];
  const buildingRows = [
    detailRow('Address', u.building_address || u.address),
    detailRow('Units', u.building_units),
    detailRow('Floors', u.floors),
    detailRow('Working with Brokers?', u.working_with_brokers),
    detailRow('Website URL', u.website_url || u.url),
    detailRow('Phone', u.phone),
    detailRow('Email', u.email),
    detailRow('Email2', u.email2),
    detailRow('Online Scheduling?', u.online_scheduling),
    detailRow('Online Scheduling notes', u.online_scheduling_notes),
    detailRow('Yieldstar Pricing?', u.yieldstar_pricing),
    detailRow('Parking for tours', u.parking_for_tours),
    detailRow('Admin Fee', u.admin_fee),
    detailRow('App Fee', u.app_fee),
    detailRow('Lowest Paid Lease Term', u.lowest_paid_lease_term),
  ];
  const amenityRows = [
    detailRow('Pool', u.pool),
    detailRow('Gym', u.gym),
    detailRow('Gym Notes', u.gym_notes),
    detailRow('Jacuzzi/Sauna', u.jacuzzi_sauna),
    detailRow('Outdoor Space', u.outdoor_space),
    detailRow('Bike Storage', u.bike_storage),
    detailRow('Doorman Status', u.doorman_status),
  ];
  const utilityRows = [
    detailRow('Included in rent', u.utilities_included_in_rent),
    detailRow('Utility Pack', u.utilities_included_in_package),
    detailRow('Utility Notes', u.utility_notes_package_cost),
    detailRow('Internet Provider', u.internet_provider),
    detailRow('Cable Provider', u.cable_provider),
    detailRow('Utility Notes', u.utilities_notes),
  ];
  const parkingRows = [
    detailRow('Covered Parking', u.covered_parking),
    detailRow('Covered Parking Notes', u.covered_parking_notes),
    detailRow('Uncovered Parking', u.uncovered_parking),
    detailRow('Uncovered Parking Notes', u.uncovered_parking_notes),
    detailRow('Reserved Parking', u.reserved_parking),
    detailRow('Reserved Parking Notes', u.reserved_parking_notes),
    detailRow('Valet Parking', u.valet_parking),
    detailRow('Valet Parking Notes', u.valet_parking_notes),
    detailRow('Electric Charging', u.electric_charging),
    detailRow('Off Site Parking', u.off_site_parking_options),
  ];
  const petRows = [
    detailRow('Dog run', u.dog_run),
    detailRow('Pet Fee', u.pet_fee),
    detailRow('Pet Fee Notes', u.pet_fee_notes),
    detailRow('Pet Rent', u.pet_rent_notes),
  ];
  const sections = [
    detailSection('Unit Details', unitRows),
    detailSection('Building Details', buildingRows),
    detailSection('Amenities', amenityRows),
    detailSection('Utilities', utilityRows),
    detailSection('Parking', parkingRows),
    detailSection('Pets', petRows),
  ].join('');
  $('unitDetail').innerHTML = `<div class="eyebrow">${esc(u.neighborhood || 'Inventory')}</div><h2>${esc(u.building_name)}${u.unit_number ? ` · Unit ${esc(u.unit_number)}` : ''}</h2><div class="unit-meta"><span class="badge gold">${rentLabel(u)}</span>${u.special?badge('Special','green'):''}${badge(bedLabel(u.beds),'blue')}${badge(bathLabel(u.baths),'blue')}${badge(formatDate(u.available_date),'green')}</div><div class="actions">${flagButton('unit', u.id)}${flagButton('building', buildingFlagId(u))}</div><div class="detail-sections">${sections}</div>${u.url ? `<div class="actions"><a class="primary-btn" href="${esc(u.url)}" target="_blank" rel="noopener">Open listing</a></div>` : ''}`;
  openDrawer('unitDrawer');
  wireFlagButtons();
}
function shouldAutoSyncInventory(){
  if(state.source !== 'live' || !(state.units || []).length) return true;
  if(state.inventory_schema_version !== INVENTORY_SCHEMA_VERSION) return true;
  const last = state.updated_at ? new Date(state.updated_at).getTime() : 0;
  return !last || (Date.now() - last) > INVENTORY_CACHE_MS;
}
async function sync(){
  const storedEndpoint = (localStorage.getItem(ENDPOINT_KEY) || '').trim();
  const endpoint = storedEndpoint && storedEndpoint !== 'inventory-live.json' && !LEGACY_INVENTORY_ENDPOINTS.includes(storedEndpoint) ? storedEndpoint : DEFAULT_ENDPOINT;
  if(!endpoint){ openDrawer('settingsDrawer'); toast('Add the inventory endpoint first'); return; }
  const syncBtn = $('syncBtn');
  if(syncBtn){ syncBtn.disabled = true; syncBtn.textContent = 'Loading…'; }
  try{
    const requestEndpoint = endpoint === DEFAULT_ENDPOINT ? `${endpoint}?v=${Date.now()}` : endpoint;
    const res = await fetch(requestEndpoint, { cache:'no-store' });
    const json = await res.json();
    const rows = Array.isArray(json) ? json : (json.data?.units || json.units || json.inventory || []);
    if(!rows.length) throw new Error('No inventory rows returned');
    state = { units: rows.map(normalizeUnit), updated_at: json.updated_at || new Date().toISOString(), update_slot: json.update_slot || '', warning: json.warning || '', source: 'live', inventory_schema_version: INVENTORY_SCHEMA_VERSION };
    saveInventoryMeta(); populateFilters(); applyFilters(); toast(`Loaded ${state.units.length.toLocaleString()} units`);
  }catch(err){ toast('Sync failed: ' + err.message); }
  finally{ if(syncBtn){ syncBtn.disabled = false; syncBtn.textContent = 'Reload inventory'; } }
}
function clearFilters(){ ['searchInput','minPriceFilter','maxPriceFilter','moveDateFilter'].forEach(id=>$(id).value=''); $('bathsFilter').value='any'; document.querySelectorAll('.multi-chip.active').forEach(btn=>btn.classList.remove('active')); applyFilters(); }
function exportCsv(){
  const cols = ['building_name','unit_number','neighborhood','beds','baths','sqft','price','market_rent','special','special_age','available_date','last_available_date','wd','air_type','floorplan_name','address','url'];
  const csv = [cols.join(','), ...filtered.map(u=>cols.map(c=>`"${String(u[c] ?? '').replace(/"/g,'""')}"`).join(','))].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = `chicago-apartment-co-inventory-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
}
function exportFlagsCsv(){
  const flags = Object.values(loadFlags());
  const cols = ['scope','building_name','unit_number','neighborhood','price','flag_reason','updated_at'];
  const rows = flags.map(f=>{
    const unit = f.scope === 'unit' ? findUnit(f.id) : (state.units || []).find(u=>buildingKey(u)===f.id);
    return { scope:f.scope, building_name:unit?.building_name || f.id, unit_number:f.scope==='unit' ? (unit?.unit_number || '') : '', neighborhood:unit?.neighborhood || '', price:unit?.price || '', flag_reason:f.reason || '', updated_at:f.updated_at || f.created_at || '' };
  });
  const csv = [cols.join(','), ...rows.map(r=>cols.map(c=>`"${String(r[c] ?? '').replace(/"/g,'""')}"`).join(','))].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = `chicago-apartment-co-flagged-inventory-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
}
function openDrawer(id){ $(id).classList.add('open'); $(id).setAttribute('aria-hidden','false'); }
function closeDrawer(id){ $(id).classList.remove('open'); $(id).setAttribute('aria-hidden','true'); }
function bind(){
  document.querySelectorAll('[data-tab]').forEach(btn=>btn.onclick=()=>setTab(btn.dataset.tab));
  $('flagForm').addEventListener('submit', saveFlag);
  $('removeFlagBtn').onclick = removeCurrentFlag;
  ['searchInput','bathsFilter','minPriceFilter','maxPriceFilter','moveDateFilter','sortSelect'].forEach(id=>$(id).addEventListener('input', applyFilters));
  if($('syncBtn')) $('syncBtn').onclick = sync; $('clearFiltersBtn').onclick = clearFilters; $('exportCsvBtn').onclick = exportCsv; $('exportFlagsBtn').onclick = exportFlagsCsv;
  $('settingsBtn').onclick = ()=>{ $('endpointInput').value = localStorage.getItem(ENDPOINT_KEY) || DEFAULT_ENDPOINT; openDrawer('settingsDrawer'); };
  $('saveEndpointBtn').onclick = ()=>{ localStorage.setItem(ENDPOINT_KEY, $('endpointInput').value.trim()); closeDrawer('settingsDrawer'); toast('Endpoint saved'); };
  $('loadSampleBtn').onclick = ()=>{ state={units:(window.MYAPT_INVENTORY_SEED||[]).map(normalizeUnit),updated_at:null,warning:'',source:'sample',inventory_schema_version:INVENTORY_SCHEMA_VERSION}; save(); populateFilters(); applyFilters(); closeDrawer('settingsDrawer'); };
  document.querySelectorAll('[data-close]').forEach(btn=>btn.onclick=()=>closeDrawer(btn.dataset.close));
  document.querySelectorAll('.drawer').forEach(d=>d.addEventListener('click',e=>{ if(e.target===d) closeDrawer(d.id); }));
}
bind(); populateFilters(); applyFilters();
if (DEFAULT_ENDPOINT && shouldAutoSyncInventory()) sync();
syncFlagsFromRemote();
