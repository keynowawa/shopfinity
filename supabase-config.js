// Supabase configuration for ShopFresh
// Project: fypusrggckmekapyzusm

window.SUPABASE_CONFIG = {
  url: 'https://fypusrggckmekapyzusm.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cHVzcmdnY2ttZWthcHl6dXNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODg1MzgsImV4cCI6MjA5ODU2NDUzOH0.HVo1azD6j-3OLj_lXIrmdL9TO33N7Ve8x4VOMewh9l0'
};

// Connection test — runs once on page load
(async function testSupabaseConnection() {
  const { url, anonKey } = window.SUPABASE_CONFIG;
  try {
    const res = await fetch(`${url}/rest/v1/users?limit=1`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`
      }
    });
    if (res.ok) {
      console.log('%c✅ Supabase connected — fypusrggckmekapyzusm', 'color:#1D9E75;font-weight:bold');
    } else {
      console.warn(`%c⚠️ Supabase returned ${res.status}`, 'color:orange');
    }
  } catch (err) {
    console.error('%c<svg class="inline-icon" viewBox="0 0 24 24" ><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></g></svg> Supabase connection failed', 'color:red', err);
  }
})();
