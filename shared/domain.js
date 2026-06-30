/* ─── Shared domain (v1.130) ────────────────────────────────────────
   Loaded by index.html (admin dashboard) and tech.html via:
     <script src="shared/domain.js"></script>
   placed BEFORE either file's own <script> block. Both files used to
   carry their own copies of these constants and helpers, and we hit
   drift twice — once when SHEET_MONTHS shifted, once when the
   route-id refactor went into index.html ahead of tech.html.

   This file MUST NOT depend on anything except the global object it
   attaches to. It runs first; nothing else exists yet.

   To extend: add the new constant or helper here and remove the
   duplicate from BOTH HTML files in the same commit. Bumping just
   one HTML file's version still triggers the update-banner, so the
   shared file gets re-fetched on the next page load alongside it.
*/
(function(g){
'use strict';

// ── Months we plan against. SHEET_MONTHS[0] is April 2026, the
// historical anchor; route-id encoding (monthIdx*100 + day) treats
// monthIdx=0 specially so April keys stay bare integers. Adding a
// new month means appending here AND ensuring back-compat encoding
// at any consumer that decodes by Math.floor(rid/100).
g.SHEET_MONTHS = [
  {m:3,  y:2026, label:'April',     short:'Apr', days:30},
  {m:4,  y:2026, label:'May',       short:'May', days:31},
  {m:5,  y:2026, label:'June',      short:'Jun', days:30},
  {m:6,  y:2026, label:'July',      short:'Jul', days:31},
  {m:7,  y:2026, label:'August',    short:'Aug', days:31},
  {m:8,  y:2026, label:'September', short:'Sep', days:30},
  {m:9,  y:2026, label:'October',   short:'Oct', days:31},
  {m:10, y:2026, label:'November',  short:'Nov', days:30},
  {m:11, y:2026, label:'December',  short:'Dec', days:31},
];

// ── The original Apr-11..Apr-17 launch week. Each "day" 1..7 maps
// to a calendar date + zone + colour. Historical only — newer
// entries store r.date as "DD Mon" instead of r.day.
g.DAY_PLAN = [
  {day:1,date:"11 Apr",dateLabel:"Saturday, 11 April",  zone:"North",     label:"North — Hebbal / Yelahanka",                   color:"#1e40af",bg:"#DBEAFE"},
  {day:2,date:"12 Apr",dateLabel:"Sunday, 12 April",    zone:"North-West",label:"North-West — Rajajinagar, Sadashivanagar",     color:"#5b21b6",bg:"#EDE9FE"},
  {day:3,date:"13 Apr",dateLabel:"Monday, 13 April",    zone:"East",      label:"East — Whitefield Corridor",                   color:"#065f46",bg:"#D1FAE5"},
  {day:4,date:"14 Apr",dateLabel:"Tuesday, 14 April",   zone:"Central",   label:"Central — Indiranagar, Bellandur",             color:"#92400e",bg:"#FEF3C7"},
  {day:5,date:"15 Apr",dateLabel:"Wednesday, 15 April", zone:"South",     label:"South — HSR, Sarjapur, Begur",                 color:"#9f1239",bg:"#FFE4E6"},
  {day:6,date:"16 Apr",dateLabel:"Thursday, 16 April",  zone:"South",     label:"South — Banashankari",                         color:"#9f1239",bg:"#FFE4E6"},
  {day:7,date:"17 Apr",dateLabel:"Friday, 17 April",    zone:"Outer",     label:"Outer — Attibele, Nelamangala, Chandapura",    color:"#374151",bg:"#F3F4F6"},
];

// ── Technicians (guides). Add a new guide here AND in tech.html's
// TECH_ROSTER (so the email-login flow knows who they are).
g.GUIDE_COLORS = {
  1:{color:'#1e40af',bg:'#DBEAFE',label:'Murthy', light:'#93c5fd'},
  2:{color:'#b45309',bg:'#FEF3C7',label:'Divakar',light:'#fcd34d'},
  3:{color:'#15803d',bg:'#DCFCE7',label:'Temp',   light:'#86efac'},
};

// ── Colour for each of the 16 Ferra subscription tags, grouped by
// funnel stage. Used in the Edit Data tab to show a tag pill under
// each phone number.
g.FERRA_TAG_COLOR = {
  'Order Pending':           {bg:'#FEF3C7', fg:'#92400E'},
  'Auto Pay Pending':        {bg:'#FEF3C7', fg:'#92400E'},
  'Approval Pending':        {bg:'#FEF9C3', fg:'#854D0E'},
  'Machine Assign Pending':  {bg:'#FEF9C3', fg:'#854D0E'},
  'Installation Pending':    {bg:'#DBEAFE', fg:'#1E40AF'},
  'Persona Call Pending':    {bg:'#E0E7FF', fg:'#3730A3'},
  'Exercises Call Pending':  {bg:'#E0E7FF', fg:'#3730A3'},
  'Hand Off Pending':        {bg:'#E0E7FF', fg:'#3730A3'},
  'SA Reach Out Pending':    {bg:'#FCE7F3', fg:'#9D174D'},
  'SA Follow Up':            {bg:'#FCE7F3', fg:'#9D174D'},
  'All Steps Complete':      {bg:'#D1FAE5', fg:'#065F46'},
  'All Done':                {bg:'#D1FAE5', fg:'#065F46'},
  'Uninstallation Pending':  {bg:'#FFE4E6', fg:'#9F1239'},
  'Pickup Pending':          {bg:'#FFE4E6', fg:'#9F1239'},
  'Received in Warehouse':   {bg:'#F3E8FF', fg:'#6B21A8'},
};

// ── Which SHEET_MONTHS slot a row belongs to.
// Legacy rows with r.day 1..7 are always April (DAY_PLAN).
// Newer rows have r.date as "12 May" / "1 Jun" / etc.
g.getEntryMonthIdx = function(r){
  if(r && r.day >= 1 && r.day <= 7) return 0;
  if(r && r.date){
    const ml = String(r.date).toLowerCase();
    for(let i = 0; i < g.SHEET_MONTHS.length; i++){
      const s = g.SHEET_MONTHS[i];
      if(ml.indexOf(s.short.toLowerCase()) !== -1 || ml.indexOf(s.label.toLowerCase()) !== -1) return i;
    }
  }
  return 0; // unknown → April for back-compat
};

// ── Day-of-month for a row. Prefer r.day (when in DAY_PLAN range)
// then parse the leading number from r.date. Returns null when
// neither is interpretable — caller handles that as "unassigned".
g.getEntryCalDate = function(r){
  if(r.day >= 1 && r.day <= 7){
    const dp = g.DAY_PLAN.find(d => d.day === r.day);
    if(dp) return parseInt(dp.date); // "11 Apr" → 11
  }
  if(r.date){ const m = r.date.match(/\d+/); if(m) return parseInt(m[0]); }
  return null;
};

// ── Composite key for sheetOrders / routeOrders. April uses the
// bare day number for backward-compat with existing data; other
// months use "M-D" where M is the JS-month (0-indexed +1).
g._sheetOrderKey = function(monthIdx, calDay){
  return monthIdx === 0 ? String(calDay) : (g.SHEET_MONTHS[monthIdx].m + 1) + '-' + calDay;
};
// Historical alias (tech.html used this name)
g._routeOrderKeyFor = g._sheetOrderKey;

// ── Phone normalisation. Strip non-digits → strip leading zeros →
// prefix '91' if exactly 10 digits remain (Indian numbers). MUST
// match the ferra-sync Cloudflare worker's normalisation or
// /ferraSubscriptions/v1 byPhone lookups will miss.
g.normalizePhone = function(p){
  let n = String(p == null ? '' : p).replace(/\D/g, '').replace(/^0+/, '');
  if(n.length === 10) n = '91' + n;
  return n;
};

})(typeof window !== 'undefined' ? window : globalThis);
