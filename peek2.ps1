$u = "https://fypusrggckmekapyzusm.supabase.co/rest/v1/products?limit=1"
$k = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cHVzcmdnY2ttZWthcHl6dXNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODg1MzgsImV4cCI6MjA5ODU2NDUzOH0.HVo1azD6j-3OLj_lXIrmdL9TO33N7Ve8x4VOMewh9l0"
$wc = New-Object System.Net.WebClient
$wc.Headers.Add("apikey",$k)
$wc.Headers.Add("Authorization","Bearer $k")
$wc.Headers.Add("Accept","application/json")
$result = $wc.DownloadString($u)
Write-Output $result
