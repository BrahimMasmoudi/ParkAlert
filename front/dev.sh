#!/bin/bash
# set -m puts background jobs in their own process group.
# This means Ctrl-C (SIGINT) does NOT reach the emulators — only nuxi dev gets it.
set -m

# Build Cloud Functions first
pnpm -C ../functions build

# Start emulators in their own process group (no --export-on-exit, we'll export manually)
pnpm firebase emulators:start \
  --import=../emulator-data \
  --only firestore,auth,functions,storage &
EMU_PID=$!

# Wait for Firestore to be ready before starting Nuxt
echo "⏳ Waiting for emulators to be ready..."
while ! nc -z localhost 8080 2>/dev/null; do
  sleep 0.5
done
echo "✅ Emulators ready!"

# Run migrations against emulators
echo "⏳ Running migrations..."
GCLOUD_PROJECT=park-alert-staging FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 pnpm -C ../functions migrate
echo "✅ Migrations applied."

# Run Nuxt in the foreground. Ctrl-C stops only this.
pnpm nuxi dev

# --- Nuxt has exited (via Ctrl-C or naturally) ---

# Export emulator data via the running hub
echo "⏳ Exporting emulator data..."
pnpm firebase emulators:export ../emulator-data --force 2>/dev/null && echo "✅ Data exported." || echo "⚠️  Export failed."

# Gracefully stop the emulators
echo "⏳ Stopping emulators..."
kill -2 $EMU_PID
wait $EMU_PID 2>/dev/null
echo "✅ Emulators shut down cleanly."
