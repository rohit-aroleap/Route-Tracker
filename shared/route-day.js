/* ─── RouteDay (v1.131) ─────────────────────────────────────────────
   A route-id (rid) is the compact integer monthIdx*100 + day.
   April rids equal the bare day, so localStorage / routeOrders
   from before the multi-month refactor remain valid.

   Callers used to do this trio at 6+ call sites in the Route
   Planner:
       const {monthIdx, day} = _ridDecode(rid);
       const dp = dayInfo(day, monthIdx);
       // ...use dp.date, dp.color, dp.bg, _routeOrderKey(rid), etc.
   That trio is now one call: RouteDay.fromRid(rid).
   Lookup of DAY_PLAN colour / zone-label happens inside; callers
   don't decide whether a rid lands in DAY_PLAN.

   Depends on: SHEET_MONTHS, DAY_PLAN  (from shared/domain.js).
   No DOM, no Firebase, no globals beyond the ones it attaches. */
(function(g){
'use strict';

const { SHEET_MONTHS, DAY_PLAN } = g;

// Fallback colours when the calendar date isn't one of the
// April DAY_PLAN dates (matches the historical dayInfo fallback).
const FALLBACK_COLOR = '#065f46';
const FALLBACK_BG    = '#D1FAE5';

class RouteDay {
  constructor(monthIdx, day){
    this.monthIdx = monthIdx;
    this.day      = day;
    this.rid      = monthIdx*100 + day;
    // Look up the SHEET_MONTHS row this rid lands in.
    const sm = SHEET_MONTHS[monthIdx] || SHEET_MONTHS[0];
    this._sm  = sm;
    // For April days that match a DAY_PLAN entry we get the zone
    // label (e.g. "North — Hebbal/Yelahanka") and the colour scheme
    // wired into the original launch week. Other months get a
    // fallback green.
    const dp = (monthIdx === 0) ? DAY_PLAN.find(x => parseInt(x.date) === day) : null;
    this._dp = dp;
    this.date      = dp ? dp.date      : `${day} ${sm.short}`;     // "11 Apr"  /  "12 May"
    this.dateLabel = dp ? dp.dateLabel : this.date;                 // "Saturday, 11 April"  /  "12 May"
    this.zoneLabel = dp ? dp.label     : null;                      // "North — Hebbal/…"  /  null
    this.color     = dp ? dp.color     : FALLBACK_COLOR;
    this.bg        = dp ? dp.bg        : FALLBACK_BG;
  }

  // routeOrders / sheetOrders key. April → bare "12", others → "5-12".
  get orderKey(){
    return this.monthIdx === 0 ? String(this.day) : (this._sm.m + 1) + '-' + this.day;
  }

  // Date object at local midnight. Used for sorting + old/recent splits.
  get absoluteDate(){
    return new Date(this._sm.y, this._sm.m, this.day);
  }

  get isToday(){
    const now = new Date();
    return this._sm.m === now.getMonth()
        && this._sm.y === now.getFullYear()
        && this.day   === now.getDate();
  }

  // ─── Static constructors ────────────────────────────────────────
  static fromRid(rid){
    rid = parseInt(rid) || 0;
    return new RouteDay(Math.floor(rid/100), rid % 100);
  }

  static fromMonthAndDay(monthIdx, day){
    return new RouteDay(monthIdx|0, day|0);
  }

  static fromEntry(r){
    return new RouteDay(g.getEntryMonthIdx(r), g.getEntryCalDate(r) || 0);
  }

  static encode(monthIdx, day){ return (monthIdx|0)*100 + (day|0); }

  static decode(rid){
    rid = parseInt(rid) || 0;
    return { monthIdx: Math.floor(rid/100), day: rid % 100 };
  }

  static today(){
    const now = new Date();
    const idx = SHEET_MONTHS.findIndex(s => s.m === now.getMonth() && s.y === now.getFullYear());
    return new RouteDay(idx >= 0 ? idx : 0, now.getDate());
  }
}

g.RouteDay = RouteDay;

})(typeof window !== 'undefined' ? window : globalThis);
