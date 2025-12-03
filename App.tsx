
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Marker } from './components/Marker';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { ProjectManager } from './components/ProjectManager';
import { MapPoint, ProjectState, InteractionMode, PointType, SavedProject } from './types';
import { PointIcon, getPointIconSVGString } from './components/PointIcons';
import { Maximize, Check, PlusCircle } from 'lucide-react';
import { saveProject } from './db';

const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15);
};

export default function App() {
  // State: Data
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  // NEW: Track natural image dimensions to calculate correct scaled width/height
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  
  const [planName, setPlanName] = useState<string>('');
  const [floor, setFloor] = useState<string>('');
  const [rotation, setRotation] = useState<number>(0);
  const [markerScale, setMarkerScale] = useState<number>(1);
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(undefined);

  // State: UI & Modes
  const [mode, setMode] = useState<InteractionMode>('pan');
  const [activePointType, setActivePointType] = useState<PointType>('generic');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [scale, setScale] = useState(1);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  
  // State: Modals
  const [showProjectModal, setShowProjectModal] = useState(false); 
  const [showManagerModal, setShowManagerModal] = useState(false); 
  const [tempImageFile, setTempImageFile] = useState<File | null>(null);
  const [pendingImageName, setPendingImageName] = useState<string | null>(null);

  // Dragging state (Markers)
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'badge' | 'target'>('badge');
  
  // Creation state (Add Mode)
  const [creationStart, setCreationStart] = useState<{x: number, y: number} | null>(null);
  const [currentMousePos, setCurrentMousePos] = useState<{x: number, y: number} | null>(null);

  // Panning state (Map)
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });

  // Refs
  const containerWrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Helpers ---

  const resetProject = () => {
      setPoints([]);
      setPlanName('');
      setFloor('');
      setImageSrc(null);
      setImageName(null);
      setImgSize({ w: 0, h: 0 });
      setScale(1);
      setRotation(0);
      setMarkerScale(1);
      setCurrentProjectId(undefined);
  };

  // Helper to get image dimensions
  const getImageDimensions = (src: string): Promise<{ w: number, h: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = src;
    });
  };

  const getRelativeCoordinates = (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const dx = clientX - centerX;
      const dy = clientY - centerY;
      
      const radians = -rotation * (Math.PI / 180);
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      
      const rotatedDx = dx * cos - dy * sin;
      const rotatedDy = dx * sin + dy * cos;
      
      // Removed division by scale here because containerRef is physically resized.
      // Its offsetWidth includes the scale factor.
      
      const width = containerRef.current.offsetWidth;
      const height = containerRef.current.offsetHeight;
      
      const localX = rotatedDx + width / 2;
      const localY = rotatedDy + height / 2;
      
      const xPercent = (localX / width) * 100;
      const yPercent = (localY / height) * 100;
      
      return { x: xPercent, y: yPercent };
  };

  // --- DB / Project Manager Handlers ---

  const handleSaveProject = async () => {
    if (!imageSrc) return;
    try {
        const id = await saveProject({
            id: currentProjectId, 
            version: 1,
            planName,
            floor,
            imageName: imageName || 'image.png',
            rotation,
            markerScale,
            points,
            imageData: imageSrc
        });
        setCurrentProjectId(id);
        alert('Progetto salvato con successo nella cartella locale!');
    } catch (e) {
        console.error(e);
        alert('Errore durante il salvataggio.');
    }
  };

  const handleLoadSavedProject = async (p: SavedProject) => {
      setPoints(p.points);
      setPlanName(p.planName);
      setFloor(p.floor);
      setImageName(p.imageName);
      setRotation(p.rotation);
      setMarkerScale(p.markerScale || 1);
      setCurrentProjectId(p.id);
      
      // Load image and get dimensions
      setImageSrc(p.imageData);
      const dims = await getImageDimensions(p.imageData);
      setImgSize(dims);

      setScale(1);
      setShowManagerModal(false);
      setMode('pan');
  };

  // --- Handlers: Image Upload & Setup ---

  const handleImageUploadStart = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setTempImageFile(file);
        if (pendingImageName) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                if (typeof event.target?.result === 'string') {
                    const src = event.target.result;
                    setImageSrc(src);
                    const dims = await getImageDimensions(src);
                    setImgSize(dims);
                    setImageName(file.name);
                    setPendingImageName(null);
                    setTempImageFile(null);
                }
            };
            reader.readAsDataURL(file);
        } else {
            setPlanName(file.name.split('.')[0]);
            setShowProjectModal(true);
        }
    }
    e.target.value = '';
  };

  const confirmProjectDetails = () => {
    if (tempImageFile) {
        const reader = new FileReader();
        reader.onload = async (event) => {
            if (typeof event.target?.result === 'string') {
                const src = event.target.result;
                setImageSrc(src);
                const dims = await getImageDimensions(src);
                setImgSize(dims);
                setImageName(tempImageFile.name);
                setPoints([]);
                setScale(1);
                setRotation(0);
                setCurrentProjectId(undefined); 
            }
        };
        reader.readAsDataURL(tempImageFile);
    }
    setShowProjectModal(false);
    setTempImageFile(null);
    setMode('pan');
  };

  // --- Handlers: Map Interaction (Creation & Dragging) ---

  const handleMapMouseDown = (e: React.MouseEvent) => {
      if (mode === 'add') {
         if (!imageSrc || !containerRef.current) return;
         const coords = getRelativeCoordinates(e.clientX, e.clientY);
         if (coords.x < 0 || coords.x > 100 || coords.y < 0 || coords.y > 100) return;
         
         setCreationStart(coords);
         setCurrentMousePos(coords);
      }
  };

  const handleMapMouseUp = (e: React.MouseEvent) => {
      if (mode === 'add' && creationStart) {
          const endCoords = getRelativeCoordinates(e.clientX, e.clientY);
          
          // Determine if it was a drag or a click
          // We calculate distance in percentages, which is rough but okay
          const dx = endCoords.x - creationStart.x;
          const dy = endCoords.y - creationStart.y;
          const dist = Math.sqrt(dx*dx + dy*dy);

          const newPoint: MapPoint = {
              id: generateId(),
              number: points.length + 1,
              x: endCoords.x, // Badge Position (Mouse Up)
              y: endCoords.y,
              type: activePointType,
              description: '',
              createdAt: Date.now(),
          };

          // If dragged significantly (> 1% of screen), use start point as target
          if (dist > 1.0) {
              newPoint.targetX = creationStart.x; // Arrow/Target Position (Mouse Down)
              newPoint.targetY = creationStart.y;
          } else {
              // Standard point, target = x,y (can imply no line)
              newPoint.targetX = endCoords.x;
              newPoint.targetY = endCoords.y;
          }

          setPoints(prev => [...prev, newPoint]);
          setSelectedPointId(newPoint.id);
          setCreationStart(null);
          setCurrentMousePos(null);
      }
  };

  // --- Handlers: Markers ---

  const handleMarkerMouseDown = (e: React.MouseEvent, id: string) => {
      // Prevent creating a new point when clicking existing marker
      e.stopPropagation();
      e.preventDefault();

      setSelectedPointId(id);
      if (mode === 'move') {
          setDraggingPointId(id);
          setDragType('badge');
      }
  };

  const handleTargetMouseDown = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      
      setSelectedPointId(id);
      if (mode === 'move') {
          setDraggingPointId(id);
          setDragType('target');
      }
  };

  const updatePoint = (id: string, data: Partial<MapPoint>) => {
      setPoints(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  };

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    // Handling Marker Move
    if (draggingPointId && containerRef.current) {
        const { x, y } = getRelativeCoordinates(e.clientX, e.clientY);
        setPoints(prev => prev.map(p => {
             if (p.id !== draggingPointId) return p;
             
             if (dragType === 'target') {
                 // Move the arrow tip (start)
                 return {
                     ...p,
                     targetX: Math.max(0, Math.min(100, x)),
                     targetY: Math.max(0, Math.min(100, y))
                 };
             } else {
                 // Move the badge (end/symbol)
                 return { 
                     ...p, 
                     x: Math.max(0, Math.min(100, x)), 
                     y: Math.max(0, Math.min(100, y)) 
                 };
             }
        }));
    }

    // Handling Creation Drag Visuals
    if (mode === 'add' && creationStart && containerRef.current) {
        const coords = getRelativeCoordinates(e.clientX, e.clientY);
        setCurrentMousePos(coords);
    }

  }, [draggingPointId, dragType, rotation, scale, mode, creationStart]);

  const handleGlobalMouseUp = useCallback(() => {
    setDraggingPointId(null);
    // Also stop panning if it was active and mouse left window
    setIsPanning(false);
    document.body.style.cursor = '';
  }, []);

  useEffect(() => {
    // We attach mouseup globally to handle drag releases outside the window
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggingPointId, dragType, handleGlobalMouseMove, handleGlobalMouseUp]);

  // --- Panning ---
  const handleContainerMouseDown = (e: React.MouseEvent) => {
      if (mode !== 'pan') return;
      if (!containerWrapperRef.current) return;
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setScrollStart({ 
          left: containerWrapperRef.current.scrollLeft, 
          top: containerWrapperRef.current.scrollTop 
      });
      document.body.style.cursor = 'grabbing';
  };
  const handleContainerMouseMove = (e: React.MouseEvent) => {
      if (!isPanning || !containerWrapperRef.current) return;
      e.preventDefault(); // Prevent text selection/drag behaviors
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      containerWrapperRef.current.scrollLeft = scrollStart.left - dx;
      containerWrapperRef.current.scrollTop = scrollStart.top - dy;
  };
  
  const handleDeletePoint = (id: string) => {
    setPoints(prev => {
      const filtered = prev.filter(p => p.id !== id);
      return filtered.map((p, index) => ({ ...p, number: index + 1 }));
    });
    if (selectedPointId === id) setSelectedPointId(null);
  };

  // --- Export JSON/Import JSON ---
  const handleExportJSON = () => {
    const data: ProjectState = {
      version: 1,
      planName,
      floor,
      imageName: imageName || '',
      rotation,
      markerScale,
      points: points
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${planName || 'mappatura'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string) as ProjectState;
        if (json.points && Array.isArray(json.points)) {
            if (points.length > 0) {
                if (!window.confirm("Sovrascrivere i dati attuali?")) {
                    e.target.value = '';
                    return;
                }
            }
            const importedPoints = json.points.map(p => ({ ...p, type: p.type || 'generic' }));
            setPoints(importedPoints);
            setPlanName(json.planName || 'Importato');
            setFloor(json.floor || '');
            setRotation(json.rotation || 0);
            setMarkerScale(json.markerScale || 1);
            setCurrentProjectId(undefined); // JSON import is not linked to DB initially
            if (json.imageName && json.imageName !== imageName) {
                setPendingImageName(json.imageName);
                setImageSrc(null); 
                setImageName(null); 
                setImgSize({ w: 0, h: 0 }); // reset size until image loaded
            } else if (!imageName) {
                setPendingImageName(json.imageName || 'unknown');
            }
        }
      } catch (err) {
        alert("Errore file JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- EXPORT IMAGE FUNCTION (HIGH FIDELITY) ---
  const handleExportImage = async () => {
      if (!imageSrc || !containerRef.current) return;

      try {
        const img = new Image();
        img.src = imageSrc;
        
        // Wait for main image to load
        await new Promise((resolve, reject) => { 
            img.onload = resolve; 
            img.onerror = () => reject(new Error("Errore caricamento immagine originale"));
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Impossibile creare contesto canvas");

        // Set canvas to full resolution
        canvas.width = Math.ceil(img.naturalWidth);
        canvas.height = Math.ceil(img.naturalHeight);

        // Fill background with white (Crucial for WebP/Transparent PNGs)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw base plan
        ctx.save();
        ctx.drawImage(img, 0, 0);
        ctx.restore();

        // Calc sizes
        // REVISED SIZE LOGIC: Instead of a flat %, we use a ratio that mimics screen density (approx 1/45th of width).
        // This ensures that on 4000px images, markers aren't huge (160px), but closer to ~88px.
        const basePixelSize = (canvas.width / 45) * markerScale; 
        
        const badgeSize = basePixelSize * 0.4;
        const fontSize = badgeSize * 0.7;

        // Helper to load an image from SVG string
        const loadSvgIcon = (svgString: string): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
                const iconImg = new Image();
                iconImg.onload = () => resolve(iconImg);
                iconImg.onerror = () => reject(new Error("Errore caricamento icona"));
                iconImg.src = svgString;
            });
        };

        // Preload icons
        const iconCache: Record<string, HTMLImageElement> = {};
        const uniqueTypes = Array.from(new Set(points.map(p => p.type))) as PointType[];
        
        for (const t of uniqueTypes) {
            try {
                iconCache[t] = await loadSvgIcon(getPointIconSVGString(t, '#dc2626'));
            } catch (e) {
                console.warn(`Could not load icon for type ${t}`, e);
            }
        }

        // --- FIRST PASS: Draw Leader Lines (Behind Markers) ---
        ctx.strokeStyle = '#dc2626'; // Red-600
        ctx.lineWidth = basePixelSize * 0.08;
        ctx.lineCap = 'round';
        
        for (const point of points) {
             const x = (point.x / 100) * canvas.width;
             const y = (point.y / 100) * canvas.height;
             
             if (point.targetX !== undefined && point.targetY !== undefined) {
                 // Check if actually different from badge position (with tolerance)
                 if (Math.abs(point.targetX - point.x) > 0.1 || Math.abs(point.targetY - point.y) > 0.1) {
                     const tx = (point.targetX / 100) * canvas.width;
                     const ty = (point.targetY / 100) * canvas.height;
                     
                     // Draw Line
                     ctx.beginPath();
                     ctx.moveTo(tx, ty);
                     ctx.lineTo(x, y);
                     ctx.stroke();

                     // Draw Target Dot
                     ctx.beginPath();
                     ctx.arc(tx, ty, basePixelSize * 0.1, 0, 2 * Math.PI);
                     ctx.fillStyle = '#dc2626';
                     ctx.fill();
                 }
             }
        }

        // --- SECOND PASS: Draw Markers ---
        for (const point of points) {
            const x = (point.x / 100) * canvas.width;
            const y = (point.y / 100) * canvas.height;

            // Draw White Circle Background
            ctx.beginPath();
            ctx.arc(x, y, basePixelSize / 2, 0, 2 * Math.PI);
            ctx.fillStyle = 'white';
            ctx.fill();
            ctx.strokeStyle = '#dc2626';
            ctx.lineWidth = basePixelSize * 0.05;
            ctx.stroke();

            // Draw SVG Icon
            const iconImg = iconCache[point.type];
            if (iconImg) {
                const iconW = basePixelSize * 0.6;
                const iconH = basePixelSize * 0.6;
                ctx.drawImage(iconImg, x - iconW/2, y - iconH/2, iconW, iconH);
            }

            // Draw Badge Circle
            const badgeX = x + basePixelSize/2.8; 
            const badgeY = y - basePixelSize/2.8;

            ctx.beginPath();
            ctx.arc(badgeX, badgeY, badgeSize / 2, 0, 2 * Math.PI);
            ctx.fillStyle = '#dc2626';
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = basePixelSize * 0.03;
            ctx.stroke();

            // Draw Number
            ctx.fillStyle = 'white';
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(point.number.toString(), badgeX, badgeY + (fontSize*0.1));
        }

        canvas.toBlob((blob) => {
            if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${planName || 'planimetria'}_export.jpg`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } else {
                alert("Errore nella creazione del file immagine.");
            }
        }, 'image/jpeg', 0.9);

      } catch (err) {
          console.error(err);
          alert("Si è verificato un errore durante l'esportazione della foto. Controlla la console per i dettagli.");
      }
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-slate-100">
      
      {/* Topbar */}
      <Topbar 
        mode={mode}
        setMode={setMode}
        scale={scale}
        onZoomIn={() => setScale(s => Math.min(s + 0.2, 5))}
        onZoomOut={() => setScale(s => Math.max(s - 0.2, 0.1))}
        onResetZoom={() => { setScale(1); setRotation(0); }}
        rotation={rotation}
        setRotation={setRotation}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        activePointType={activePointType}
        setActivePointType={setActivePointType}
        onSaveProject={handleSaveProject}
        onOpenProjectManager={() => setShowManagerModal(true)}
        onExportImage={handleExportImage}
        hasImage={!!imageSrc}
        markerScale={markerScale}
        onIncreaseMarkerSize={() => setMarkerScale(s => Math.min(s + 0.2, 3))}
        onDecreaseMarkerSize={() => setMarkerScale(s => Math.max(s - 0.2, 0.5))}
      />

      <div className="flex flex-1 relative overflow-hidden">
          
          {/* Main Map Area */}
          <div className="flex-1 relative bg-slate-200 overflow-hidden">
             
            {/* Modal: Project Details (New Project) */}
            {showProjectModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4 text-slate-800">Dettagli Planimetria</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Nome Planimetria</label>
                                <input 
                                    type="text" value={planName} onChange={(e) => setPlanName(e.target.value)}
                                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Piano</label>
                                <input 
                                    type="text" value={floor} onChange={(e) => setFloor(e.target.value)}
                                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
                                />
                            </div>
                            <div className="pt-4 flex justify-end gap-2">
                                <button onClick={() => setShowProjectModal(false)} className="px-4 py-2 text-slate-500 hover:text-slate-700">Annulla</button>
                                <button onClick={confirmProjectDetails} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold">Conferma</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Project Manager */}
            <ProjectManager 
                isOpen={showManagerModal} 
                onClose={() => setShowManagerModal(false)}
                onLoadProject={handleLoadSavedProject}
            />

            {/* Modal: Missing Image Import */}
            {pendingImageName && !showProjectModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md text-center">
                        <Maximize className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2 text-slate-800">Carica Immagine</h2>
                        <p className="text-slate-600 mb-6">Manca il file: <strong>{pendingImageName}</strong></p>
                        <label className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg cursor-pointer">
                            <Check className="w-5 h-5" /> Seleziona File
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUploadStart} />
                        </label>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!imageSrc && !pendingImageName && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 z-0 p-8 text-center m-8 rounded-xl border-4 border-dashed border-slate-300">
                    <Maximize className="w-20 h-20 mb-4 text-slate-300" />
                    <h1 className="text-2xl font-bold text-slate-600 mb-2">Benvenuto</h1>
                    <p className="max-w-md mb-6">Crea un nuovo progetto o aprine uno esistente dalla barra in alto.</p>
                    <label className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow cursor-pointer">
                        Nuovo Progetto
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUploadStart} />
                    </label>
                </div>
            )}

            {/* Map Canvas - Scroller */}
            {imageSrc && (
                <div 
                    ref={containerWrapperRef}
                    className={`absolute inset-0 overflow-auto bg-slate-200 grid place-items-center
                        ${mode === 'pan' ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''}
                        ${mode === 'add' ? 'cursor-crosshair' : ''}
                        ${mode === 'move' ? 'cursor-default' : ''}
                    `}
                    onMouseDown={handleContainerMouseDown}
                    onMouseMove={handleContainerMouseMove}
                    // onMouseUp handled globally to prevent stuck drag
                >
                    {/* Using CSS Grid place-items-center + explicit width/height is robust for zooming */}
                    <div 
                        style={{ 
                            width: `${imgSize.w * scale}px`, 
                            height: `${imgSize.h * scale}px`,
                        }}
                        className="relative shadow-2xl bg-white select-none flex-none"
                    >
                        {/* The visual container with rotation */}
                        <div 
                            ref={containerRef} 
                            className="w-full h-full relative" 
                            style={{ transform: `rotate(${rotation}deg)` }}
                            onMouseDown={handleMapMouseDown}
                            onMouseUp={handleMapMouseUp}
                        >
                            <img src={imageSrc} alt="Planimetria" className="w-full h-full object-contain pointer-events-none block" draggable={false} />
                            
                            {/* Leader Lines SVG Layer */}
                            <svg className="absolute inset-0 w-full h-full z-0 pointer-events-none">
                                {points.map(p => {
                                    if (p.targetX !== undefined && p.targetY !== undefined && 
                                        (Math.abs(p.targetX - p.x) > 0.1 || Math.abs(p.targetY - p.y) > 0.1)) {
                                        return (
                                            <g key={`line-${p.id}`}>
                                                <line 
                                                    x1={`${p.targetX}%`} y1={`${p.targetY}%`} 
                                                    x2={`${p.x}%`} y2={`${p.y}%`} 
                                                    stroke="#dc2626" strokeWidth={2 * markerScale} strokeLinecap="round" 
                                                />
                                                {/* Target Dot - Now Interactive */}
                                                <circle 
                                                    cx={`${p.targetX}%`} cy={`${p.targetY}%`} r={3 * markerScale} fill="#dc2626" 
                                                    className={mode === 'move' ? 'cursor-move pointer-events-auto hover:fill-blue-600' : ''}
                                                    onMouseDown={(e) => handleTargetMouseDown(e, p.id)}
                                                />
                                            </g>
                                        );
                                    }
                                    return null;
                                })}
                                {/* Creation Preview Line */}
                                {mode === 'add' && creationStart && currentMousePos && (
                                     <g>
                                        <line 
                                            x1={`${creationStart.x}%`} y1={`${creationStart.y}%`} 
                                            x2={`${currentMousePos.x}%`} y2={`${currentMousePos.y}%`} 
                                            stroke="#dc2626" strokeWidth={2 * markerScale} strokeDasharray="5,5"
                                        />
                                        <circle cx={`${creationStart.x}%`} cy={`${creationStart.y}%`} r={3 * markerScale} fill="#dc2626" />
                                     </g>
                                )}
                            </svg>

                            {points.map((point) => (
                                <Marker
                                    key={point.id}
                                    point={point}
                                    scale={scale}
                                    markerScale={markerScale}
                                    isSelected={selectedPointId === point.id}
                                    onMouseDown={handleMarkerMouseDown}
                                    onDelete={handleDeletePoint}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
          </div>

          {/* Right Sidebar */}
          <Sidebar 
            points={points}
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            onDeletePoint={handleDeletePoint}
            onSelectPoint={setSelectedPointId}
            onUpdatePoint={updatePoint}
            selectedPointId={selectedPointId}
            onExportJSON={handleExportJSON}
            onImportJSON={handleImportJSON}
            imageName={imageName}
            planName={planName}
            floor={floor}
          />
      </div>
    </div>
  );
}
