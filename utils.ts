
import { MapPoint, MapLine } from './types';
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
 * Generates a high-quality PDF with vector overlays and a 4-quadrant data report.
 * If shouldReturnBlob is true, returns a Blob URL instead of saving the file.
 */
export const generatePDF = async (
    imageSrc: string,
    points: MapPoint[],
    lines: MapLine[],
    markerScale: number,
    planName: string,
    shouldReturnBlob: boolean = false
): Promise<string | void> => {
    try {
        const img = await loadImage(imageSrc);
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        
        // --- PAGE 1: MAP ---
        const orientation = width > height ? 'l' : 'p';
        const doc = new jsPDF({
            orientation,
            unit: 'px',
            format: [width, height]
        });

        // 1. Add Background Image
        doc.addImage(img, 'JPEG', 0, 0, width, height, undefined, 'FAST');

        // Reference sizes based on image dimensions
        const baseRef = width / 50; 
        const circleRadius = (baseRef * 0.6) * markerScale; 
        const fontSizeMain = (baseRef * 0.6) * markerScale; 
        const fontSizeAppendix = (baseRef * 0.45) * markerScale;

        // 2. Draw Lines (Vectors)
        lines.forEach(line => {
            const sx = (line.startX / 100) * width;
            const sy = (line.startY / 100) * height;
            const ex = (line.endX / 100) * width;
            const ey = (line.endY / 100) * height;

            doc.setDrawColor(line.color);
            doc.setLineWidth(baseRef * 0.15);
            doc.line(sx, sy, ex, ey);
        });

        // 3. Draw Marker Leader Lines (Vectors)
        doc.setDrawColor('#dc2626'); // Red-600
        doc.setLineWidth(baseRef * 0.1);

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
                     doc.circle(tx, ty, baseRef * 0.15, 'F');
                 }
             }
        });

        // 4. Draw Markers (Circle + Appendix)
        doc.setFont("helvetica", "bold");

        for (const point of points) {
            const x = (point.x / 100) * width;
            const y = (point.y / 100) * height;
            
            // --- MAIN CIRCLE (Number) ---
            doc.setFillColor('#dc2626'); // Red
            doc.setDrawColor('#ffffff'); // White border
            doc.setLineWidth(baseRef * 0.05);
            doc.circle(x, y, circleRadius, 'FD');

            doc.setTextColor('#ffffff');
            doc.setFontSize(fontSizeMain);
            const numText = point.number.toString();
            const numWidth = doc.getTextWidth(numText);
            doc.text(numText, x - (numWidth / 2), y + (fontSizeMain * 0.35));

            // --- APPENDIX LABEL (Typology) ---
            if (point.typology && point.typology.trim() !== '') {
                doc.setFontSize(fontSizeAppendix);
                const typoText = point.typology;
                const typoWidth = doc.getTextWidth(typoText);
                
                const padding = fontSizeAppendix * 0.4;
                const rectH = fontSizeAppendix * 1.5;
                const rectW = Math.max(rectH, typoWidth + (padding * 2)); // Minimum square
                
                // Position: Top Right relative to center
                const rectX = x + (circleRadius * 0.7);
                const rectY = y - (circleRadius * 1.3);

                doc.setFillColor('#ffffff'); // White fill
                doc.setDrawColor('#dc2626'); // Red border
                doc.setLineWidth(baseRef * 0.03);
                
                doc.rect(rectX, rectY, rectW, rectH, 'FD');

                doc.setTextColor('#dc2626'); // Red text
                doc.text(typoText, rectX + (rectW - typoWidth) / 2, rectY + rectH - (padding));
            }
        }

        // --- PAGE 2+: QUADRANT REPORT (4 per page) ---
        // Sort points by number
        const sortedPoints = [...points].sort((a, b) => a.number - b.number);
        let cursorIndex = 0;

        while (cursorIndex < sortedPoints.length) {
            doc.addPage("a4", "p");
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            
            // Quadrant Dimensions
            const qW = pageWidth / 2;
            const qH = pageHeight / 2;

            for (let i = 0; i < 4; i++) {
                if (cursorIndex >= sortedPoints.length) break;
                const point = sortedPoints[cursorIndex];
                
                // Coordinates (0: TL, 1: TR, 2: BL, 3: BR)
                const col = i % 2;
                const row = Math.floor(i / 2);
                const xBase = col * qW;
                const yBase = row * qH;

                // Draw Quadrant Border
                doc.setDrawColor(200, 200, 200); // Light Gray
                doc.setLineWidth(1);
                doc.rect(xBase, yBase, qW, qH);

                // --- 1. Header (Title) ---
                const headerH = 25;
                doc.setFillColor(240, 240, 240); // Very light gray bg
                doc.rect(xBase, yBase, qW, headerH, 'F');
                
                // Border bottom of header
                doc.line(xBase, yBase + headerH, xBase + qW, yBase + headerH);

                doc.setFont("helvetica", "bold");
                doc.setFontSize(12);
                doc.setTextColor(0, 0, 0);
                
                const titleText = `Punto N. ${point.number} ${point.typology ? `(Tip. ${point.typology})` : ''}`;
                doc.text(titleText, xBase + 10, yBase + 17);

                // --- 2. Layout Calculation ---
                const padding = 10;
                const contentY = yBase + headerH + padding;
                const contentW = qW - (padding * 2);
                const contentH = qH - headerH - (padding * 2);

                // Space allocation: 
                // Description at bottom (approx 25% height or fixed lines)
                // Images take remaining top space.
                const descH = 60; // Space for description
                const imageAreaH = contentH - descH - 10; // Gap

                // --- 3. Images ---
                if (point.images && point.images.length > 0) {
                    // Show max 2 images side-by-side
                    const imgsToShow = point.images.slice(0, 2);
                    const gap = 5;
                    // Available width per image
                    const slotW = imgsToShow.length === 1 ? contentW : (contentW - gap) / 2;
                    
                    for (let k = 0; k < imgsToShow.length; k++) {
                        const imgData = imgsToShow[k];
                        try {
                            // Preload to get aspect ratio
                            const imgObj = await loadImage(imgData);
                            const iW = imgObj.naturalWidth;
                            const iH = imgObj.naturalHeight;

                            // Calculate 'contain' fit
                            const scale = Math.min(slotW / iW, imageAreaH / iH);
                            const drawW = iW * scale;
                            const drawH = iH * scale;

                            // Center in slot
                            const slotX = xBase + padding + (k * (slotW + gap));
                            const slotY = contentY; // Top of content area
                            
                            const finalX = slotX + (slotW - drawW) / 2;
                            const finalY = slotY + (imageAreaH - drawH) / 2;

                            doc.addImage(imgData, 'JPEG', finalX, finalY, drawW, drawH, undefined, 'FAST');
                            
                            // Optional: subtle border around image
                            doc.setDrawColor(220);
                            doc.rect(finalX, finalY, drawW, drawH);
                            
                        } catch (err) {
                            console.warn("Error adding image to PDF", err);
                        }
                    }
                } else {
                    // Placeholder text if no image
                    doc.setFont("helvetica", "italic");
                    doc.setFontSize(10);
                    doc.setTextColor(150);
                    doc.text("Nessuna foto allegata", xBase + (qW / 2), contentY + (imageAreaH / 2), { align: 'center' });
                }

                // --- 4. Description ---
                const descY = contentY + imageAreaH + 10;
                
                // Separator line
                doc.setDrawColor(240);
                doc.line(xBase + padding, descY - 5, xBase + qW - padding, descY - 5);

                doc.setFont("helvetica", "normal");
                doc.setFontSize(10);
                doc.setTextColor(50);
                
                const descText = point.description ? point.description : "-";
                
                // Wrap text
                const splitDesc = doc.splitTextToSize(descText, contentW);
                // We truncate if it exceeds available space, or just let it overflow (risk overlapping next page? no, we have clipped box concept)
                // For simplicity, we just print. 
                doc.text(splitDesc, xBase + padding, descY + 5);

                cursorIndex++;
            }
        }

        // --- FINALIZE ---
        if (shouldReturnBlob) {
            return doc.output('bloburl');
        } else {
            doc.save(`${planName || 'planimetria'}_report.pdf`);
        }

    } catch (e) {
        console.error("PDF Generation Error", e);
        alert("Errore durante la creazione del PDF.");
    }
};

/**
 * Renders the map with all points, lines, and markers onto a canvas and returns a Blob (JPEG).
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

        // Scale context
        ctx.scale(scaleFactor, scaleFactor);
        ctx.drawImage(img, 0, 0);

        const logicalWidth = img.naturalWidth;
        const logicalHeight = img.naturalHeight;
        
        const baseRef = logicalWidth / 50; 
        const circleRadius = (baseRef * 0.6) * markerScale; 
        const fontSizeMain = (baseRef * 0.6) * markerScale;
        const fontSizeAppendix = (baseRef * 0.45) * markerScale;

        // --- DRAW LINES ---
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
                ctx.lineWidth = baseRef * 0.15; 
                ctx.globalAlpha = 0.8;
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }
        }

        // --- DRAW MARKER LEADER LINES ---
        ctx.strokeStyle = '#dc2626'; 
        ctx.lineWidth = baseRef * 0.1;
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
                     ctx.arc(tx, ty, baseRef * 0.15, 0, 2 * Math.PI);
                     ctx.fillStyle = '#dc2626';
                     ctx.fill();
                 }
             }
        }

        // --- DRAW MARKERS ---
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const point of points) {
            const x = (point.x / 100) * logicalWidth;
            const y = (point.y / 100) * logicalHeight;

            // 1. Draw Main Circle
            ctx.beginPath();
            ctx.arc(x, y, circleRadius, 0, 2 * Math.PI);
            ctx.fillStyle = '#dc2626';
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = baseRef * 0.05;
            ctx.stroke();

            // Number Text
            ctx.font = `bold ${fontSizeMain}px sans-serif`;
            ctx.fillStyle = 'white';
            ctx.fillText(point.number.toString(), x, y + (fontSizeMain * 0.1));

            // 2. Draw Appendix (if exists)
            if (point.typology && point.typology.trim() !== '') {
                ctx.font = `bold ${fontSizeAppendix}px sans-serif`;
                const typoText = point.typology;
                const metrics = ctx.measureText(typoText);
                const typoWidth = metrics.width;
                
                const padding = fontSizeAppendix * 0.4;
                const rectH = fontSizeAppendix * 1.5;
                const rectW = Math.max(rectH, typoWidth + (padding * 2));
                
                const rectX = x + (circleRadius * 0.7);
                const rectY = y - (circleRadius * 1.3);

                ctx.beginPath();
                // Simple rect for compatibility, or roundRect if supported
                if (ctx.roundRect) {
                    ctx.roundRect(rectX, rectY, rectW, rectH, 2);
                } else {
                    ctx.rect(rectX, rectY, rectW, rectH);
                }
                
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.strokeStyle = '#dc2626';
                ctx.lineWidth = baseRef * 0.03;
                ctx.stroke();

                ctx.fillStyle = '#dc2626';
                // Calculate center of rect
                ctx.fillText(typoText, rectX + rectW/2, rectY + rectH/2 + (fontSizeAppendix * 0.1));
            }
        }

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', 0.92);
        });

    } catch (err) {
        console.error("Error generating map image:", err);
        return null;
    }
};
