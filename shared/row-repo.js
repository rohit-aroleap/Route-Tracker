/* ─── RowRepo (v1.132) ──────────────────────────────────────────────
   Single seam for row-level Firebase writes + listeners.

   Before this module, every save in index.html and tech.html knew
   about a half-dozen internal concerns: metadata stamping
   (_lastModifiedBy / _lastModifiedAt), the _ignoreRowIds echo-
   suppression set, the trash + deletedIds bookkeeping on delete, the
   live listener wiring, and so on. The pattern was repeated at 5+
   call sites between the two files and the metadata stamping was
   subtly different in tech.html ("tech:Murthy") vs. admin
   ("rohit@aroleap.com").

   RowRepo absorbs the *data-plane* concerns:
     - .set() / .remove() against the Firebase ref
     - _lastModifiedBy / _lastModifiedAt stamping
     - Echo suppression: writes you make through the repo don't
       fire the repo's own listener callbacks back at you.
     - Trash + deletedIds bookkeeping on delete.

   It does NOT absorb *UX-plane* concerns:
     - The _dirtyRows local-pending set
     - scheduleSave debouncing
     - tech.html's _writingIds tap-lockout
     - sync-dot colour changes
     - toasts, renderStops, renderActivePage
   Those stay at the call site. The repo exposes hooks
   (onWriteStart / onWriteFinish / onError) so callers can wire the
   pending counter / sync dot without wrapping every save() in
   try/finally.

   Two adapters justify this seam:
     - Real Firebase (this implementation, used by both apps)
     - In-memory adapter (planned, for tests)

   Depends on: nothing. Operates on a passed-in Firebase ref.
*/
(function(g){
'use strict';

class RowRepo {
  /**
   * @param {Object} opts
   * @param {*}        opts.rootRef         Firebase ref at the app root (e.g. _fbRef pointing at blr_tracker/v2).
   * @param {Function} opts.getModifiedBy   () => string — what to stamp in _lastModifiedBy. Often the current user's email, but tech.html stamps "tech:<name>" to differentiate.
   * @param {Function} [opts.isReady]       () => boolean — gates writes. Default: always ready.
   * @param {Function} [opts.onWriteStart]  (id) => void — invoked before each set/remove call.
   * @param {Function} [opts.onWriteFinish] (id) => void — invoked after each set/remove call (success OR failure).
   * @param {Function} [opts.onError]       (err, op, id) => void — invoked on write failure.
   */
  constructor(opts){
    if(!opts || !opts.rootRef) throw new Error('RowRepo: rootRef is required');
    if(typeof opts.getModifiedBy !== 'function') throw new Error('RowRepo: getModifiedBy(() => string) is required');
    this._root          = opts.rootRef;
    this._getModifiedBy = opts.getModifiedBy;
    this._isReady       = opts.isReady       || (() => true);
    this._onWriteStart  = opts.onWriteStart  || NOOP;
    this._onWriteFinish = opts.onWriteFinish || NOOP;
    this._onError       = opts.onError       || ((err, op) => console.warn('RowRepo '+op+' error', err));
    // Echo suppression — writes made through this repo don't fire
    // the repo's own listener callbacks back at the same client.
    this._ignore = new Set();
  }

  /** Save (or upsert) a row. Returns the Promise from Firebase .set().
   *  Stamps _lastModifiedBy + _lastModifiedAt automatically.
   *  Marks the id as "ignore next echo" so subscribe() listeners skip it.
   */
  save(row){
    if(!this._isReady()) return Promise.reject(new Error('not ready'));
    this._ignore.add(row.id);
    const stamped = Object.assign({}, row, {
      _lastModifiedBy: this._getModifiedBy(),
      _lastModifiedAt: new Date().toISOString()
    });
    this._onWriteStart(row.id);
    return this._root.child('rows').child(String(row.id)).set(stamped)
      .then(() => { this._onWriteFinish(row.id); })
      .catch(err => { this._onWriteFinish(row.id); this._onError(err, 'save', row.id); throw err; });
  }

  /** Delete a row. Also marks meta/deletedIds (so historical seeding
   *  doesn't re-add it) and archives to /trash if rowData is given
   *  (for undo). Returns a Promise that resolves when the row removal
   *  completes — the auxiliary writes (deletedIds, trash) fire in
   *  parallel but errors there are reported via onError, not awaited.
   */
  remove(id, rowData){
    if(!this._isReady()) return Promise.reject(new Error('not ready'));
    this._ignore.add(id);
    const by = this._getModifiedBy();
    const at = new Date().toISOString();
    // Fire the meta/deletedIds write — independent, errors don't block.
    this._onWriteStart(id);
    this._root.child('meta/deletedIds').child(String(id)).set({ deleted: true, by, at })
      .then(() => this._onWriteFinish(id))
      .catch(err => { this._onWriteFinish(id); this._onError(err, 'mark-deleted', id); });
    // Archive to /trash if we have the row data (so undo works).
    if(rowData){
      const trashEntry = Object.assign({}, rowData, { _deletedBy: by, _deletedAt: at });
      this._onWriteStart(id);
      this._root.child('trash').child(String(id)).set(trashEntry)
        .then(() => this._onWriteFinish(id))
        .catch(err => { this._onWriteFinish(id); this._onError(err, 'trash', id); });
    }
    // Remove the actual row.
    this._onWriteStart(id);
    return this._root.child('rows').child(String(id)).remove()
      .then(() => this._onWriteFinish(id))
      .catch(err => { this._onWriteFinish(id); this._onError(err, 'remove', id); throw err; });
  }

  /** Subscribe to live row events. Echoes from this repo's own
   *  save/remove are suppressed automatically. Returns an
   *  unsubscribe function (off-er) that detaches all three listeners.
   */
  subscribe({ onAdded, onChanged, onRemoved }){
    const rowsRef = this._root.child('rows');
    const filter = (snap, cb) => {
      const r = snap.val(); if(!r || !r.id) return;
      if(this._ignore.has(r.id)){ this._ignore.delete(r.id); return; }
      cb(r);
    };
    const a = (snap) => onAdded   && filter(snap, onAdded);
    const c = (snap) => onChanged && filter(snap, onChanged);
    const d = (snap) => {
      // Removals also need echo suppression so a local delete doesn't
      // double-fire (once from .remove(), once from the listener).
      const r = snap.val(); if(!r || !r.id) return;
      if(this._ignore.has(r.id)){ this._ignore.delete(r.id); return; }
      if(onRemoved) onRemoved(r);
    };
    rowsRef.on('child_added',   a);
    rowsRef.on('child_changed', c);
    rowsRef.on('child_removed', d);
    return () => {
      rowsRef.off('child_added',   a);
      rowsRef.off('child_changed', c);
      rowsRef.off('child_removed', d);
    };
  }

  /** Convenience: read the rows subtree once (snapshot). Returns
   *  a Promise resolving to an array of row objects (or []). */
  loadAll(){
    return this._root.child('rows').once('value').then(snap => {
      const v = snap.val(); if(!v || typeof v !== 'object') return [];
      return Object.values(v).filter(r => r && r.id);
    });
  }
}

function NOOP(){}

g.RowRepo = RowRepo;

})(typeof window !== 'undefined' ? window : globalThis);
