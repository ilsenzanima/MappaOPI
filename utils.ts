
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
 * Helper to sort typology numerically
 */
const getSortedTypology = (typology: string): string => {
    if (!typology) return "-";
    return typology
      .split(/[,\s/]+/)
      .filter(t => t.trim() !== "")
      .sort((a, b) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (isNaN(numA) || isNaN(numB)) return a.localeCompare(b);
        return numA - numB;
      })
      .join(", ");
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

        doc.addImage(img, 'JPEG', 0, 0, width, height, undefined, 'FAST');

        const baseRef = width / 50; 
        const circleRadius = (baseRef * 0.6) * markerScale; 
        const fontSizeMain = (baseRef * 0.5) * markerScale; 
        const fontSizeAppendix = (baseRef * 0.45) * markerScale;

        lines.forEach(line => {
            const sx = (line.startX / 100) * width;
            const sy = (line.startY / 100) * height;
            const ex = (line.endX / 100) * width;
            const ey = (line.endY / 100) * height;
            doc.setDrawColor(line.color);
            doc.setLineWidth(baseRef * 0.15);
            doc.line(sx, sy, ex, ey);
        });

        doc.setDrawColor('#dc2626');
        doc.setLineWidth(baseRef * 0.1);
        points.forEach(point => {
             if (point.targetX !== undefined && point.targetY !== undefined) {
                 const x = (point.x / 100) * width;
                 const y = (point.y / 100) * height;
                 const tx = (point.targetX / 100) * width;
                 const ty = (point.targetY / 100) * height;
                 doc.line(tx, ty, x, y);
                 doc.setFillColor('#dc2626');
                 doc.circle(tx, ty, baseRef * 0.15, 'F');
             }
        });

        doc.setFont("helvetica", "bold");
        for (const point of points) {
            const x = (point.x / 100) * width;
            const y = (point.y / 100) * height;
            
            // --- MAIN ELEMENT (Typology) - Sorted ---
            const mainText = getSortedTypology(point.typology);
            doc.setFontSize(fontSizeMain);
            const textWidth = doc.getTextWidth(mainText);
            
            const pillPadding = fontSizeMain * 0.5;
            const pillW = Math.max(circleRadius * 2, textWidth + pillPadding);
            const pillH = circleRadius * 2;

            doc.setFillColor('#dc2626'); 
            doc.setDrawColor('#ffffff');
            doc.setLineWidth(baseRef * 0.05);
            
            doc.roundedRect(x - (pillW / 2), y - (pillH / 2), pillW, pillH, pillH / 2, pillH / 2, 'FD');

            doc.setTextColor('#ffffff');
            doc.text(mainText, x - (textWidth / 2), y + (fontSizeMain * 0.35));

            // --- APPENDIX (Number) ---
            doc.setFontSize(fontSizeAppendix);
            const appendixText = point.number.toString();
            const appWidth = doc.getTextWidth(appendixText);
            
            const appPadding = fontSizeAppendix * 0.4;
            const appH = fontSizeAppendix * 1.5;
            const appW = Math.max(appH, appWidth + (appPadding * 2));
            
            const appX = x + (pillW * 0.4);
            const appY = y - (pillH * 0.8);

            doc.setFillColor('#ffffff');
            doc.setDrawColor('#dc2626');
            doc.setLineWidth(baseRef * 0.03);
            doc.rect(appX, appY, appW, appH, 'FD');

            doc.setTextColor('#dc2626');
            doc.text(appendixText, appX + (appW - appWidth) / 2, appY + appH - (appPadding));
        }

        // --- REPORT PAGES ---
        const sortedPoints = [...points].sort((a, b) => a.number - b.number);
        let cursorIndex = 0;
        while (cursorIndex < sortedPoints.length) {
            doc.addPage("a4", "p");
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const qW = pageWidth / 2;
            const qH = pageHeight / 2;
            for (let i = 0; i < 4; i++) {
                if (cursorIndex >= sortedPoints.length) break;
                const point = sortedPoints[cursorIndex];
                const col = i % 2;
                const row = Math.floor(i / 2);
                const xBase = col * qW;
                const yBase = row * qH;
                doc.setDrawColor(200, 200, 200);
                doc.rect(xBase, yBase, qW, qH);
                const headerH = 25;
                doc.setFillColor(240, 240, 240);
                doc.rect(xBase, yBase, qW, headerH, 'F');
                doc.line(xBase, yBase + headerH, xBase + qW, yBase + headerH);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0);
                // Also sort here for clarity in the title
                const sortedTyp = getSortedTypology(point.typology);
                const titleText = `Intervento N. ${point.number} | Tip: ${sortedTyp}`;
                doc.text(titleText, xBase + 10, yBase + 17);
                const padding = 10;
                const contentY = yBase + headerH + padding;
                const contentW = qW - (padding * 2);
                const contentH = qH - headerH - (padding * 2);
                const descH = 60;
                const imageAreaH = contentH - descH - 10;
                if (point.images && point.images.length > 0) {
                    const imgsToShow = point.images.slice(0, 2);
                    const gap = 5;
                    const slotW = imgsToShow.length === 1 ? contentW : (contentW - gap) / 2;
                    for (let k = 0; k < imgsToShow.length; k++) {
                        const imgData = imgsToShow[k];
                        try {
                            const imgObj = await loadImage(imgData);
                            const scale = Math.min(slotW / imgObj.naturalWidth, imageAreaH / imgObj.naturalHeight);
                            const drawW = imgObj.naturalWidth * scale;
                            const drawH = imgObj.naturalHeight * scale;
                            const slotX = xBase + padding + (k * (slotW + gap));
                            const finalX = slotX + (slotW - drawW) / 2;
                            const finalY = contentY + (imageAreaH - drawH) / 2;
                            doc.addImage(imgData, 'JPEG', finalX, finalY, drawW, drawH, undefined, 'FAST');
                        } catch (err) {}
                    }
                }
                const descY = contentY + imageAreaH + 10;
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                doc.setTextColor(50);
                const splitDesc = doc.splitTextToSize(point.description || "-", contentW);
                doc.text(splitDesc, xBase + padding, descY + 5);
                cursorIndex++;
            }
        }
        if (shouldReturnBlob) return doc.output('bloburl');
        else doc.save(`${planName || 'planimetria'}_report.pdf`);
    } catch (e) {
        console.error(e);
        alert("Errore PDF.");
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
        if (!ctx) throw new Error("Canvas context error");
        const scaleFactor = 2;
        canvas.width = Math.ceil(img.naturalWidth * scaleFactor);
        canvas.height = Math.ceil(img.naturalHeight * scaleFactor);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scaleFactor, scaleFactor);
        ctx.drawImage(img, 0, 0);
        const logicalWidth = img.naturalWidth;
        const logicalHeight = img.naturalHeight;
        const baseRef = logicalWidth / 50; 
        const circleRadius = (baseRef * 0.6) * markerScale; 
        const fontSizeMain = (baseRef * 0.5) * markerScale;
        const fontSizeAppendix = (baseRef * 0.45) * markerScale;

        if (lines && lines.length > 0) {
            ctx.lineCap = 'round';
            for (const line of lines) {
                ctx.beginPath();
                ctx.moveTo((line.startX / 100) * logicalWidth, (line.startY / 100) * logicalHeight);
                ctx.lineTo((line.endX / 100) * logicalWidth, (line.endY / 100) * logicalHeight);
                ctx.strokeStyle = line.color;
                ctx.lineWidth = baseRef * 0.15; 
                ctx.globalAlpha = 0.8;
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }
        }

        ctx.strokeStyle = '#dc2626'; 
        ctx.lineWidth = baseRef * 0.1;
        for (const point of points) {
             if (point.targetX !== undefined && point.targetY !== undefined) {
                 ctx.beginPath();
                 ctx.moveTo((point.targetX / 100) * logicalWidth, (point.targetY / 100) * logicalHeight);
                 ctx.lineTo((point.x / 100) * logicalWidth, (point.y / 100) * logicalHeight);
                 ctx.stroke();
                 ctx.beginPath();
                 ctx.arc((point.targetX / 100) * logicalWidth, (point.targetY / 100) * logicalHeight, baseRef * 0.15, 0, 2 * Math.PI);
                 ctx.fillStyle = '#dc2626';
                 ctx.fill();
             }
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const point of points) {
            const x = (point.x / 100) * logicalWidth;
            const y = (point.y / 100) * logicalHeight;
            const mainText = getSortedTypology(point.typology);
            
            ctx.font = `bold ${fontSizeMain}px sans-serif`;
            const textWidth = ctx.measureText(mainText).width;
            const pillW = Math.max(circleRadius * 2, textWidth + (fontSizeMain * 0.6));
            const pillH = circleRadius * 2;

            // Pill Shape
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x - pillW/2, y - pillH/2, pillW, pillH, pillH/2);
            else ctx.rect(x - pillW/2, y - pillH/2, pillW, pillH);
            ctx.fillStyle = '#dc2626';
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = baseRef * 0.05;
            ctx.stroke();

            ctx.fillStyle = 'white';
            ctx.fillText(mainText, x, y + (fontSizeMain * 0.05));

            // Appendix (Number)
            ctx.font = `bold ${fontSizeAppendix}px sans-serif`;
            const appText = point.number.toString();
            const appW = Math.max(fontSizeAppendix * 1.5, ctx.measureText(appText).width + (fontSizeAppendix * 0.8));
            const appH = fontSizeAppendix * 1.5;
            const appX = x + (pillW * 0.3);
            const appY = y - (pillH * 0.7);

            ctx.beginPath();
            ctx.rect(appX, appY, appW, appH);
            ctx.fillStyle = 'white';
            ctx.fill();
            ctx.strokeStyle = '#dc2626';
            ctx.lineWidth = baseRef * 0.03;
            ctx.stroke();
            ctx.fillStyle = '#dc2626';
            ctx.fillText(appText, appX + appW/2, appY + appH/2 + (fontSizeAppendix * 0.05));
        }

        return new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
        });
    } catch (err) {
        return null;
    }
};
