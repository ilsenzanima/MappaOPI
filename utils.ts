
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
 * Generates a high-quality PDF with vector overlays and a data report table.
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

        // --- PAGE 2+: REPORT TABLE ---
        doc.addPage("a4", "p"); // Switch to standard A4 Portrait for the report
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        let cursorY = margin;

        // Title
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text(`Report: ${planName}`, margin, cursorY);
        cursorY += 20;

        // Table Constants
        const col1W = 30; // N.
        const col2W = 80; // Typology
        const col3W = pageWidth - (margin * 2) - col1W - col2W; // Description
        const rowPadding = 6;
        const lineHeight = 12;

        // Header Function
        const drawHeader = (y: number) => {
            doc.setFillColor(220, 220, 220);
            doc.rect(margin, y, pageWidth - (margin * 2), 15, 'F');
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text("N.", margin + 5, y + 11);
            doc.text("Tipologico", margin + col1W + 5, y + 11);
            doc.text("Descrizione", margin + col1W + col2W + 5, y + 11);
            return y + 15;
        };

        cursorY = drawHeader(cursorY);

        // Sort points by number
        const sortedPoints = [...points].sort((a, b) => a.number - b.number);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        for (const point of sortedPoints) {
            // Calculate row height based on description text wrapping
            // Subtract slightly more padding from col3W to ensure text doesn't touch lines
            const descLines = doc.splitTextToSize(point.description || '-', col3W - 12);
            const numLines = descLines.length;
            const rowHeight = Math.max(22, (numLines * lineHeight) + (rowPadding * 2));

            // Check page break
            if (cursorY + rowHeight > pageHeight - margin) {
                doc.addPage("a4", "p");
                cursorY = margin;
                cursorY = drawHeader(cursorY);
            }

            // Draw Row Background (Alternating optional, keeping white for clean look)
            doc.setDrawColor(200, 200, 200);
            doc.rect(margin, cursorY, pageWidth - (margin * 2), rowHeight); // Border
            
            // Vertical Lines
            doc.line(margin + col1W, cursorY, margin + col1W, cursorY + rowHeight);
            doc.line(margin + col1W + col2W, cursorY, margin + col1W + col2W, cursorY + rowHeight);

            // Draw Text
            // Col 1: Number (Centered vertically)
            doc.text(point.number.toString(), margin + 5, cursorY + (rowHeight / 2) + 3.5);
            
            // Col 2: Typology (Centered vertically)
            doc.text(point.typology || '', margin + col1W + 5, cursorY + (rowHeight / 2) + 3.5);

            // Col 3: Description (Wrapped, Top Aligned with padding)
            // Using cursorY + 13 creates a nice top padding (approx 7px from top border)
            doc.text(descLines, margin + col1W + col2W + 5, cursorY + 13);

            cursorY += rowHeight;
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
