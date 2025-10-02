<?php
/**
 * Cache Clear Script for cPanel Hosting
 * Visit this URL to clear server cache: https://test.eskisiniveryenisinial.com/clear-cache.php
 */

// Security: Only allow from specific IPs or with secret key
$secret_key = 'eSkIsInI_CaChe_CLeaR_2025_SecReT'; // Strong secret key
$allowed_ips = ['88.228.207.166']; // Your IP from cPanel stats

// Check authorization
$ip = $_SERVER['REMOTE_ADDR'];
$key = $_GET['key'] ?? '';

if ($key !== $secret_key && !in_array($ip, $allowed_ips)) {
    http_response_code(403);
    die('Access denied');
}

// Clear PHP opcache if available
if (function_exists('opcache_reset')) {
    opcache_reset();
    echo "✅ OPcache cleared\n";
} else {
    echo "ℹ️ OPcache not available\n";
}

// Clear APCu cache if available
if (function_exists('apcu_clear_cache')) {
    apcu_clear_cache();
    echo "✅ APCu cache cleared\n";
} else {
    echo "ℹ️ APCu not available\n";
}

// Clear realpath cache
clearstatcache(true);
echo "✅ Stat cache cleared\n";

// Output headers to prevent caching this script
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

echo "\n✅ All available caches cleared!\n";
echo "🕒 Time: " . date('Y-m-d H:i:s') . "\n";
?>
