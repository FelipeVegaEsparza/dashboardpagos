/**
 * Helper to convert upload URLs to use API endpoint
 * This fixes the nginx routing issue for uploads
 */

export function getImageUrl(url) {
    if (!url) return null;
    
    // If it's already an absolute URL (http/https), return as-is
    if (url.startsWith('http')) {
        return url;
    }
    
    // If it's an upload path, convert to API endpoint
    if (url.startsWith('/uploads/')) {
        // Remove /uploads/ prefix and use file.php endpoint
        const path = url.replace('/uploads/', '');
        return `/api/file.php?path=${encodeURIComponent(path)}`;
    }
    
    // Return as-is for other cases
    return url;
}

export default getImageUrl;
