# CYBER//FIT

A cyberpunk self-improvement tracker — **off-grid by design**.

Track habits, water, workouts, reading, and mood with forgiving streaks and
light gamification (XP, levels, cosmetic augment unlocks). Built for brains
that need fast feedback and hate being punished for missing a day — designed
ADHD-first: 1–2-tap logging, flexible completion, streak shields instead of
streak loss.

Free forever. Open source (MIT). No accounts. No ads. No tracking. No bullshit.

## Off-grid by design

After the first load, the app works **100% offline forever**. It's an
installable PWA — add it to your home screen and it runs full-screen with zero
signal.

## DATA — exactly what leaves your device

**Nothing, unless you opt into push reminders.**

- All logs, habits, notes, and stats live in your browser's local database
  (IndexedDB) on your device. There is no server for them to go to.
- No analytics, no telemetry, no cookies, no accounts, no IP logging.
- Backup/restore is a local JSON export/import you control.

If you **opt in** to push reminders (optional — the app is fully functional
without them), exactly two things are stored on the reminder server:

1. Your browser's anonymous push subscription (a random URL issued by your
   browser vendor — contains no identity),
2. The reminder time slots you chose (plain numbers).

All traffic is TLS-encrypted; push payloads are additionally end-to-end
encrypted per the Web Push standard (RFC 8291) and contain only a generic
"time to check in". You can also self-host the reminder worker on your own
free Cloudflare account — see SELF-HOSTING.md (Phase 4).

## Development

```bash
npm install
npm run icons     # one-time: rasterize the app icons (needs Playwright Chromium)
npm run dev       # local dev server
npm test          # engine unit + property tests
npm run build     # type-check + production build to dist/
```

Hosting: Cloudflare Workers static assets — `npm run deploy` ships the app to
https://cyberfit.dev, `npm run deploy:relay` ships the optional push relay to
https://relay.cyberfit.dev. CI (GitHub Actions) runs tests + build on every
push. See SELF-HOSTING.md to run your own relay.

## Support

The app is free forever and the infrastructure costs ~$12/year (the domain).
If you want to chip in anyway: [Buy Me a Coffee](https://buymeacoffee.com/mrbell.dev)
— it keeps the notification relay lit.

## License

MIT — see [LICENSE](LICENSE).
