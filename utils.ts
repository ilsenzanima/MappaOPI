
import { MapPoint, MapLine, PointType } from './types';
import { getPointIconSVGString } from './components/PointIcons';
import { jsPDF } from "jspdf";

/**
 * Helper to load an image from URL/String
 */
const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Errore caricamento immagine"));
        img.src = src;
    });
};

/**
 * Generates a high-quality PDF with vector overlays.
 */
export const generatePDF = async (
    imageSrc: string,
    points: MapPoint[],
    lines: MapLine[],
    markerScale: number,
    planName: string
) => {
    try {
        const img = await loadImage(imageSrc);
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        
        // Determine orientation
        const orientation = width > height ? 'l' : 'p';
        
        // Initialize PDF matching image dimensions (in points/pixels logic to keep 1:1 mapping simple)
        // We use 'px' unit to map coordinates easily 1:1 with the image size
        // passing [width, height] sets the page size exactly to the image size
        const doc = new jsPDF({
            orientation,
            unit: 'px',
            format: [width, height]
        });

        // 1. Add Background Image
        // We assume imageSrc is Base64 (Data URI). If it's a blob URL, this works too usually.
        // compression: 'FAST' or 'NONE' ensures high quality.
        doc.addImage(img, 'JPEG', 0, 0, width, height, undefined, 'FAST');

        // Calculate sizes relative to image width (similar to canvas logic)
        // Adjust multiplier to scale elements appropriately for PDF view
        const baseSize = (width / 45) * markerScale; 
        
        // INCREASED BADGE SIZE for PDF
        const badgeSize = baseSize * 0.6; 
        const fontSize = badgeSize * 0.6; 

        // 2. Draw Lines (Vectors)
        lines.forEach(line => {
            const sx = (line.startX / 100) * width;
            const sy = (line.startY / 100) * height;
            const ex = (line.endX / 100) * width;
            const ey = (line.endY / 100) * height;

            doc.setDrawColor(line.color);
            doc.setLineWidth(baseSize * 0.12);
            doc.line(sx, sy, ex, ey);
        });

        // 3. Draw Marker Leader Lines (Vectors)
        doc.setDrawColor('#dc2626'); // Red-600
        doc.setLineWidth(baseSize * 0.08);

        points.forEach(point => {
             const x = (point.x / 100) * width;
             const y = (point.y / 100) * height;
             
             if (point.targetX !== undefined && point.targetY !== undefined) {
                 if (Math.abs(point.targetX - point.x) > 0.1 || Math.abs(point.targetY - point.y) > 0.1) {
                     const tx = (point.targetX / 100) * width;
                     const ty = (point.targetY / 100) * height;
                     
                     // Line
                     doc.line(tx, ty, x, y);
                     
                     // Target Dot (Filled Circle)
                     doc.setFillColor('#dc2626');
                     doc.circle(tx, ty, baseSize * 0.1, 'F');
                 }
             }
        });

        // 4. Draw Markers (Complex)
        // For icons, since they are complex SVGs, we will rasterize them to small PNGs
        // then embed them. For the badge (circle + number), we draw vectors.
        
        // Preload icons as PNG data URIs
        const uniqueTypes = Array.from(new Set(points.map(p => p.type))) as PointType[];
        const iconCache: Record<string, string> = {}; // type -> base64 png

        for (const t of uniqueTypes) {
             const svgStr = getPointIconSVGString(t, '#dc2626');
             const iconImg = await loadImage(svgStr);
             
             // Convert to PNG via temp canvas
             const c = document.createElement('canvas');
             c.width = 64; c.height = 64;
             const ctx = c.getContext('2d');
             if(ctx) {
                 ctx.drawImage(iconImg, 0, 0, 64, 64);
                 iconCache[t] = c.toDataURL('image/png');
             }
        }

        for (const point of points) {
            const x = (point.x / 100) * width;
            const y = (point.y / 100) * height;
            
            // White Background Circle
            doc.setFillColor('#ffffff');
            doc.setDrawColor('#dc2626');
            doc.setLineWidth(baseSize * 0.05);
            doc.circle(x, y, baseSize / 2, 'FD'); // Fill and Draw stroke

            // Icon Image
            const iconPng = iconCache[point.type];
            if (iconPng) {
                const iconW = baseSize * 0.6;
                const iconH = baseSize * 0.6;
                // addImage(data, fmt, x, y, w, h)
                // Center it
                doc.addImage(iconPng, 'PNG', x - iconW/2, y - iconH/2, iconW, iconH);
            }

            // Badge Circle (Offset slightly more to accommodate larger size)
            const badgeX = x + baseSize/2.4; 
            const badgeY = y - baseSize/2.4;
            
            doc.setFillColor('#dc2626');
            doc.setDrawColor('#ffffff');
            doc.setLineWidth(baseSize * 0.03);
            doc.circle(badgeX, badgeY, badgeSize / 2, 'FD');

            // Number Text
            doc.setTextColor('#ffffff');
            doc.setFontSize(fontSize * 1.5); // PDF font size logic is different, roughly scale up
            doc.setFont("helvetica", "bold");
            
            // Center text manually-ish
            const text = point.number.toString();
            const textWidth = doc.getTextWidth(text);
            // Adjust y for baseline
            doc.text(text, badgeX - textWidth / 2, badgeY + (fontSize * 0.5));
        }

        doc.save(`${planName || 'planimetria'}.pdf`);

    } catch (e) {
        console.error("PDF Generation Error", e);
        alert("Errore durante la creazione del PDF.");
    }
};

/**
 * Renders the map with all points, lines, and markers onto a canvas and returns a Blob (JPEG).
 * UPDATED: Uses 2x supersampling for better quality.
 */
export const renderMapToBlob = async (
    imageSrc: string, 
    points: MapPoint[], 
    lines: MapLine[] = [],
    markerScale: number = 1
): Promise<Blob | null> => {
    try {
        const img = await loadImage(imageSrc);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Impossibile creare contesto canvas");

        // SUPER SAMPLING: Render at 2x resolution
        const scaleFactor = 2;
        canvas.width = Math.ceil(img.naturalWidth * scaleFactor);
        canvas.height = Math.ceil(img.naturalHeight * scaleFactor);

        // Fill background with white
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Scale context for all subsequent draws
        ctx.scale(scaleFactor, scaleFactor);

        // Draw base plan
        ctx.drawImage(img, 0, 0);

        // Calc sizes (Logic uses original dimensions because we scaled the context)
        const logicalWidth = img.naturalWidth;
        const logicalHeight = img.naturalHeight;
        
        const basePixelSize = (logicalWidth / 45) * markerScale; 
        
        // INCREASED BADGE SIZE for JPG
        const badgeSize = basePixelSize * 0.6; 
        const fontSize = badgeSize * 0.6;

        // --- DRAW LINES (User Drawn) ---
        if (lines && lines.length > 0) {
            ctx.lineCap = 'round';
            for (const line of lines) {
                const sx = (line.startX / 100) * logicalWidth;
                const sy = (line.startY / 100) * logicalHeight;
                const ex = (line.endX / 100) * logicalWidth;
                const ey = (line.endY / 100) * logicalHeight;

                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(ex, ey);
                ctx.strokeStyle = line.color;
                ctx.lineWidth = basePixelSize * 0.12; 
                ctx.globalAlpha = 0.8;
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }
        }

        // Helper to load an image from SVG string
        const loadSvgIcon = (svgString: string): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
                const iconImg = new Image();
                iconImg.onload = () => resolve(iconImg);
                iconImg.onerror = () => reject(new Error("Errore caricamento icona"));
                iconImg.src = svgString;
            });
        };

        const iconCache: Record<string, HTMLImageElement> = {};
        const uniqueTypes = Array.from(new Set(points.map(p => p.type))) as PointType[];
        
        for (const t of uniqueTypes) {
            try {
                iconCache[t] = await loadSvgIcon(getPointIconSVGString(t, '#dc2626'));
            } catch (e) {
                console.warn(`Could not load icon for type ${t}`, e);
            }
        }

        // --- DRAW MARKER LEADER LINES ---
        ctx.strokeStyle = '#dc2626'; 
        ctx.lineWidth = basePixelSize * 0.08;
        ctx.lineCap = 'round';
        
        for (const point of points) {
             const x = (point.x / 100) * logicalWidth;
             const y = (point.y / 100) * logicalHeight;
             
             if (point.targetX !== undefined && point.targetY !== undefined) {
                 if (Math.abs(point.targetX - point.x) > 0.1 || Math.abs(point.targetY - point.y) > 0.1) {
                     const tx = (point.targetX / 100) * logicalWidth;
                     const ty = (point.targetY / 100) * logicalHeight;
                     
                     ctx.beginPath();
                     ctx.moveTo(tx, ty);
                     ctx.lineTo(x, y);
                     ctx.stroke();

                     ctx.beginPath();
                     ctx.arc(tx, ty, basePixelSize * 0.1, 0, 2 * Math.PI);
                     ctx.fillStyle = '#dc2626';
                     ctx.fill();
                 }
             }
        }

        // --- DRAW MARKERS ---
        for (const point of points) {
            const x = (point.x / 100) * logicalWidth;
            const y = (point.y / 100) * logicalHeight;

            ctx.beginPath();
            ctx.arc(x, y, basePixelSize / 2, 0, 2 * Math.PI);
            ctx.fillStyle = 'white';
            ctx.fill();
            ctx.strokeStyle = '#dc2626';
            ctx.lineWidth = basePixelSize * 0.05;
            ctx.stroke();

            const iconImg = iconCache[point.type];
            if (iconImg) {
                const iconW = basePixelSize * 0.6;
                const iconH = basePixelSize * 0.6;
                ctx.drawImage(iconImg, x - iconW/2, y - iconH/2, iconW, iconH);
            }

            const badgeX = x + basePixelSize/2.4; 
            const badgeY = y - basePixelSize/2.4;

            ctx.beginPath();
            ctx.arc(badgeX, badgeY, badgeSize / 2, 0, 2 * Math.PI);
            ctx.fillStyle = '#dc2626';
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = basePixelSize * 0.03;
            ctx.stroke();

            ctx.fillStyle = 'white';
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(point.number.toString(), badgeX, badgeY + (fontSize*0.1));
        }

        return new Promise((resolve) => {
            // High quality JPEG output
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', 0.92);
        });

    } catch (err) {
        console.error("Error generating map image:", err);
        return null;
    }
};
