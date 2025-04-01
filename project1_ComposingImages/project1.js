function composite(bgImg, fgImg, fgOpac, fgPos) {
    // Dimensions for background and foreground images.
    const bgW = bgImg.width, bgH = bgImg.height;
    const fgW = fgImg.width, fgH = fgImg.height;

    // Calculate the overlapping region in background coordinates.
    // The top-left pixel of the foreground is at (fgPos.x, fgPos.y) on the background.
    const startX = Math.max(0, fgPos.x);
    const startY = Math.max(0, fgPos.y);
    const endX = Math.min(bgW, fgPos.x + fgW);
    const endY = Math.min(bgH, fgPos.y + fgH);

    // If there is no overlap, exit without modifying the background.
    if (startX >= endX || startY >= endY) return;

    // Loop over each pixel in the overlapping region.
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            // Calculate corresponding foreground pixel coordinates.
            const fgX = x - fgPos.x;
            const fgY = y - fgPos.y;
            
            // Calculate the index into the flat RGBA arrays.
            const bgIdx = (y * bgW + x) * 4;
            const fgIdx = (fgY * fgW + fgX) * 4;
            
            // Scale the foreground alpha using the given fgOpac.
            // Convert the 0-255 alpha value to a 0-1 scale.
            const origAlphaF = fgImg.data[fgIdx + 3] / 255;
            const alphaF = origAlphaF * fgOpac;

            // If the foreground pixel is completely transparent, skip blending.
            if (alphaF === 0) continue;
            
            // Get the background pixel alpha (0-1).
            const alphaB = bgImg.data[bgIdx + 3] / 255;
            
            // Compute the resulting alpha using standard alpha compositing:
            // α_result = α_foreground + (1 - α_foreground) * α_background
            const compAlpha = alphaF + (1 - alphaF) * alphaB;
            
            // Blend each color channel (R, G, B) using the alpha blending formula:
            // C_result = (α_fg * C_fg + (1 - α_fg) * α_bg * C_bg) / α_result
            for (let c = 0; c < 3; c++) {
                const colorF = fgImg.data[fgIdx + c];
                const colorB = bgImg.data[bgIdx + c];
                const blended = (alphaF * colorF + (1 - alphaF) * alphaB * colorB) / compAlpha;
                bgImg.data[bgIdx + c] = blended;
            }
            
            // Set the new alpha value in the background pixel.
            bgImg.data[bgIdx + 3] = compAlpha * 255;
        }
    }
}
