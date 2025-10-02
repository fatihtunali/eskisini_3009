<?php
/**
 * Cache Busting Helper for muvhost.com
 * Returns current timestamp or file modification time for cache busting
 */

// Use deployment timestamp (update this when deploying)
define('DEPLOY_VERSION', '20251001_1430'); // Format: YYYYMMDD_HHMM

/**
 * Get version string for cache busting
 * @return string Version identifier
 */
function getVersion() {
    return DEPLOY_VERSION;
}

/**
 * Get versioned URL for a resource
 * @param string $path Path to resource (e.g., '/js/header.js')
 * @return string Versioned URL
 */
function versionedUrl($path) {
    return $path . '?v=' . getVersion();
}

// If called directly, output version
if (basename(__FILE__) == basename($_SERVER['PHP_SCRIPT_FILENAME'])) {
    header('Content-Type: text/plain');
    echo getVersion();
}
?>
