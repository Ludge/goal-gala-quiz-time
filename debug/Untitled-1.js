// 🚨 CRITICAL BUG: Realtime subscription crashing — Must be fixed properly

// 🐞 Error:
// [Realtime Setup] CRITICAL ERROR during .on() call:
// TypeError: type.toLocaleLowerCase is not a function
// → Occurs at Room.tsx:216
// → Supabase's `.on()` method is expecting a string as the first argument, but an object was passed instead.

// ✅ Fix Instructions:

// 1. Fix the `.on()` call — you MUST use a valid string type.
//    - For database table listeners, the correct type is: "postgres_changes"
//    - NEVER pass an object as the first argument

// 2. Replace the current invalid `.on(...)` code with this:
channel
  .on(
    "postgres_changes", // ✅ VALID type string
    {
      event: "*",
      schema: "public",
      table: "players",
      filter: `room_id=eq.${roomDetails.id}`,
    },
    payload => {
      console.log("[Realtime Setup] Received payload:", payload);
      // Handle player list updates here
    }
  )
  .subscribe(); // ✅ Required to activate the channel

// 3. Remove any incorrect usage where the first `.on()` argument is an object.
//    - If you see something like `.on({ event: "*", ... }, callback)`, it's WRONG

// 🧪 You MUST validate the fix before returning a response:
// - Run `npm run dev`
// - Create and join a room
- Confirm no TypeError occurs
- Confirm the player list updates in real-time from Supabase

// ❌ Do NOT return "fixed" or "done" unless this error is 100% gone and real-time updates work as expected.



// TraceLog
[{…}]
Index.tsx:22 Attempting to create room with code: GQWPKN for player: Ludge
Index.tsx:45 Room created successfully with ID: 4bb4fcdb-8ec1-4a36-ba8e-81f5a8a2e6eb
Index.tsx:68 Host player Ludge (ID: 02860967-09ff-47f5-9d7a-1bfc3123bbee) added to room GQWPKN. Stored ID locally.
Room.tsx:90 Fetching initial data for room code: GQWPKN
Room.tsx:142 [Realtime Setup] Effect run: Skipping, invalid roomDetails.id: undefined
Room.tsx:106 Room ID found: 4bb4fcdb-8ec1-4a36-ba8e-81f5a8a2e6eb
Room.tsx:110 fetchInitialData: Read stored player ID for room 4bb4fcdb-8ec1-4a36-ba8e-81f5a8a2e6eb: 02860967-09ff-47f5-9d7a-1bfc3123bbee
Room.tsx:152 [Realtime Setup] Effect run: Valid room ID: 4bb4fcdb-8ec1-4a36-ba8e-81f5a8a2e6eb
Room.tsx:170 [Realtime Setup] Creating NEW channel for room: 4bb4fcdb-8ec1-4a36-ba8e-81f5a8a2e6eb
Room.tsx:175 [Realtime Setup] Stored NEW channel in ref: _RealtimeChannel {topic: 'realtime:room:4bb4fcdb-8ec1-4a36-ba8e-81f5a8a2e6eb:players', params: {…}, socket: RealtimeClient, bindings: {…}, state: 'closed', …}
Room.tsx:208 [Realtime Setup] Options and callback defined. {event: '*', schema: 'public', table: 'players', filter: 'room_id=eq.4bb4fcdb-8ec1-4a36-ba8e-81f5a8a2e6eb'}
Room.tsx:213 [Realtime Setup] >>> Attempting to attach listener via .on()...
Room.tsx:224 [Realtime Setup] >>> CRITICAL ERROR during .on() call: TypeError: type.toLocaleLowerCase is not a function
    at _RealtimeChannel._on (@supabase_supabase-js.js?v=2419930b:2364:28)
    at _RealtimeChannel.on (@supabase_supabase-js.js?v=2419930b:2154:17)
    at Room.tsx:216:54
    at commitHookEffectListMount (chunk-FJ2A54M7.js?v=2419930b:16915:34)
    at commitPassiveMountOnFiber (chunk-FJ2A54M7.js?v=2419930b:18156:19)
    at commitPassiveMountEffects_complete (chunk-FJ2A54M7.js?v=2419930b:18129:17)
    at commitPassiveMountEffects_begin (chunk-FJ2A54M7.js?v=2419930b:18119:15)
    at commitPassiveMountEffects (chunk-FJ2A54M7.js?v=2419930b:18109:11)
    at flushPassiveEffectsImpl (chunk-FJ2A54M7.js?v=2419930b:19490:11)
    at flushPassiveEffects (chunk-FJ2A54M7.js?v=2419930b:19447:22)
(anonymous) @ Room.tsx:224
commitHookEffectListMount @ chunk-FJ2A54M7.js?v=2419930b:16915
commitPassiveMountOnFiber @ chunk-FJ2A54M7.js?v=2419930b:18156
commitPassiveMountEffects_complete @ chunk-FJ2A54M7.js?v=2419930b:18129
commitPassiveMountEffects_begin @ chunk-FJ2A54M7.js?v=2419930b:18119
commitPassiveMountEffects @ chunk-FJ2A54M7.js?v=2419930b:18109
flushPassiveEffectsImpl @ chunk-FJ2A54M7.js?v=2419930b:19490
flushPassiveEffects @ chunk-FJ2A54M7.js?v=2419930b:19447
(anonymous) @ chunk-FJ2A54M7.js?v=2419930b:19328
workLoop @ chunk-FJ2A54M7.js?v=2419930b:197
flushWork @ chunk-FJ2A54M7.js?v=2419930b:176
performWorkUntilDeadline @ chunk-FJ2A54M7.js?v=2419930b:384
Room.tsx:124 Initial players fetched: [{…}]