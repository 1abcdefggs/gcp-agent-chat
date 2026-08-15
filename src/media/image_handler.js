const SUPPORTED_IMAGE_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif'
]);

class ImageHandler {
    /** Base64 image data sent from the client - validation and size restrictions */
    static processUploadedImage(dataUrl) {
        if (!dataUrl || typeof dataUrl !== 'string') {
            throw new Error('No image data specified.');
        }

        const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+_\-]+);base64,(.+)$/s);
        if (!match) {
            throw new Error('Invalid image data format. Please specify a valid Image Base64 DataURL.');
        }

        const mimeType = match[1].toLowerCase();
        if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
            throw new Error(`Unsupported image type: ${mimeType}. Supported formats: PNG, JPEG, WEBP, GIF, HEIC.`);
        }

        const base64Data = match[2].replace(/\s/g, '');

        // Capacity check (limit: 10MB)
        const sizeInBytes = (base64Data.length * 3) / 4;
        if (sizeInBytes > 10 * 1024 * 1024) {
            throw new Error('Image size is too large (limit: 10MB).');
        }

        return {
            mimeType,
            base64Data,
            previewUrl: dataUrl
        };
    }
}

module.exports = { ImageHandler };
