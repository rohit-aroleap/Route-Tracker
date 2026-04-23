# Backups

Daily JSON snapshots of the Firebase Realtime Database, committed by `.github/workflows/backup.yml` at 00:30 IST.

Each file is a full dump of `/` — restore by reading the `blr_tracker/v2/rows` and `blr_tracker/v2/meta` subtrees and writing them back via the Firebase console or a small script.

Manual run: Actions tab → "Daily Firebase backup" → Run workflow.
