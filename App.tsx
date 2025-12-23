
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Marker } from './components/Marker';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { ProjectManager } from './components/ProjectManager';
import { MapPoint, ProjectState, InteractionMode, SavedProject, MapLine, LineColor } from './types';
import { Maximize, X } from 'lucide-react';
import { saveProject } from './db';
import { renderMapToBlob, generatePDF } from './utils';

const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15);
};

export default function App() {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [lines, setLines] = useState<MapLine[]>([]);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  
  const [planName, setPlanName] = useState<string>('');
  const [floor, setFloor] = useState<string>('');
  const [rotation, setRotation] = useState<number>(0);
  const [markerScale, setMarkerScale] = useState<number>(1);
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(undefined);

  const [mode, setMode] = useState<InteractionMode>('pan');
  const [activeLineColor, setActiveLineColor] = useState<LineColor>('#dc2626');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [scale, setScale] = useState(1);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  
  const [showProjectModal, setShowProjectModal] = useState(false); 
  const [showManagerModal, setShowManagerModal] = useState(false); 
  const [tempImageFile, setTempImageFile] = useState<File | null>(null);
  const [pendingImageName, setPendingImageName] = useState<string | null>(null);

  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'badge' | 'target'>('badge');
  
  const [creationStart, setCreationStart] = useState<{x: number, y: number} | null>(null);
  const [currentMousePos, setCurrentMousePos] = useState<{x: number, y: number} | null>(null);

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });

  const containerWrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const resetProject = () => {
      setPoints([]);
      setLines([]);
      setPlanName('');
      setFloor('');
      setImageSrc(null);
      setImageName(null);
      setImgSize({ w: 0, h: 0 });
      setCurrentProjectId(undefined);
      setScale(1);
      setRotation(0);
      setMarkerScale(1);
      setSelectedPointId(null);
      setSelectedLineId(null);
      setMode('pan');
  };

  const handleNewProject = () => {
      if (imageSrc || points.length > 0) {
          if (window.confirm('Sei sicuro di voler creare un nuovo progetto? I dati non salvati andranno persi.')) {
              resetProject();
          }
      } else {
          resetProject();
      }
  };

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
      
      const width = containerRef.current.offsetWidth;
      const height = containerRef.current.offsetHeight;
      
      const localX = rotatedDx + width / 2;
      const localY = rotatedDy + height / 2;
      
      return { x: (localX / width) * 100, y: (localY / height) * 100 };
  };

  const handleSaveProject = async () => {
    if (!imageSrc) return;
    try {
        const id = await saveProject({
            id: currentProjectId, 
            version: 1,
            planName,
            floor,
            imageName: imageName || 'planimetria.png',
            rotation,
            markerScale,
            points,
            lines,
            imageData: imageSrc
        });
        setCurrentProjectId(id);
        alert('Progetto salvato nel database locale.');
    } catch (e) {
        alert('Errore di salvataggio.');
    }
  };

  const handleLoadSavedProject = async (p: SavedProject) => {
      setPoints(p.points);
      setLines(p.lines || []);
      setPlanName(p.planName);
      setFloor(p.floor);
      setImageName(p.imageName);
      setRotation(p.rotation);
      setMarkerScale(p.markerScale || 1);
      setCurrentProjectId(p.id);
      setImageSrc(p.imageData);
      const dims = await getImageDimensions(p.imageData);
      setImgSize(dims);
      setScale(1);
      setShowManagerModal(false);
      setMode('pan');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const content = event.target?.result as string;
            const data = JSON.parse(content);

            // Caso 1: Formato Report personalizzato (con la chiave "dati")
            if (data.dati && Array.isArray(data.dati)) {
                if (!imageSrc) {
                    alert("Carica prima una planimetria per poter importare i dati del report.");
                    return;
                }
                const importedPoints: MapPoint[] = data.dati.map((item: any, index: number) => ({
                    id: generateId(),
                    number: item["N Foto"] || (index + 1),
                    typology: item["N Tipologico"] || "",
                    // Poiché mancano le coordinate, li mettiamo in una griglia in alto a sinistra
                    x: 5 + (index % 10) * 4, 
                    y: 5 + Math.floor(index / 10) * 4,
                    description: item["Descrizione Completa"] || "",
                    createdAt: Date.now()
                }));
                setPoints(importedPoints);
                if (data.piano) setFloor(data.piano);
                if (data.fileName) setPlanName(data.fileName.replace('.json', ''));
                alert(`Importati ${importedPoints.length} punti dal report. Trascinali nella posizione corretta.`);
            } 
            // Caso 2: Formato interno SavedProject
            else if (data.points && Array.isArray(data.points)) {
                setPoints(data.points);
                setLines(data.lines || []);
                if (data.planName) setPlanName(data.planName);
                if (data.floor) setFloor(data.floor);
                if (data.rotation !== undefined) setRotation(data.rotation);
                if (data.markerScale !== undefined) setMarkerScale(data.markerScale);
                alert("Progetto importato correttamente.");
            }
            else {
                alert("Formato JSON non riconosciuto.");
            }
        } catch (err) {
            console.error(err);
            alert("Errore durante la lettura del file JSON. Assicurati che il formato sia corretto.");
        }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImageUploadStart = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setTempImageFile(file);
        if (pendingImageName) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                if (typeof event.target?.result === 'string') {
                    setImageSrc(event.target.result);
                    const dims = await getImageDimensions(event.target.result);
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
                setImageSrc(event.target.result);
                const dims = await getImageDimensions(event.target.result);
                setImgSize(dims);
                setImageName(tempImageFile.name);
                setPoints([]);
                setLines([]);
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

  const handleMapMouseDown = (e: React.MouseEvent) => {
      if (mode === 'add' || mode === 'line' || mode === 'reposition') {
         if (!imageSrc || !containerRef.current) return;
         const coords = getRelativeCoordinates(e.clientX, e.clientY);
         if (coords.x < 0 || coords.x > 100 || coords.y < 0 || coords.y > 100) return;
         setCreationStart(coords);
         setCurrentMousePos(coords);
      }
      if (mode !== 'pan') setSelectedLineId(null);
  };

  const handleMapMouseUp = (e: React.MouseEvent) => {
      if (!creationStart) return;
      const endCoords = getRelativeCoordinates(e.clientX, e.clientY);

      if (mode === 'reposition' && selectedPointId) {
          setPoints(prev => prev.map(p => p.id === selectedPointId ? {
              ...p, x: endCoords.x, y: endCoords.y,
              targetX: creationStart.x, targetY: creationStart.y
          } : p));
          setMode('pan');
      } else if (mode === 'add') {
          const dx = endCoords.x - creationStart.x;
          const dy = endCoords.y - creationStart.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          const nextNum = points.length + 1;
          const newPoint: MapPoint = {
              id: generateId(),
              number: nextNum,
              typology: '',
              x: endCoords.x, y: endCoords.y,
              description: '',
              createdAt: Date.now(),
              targetX: dist > 1.0 ? creationStart.x : endCoords.x,
              targetY: dist > 1.0 ? creationStart.y : endCoords.y,
          };
          setPoints(prev => [...prev, newPoint]);
          setSelectedPointId(newPoint.id);
      } else if (mode === 'line') {
          setLines(prev => [...prev, {
              id: generateId(),
              startX: creationStart.x, startY: creationStart.y,
              endX: endCoords.x, endY: endCoords.y,
              color: activeLineColor
          }]);
      }
      setCreationStart(null);
      setCurrentMousePos(null);
  };

  const handleMarkerMouseDown = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      setSelectedPointId(id);
      if (mode === 'move') { setDraggingPointId(id); setDragType('badge'); }
  };

  const handleTargetMouseDown = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      setSelectedPointId(id);
      if (mode === 'move') { setDraggingPointId(id); setDragType('target'); }
  };

  const updatePoint = (id: string, data: Partial<MapPoint>) => {
      setPoints(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  };

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (draggingPointId && containerRef.current) {
        const { x, y } = getRelativeCoordinates(e.clientX, e.clientY);
        setPoints(prev => prev.map(p => {
             if (p.id !== draggingPointId) return p;
             return dragType === 'target' 
                ? { ...p, targetX: Math.max(0, Math.min(100, x)), targetY: Math.max(0, Math.min(100, y)) }
                : { ...p, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
        }));
    }
    if ((mode === 'add' || mode === 'line' || mode === 'reposition') && creationStart && containerRef.current) {
        setCurrentMousePos(getRelativeCoordinates(e.clientX, e.clientY));
    }
  }, [draggingPointId, dragType, rotation, scale, mode, creationStart]);

  const handleGlobalMouseUp = useCallback(() => {
    setDraggingPointId(null);
    setIsPanning(false);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggingPointId, dragType, handleGlobalMouseMove, handleGlobalMouseUp]);

  const handleContainerMouseDown = (e: React.MouseEvent) => {
      if (mode !== 'pan' || !containerWrapperRef.current) return;
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setScrollStart({ left: containerWrapperRef.current.scrollLeft, top: containerWrapperRef.current.scrollTop });
  };
  const handleContainerMouseMove = (e: React.MouseEvent) => {
      if (!isPanning || !containerWrapperRef.current) return;
      containerWrapperRef.current.scrollLeft = scrollStart.left - (e.clientX - panStart.x);
      containerWrapperRef.current.scrollTop = scrollStart.top - (e.clientY - panStart.y);
  };
  
  const handleDeletePoint = (id: string) => {
    setPoints(prev => prev.filter(p => p.id !== id).map((p, i) => ({ ...p, number: i + 1 })));
    if (selectedPointId === id) setSelectedPointId(null);
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-slate-100 font-sans">
      <Topbar 
        mode={mode} setMode={setMode} scale={scale}
        onZoomIn={() => setScale(s => Math.min(s + 0.2, 5))}
        onZoomOut={() => setScale(s => Math.max(s - 0.2, 0.1))}
        onResetZoom={() => { setScale(1); setRotation(0); }}
        rotation={rotation} setRotation={setRotation}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        activeLineColor={activeLineColor} setActiveLineColor={setActiveLineColor}
        onSaveProject={handleSaveProject} onOpenProjectManager={() => setShowManagerModal(true)}
        onExportImage={() => renderMapToBlob(imageSrc!, points, lines, markerScale).then(b => {
             if (b) { const url = URL.createObjectURL(b); const a = document.createElement('a'); a.href = url; a.download = 'export_cantiere.jpg'; a.click(); }
        })} 
        onExportPDF={() => generatePDF(imageSrc!, points, lines, markerScale, planName)}
        hasImage={!!imageSrc} markerScale={markerScale}
        onIncreaseMarkerSize={() => setMarkerScale(s => Math.min(s + 0.2, 3))}
        onDecreaseMarkerSize={() => setMarkerScale(s => Math.max(s - 0.2, 0.5))}
        onBulkImageUpload={(e) => {}} onNewProject={handleNewProject}
      />
      <div className="flex flex-1 relative overflow-hidden">
          <div className="flex-1 relative bg-slate-200 overflow-hidden">
            {showPdfPreview && pdfPreviewUrl && (
                 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
                     <div className="bg-white w-full h-full max-w-6xl rounded-lg flex flex-col overflow-hidden">
                         <div className="flex justify-between items-center p-4 border-b bg-slate-50">
                             <h3 className="font-bold text-slate-800">Anteprima Report Tecnico</h3>
                             <button onClick={() => setShowPdfPreview(false)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-6 h-6" /></button>
                         </div>
                         <div className="flex-1 bg-slate-100"><object data={pdfPreviewUrl} type="application/pdf" className="w-full h-full" /></div>
                     </div>
                 </div>
            )}
            {showProjectModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200">
                        <h2 className="text-xl font-bold mb-4 text-slate-800">Nuova Planimetria</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nome Progetto / Cantiere</label>
                                <input type="text" value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="Es. Condominio Roma" className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Piano / Area</label>
                                <input type="text" value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="Es. Piano Terra" className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"/>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowProjectModal(false)} className="px-4 py-2 font-bold text-slate-500 hover:text-slate-700">Annulla</button>
                            <button onClick={confirmProjectDetails} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95">Inizia Mappatura</button>
                        </div>
                    </div>
                </div>
            )}
            <ProjectManager isOpen={showManagerModal} onClose={() => setShowManagerModal(false)} onLoadProject={handleLoadSavedProject}/>
            {!imageSrc && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center m-8 rounded-2xl border-4 border-dashed border-slate-300 bg-white/60">
                    <Maximize className="w-20 h-20 mb-4 text-slate-300" />
                    <h1 className="text-3xl font-black text-slate-800 mb-2">SiteMapper Pro</h1>
                    <p className="max-w-md mb-8 text-slate-500 font-medium">L'assistente digitale per la gestione mappature e rilievi tecnici in cantiere.</p>
                    <label className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-10 rounded-2xl shadow-xl cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center gap-3">
                        <Maximize className="w-5 h-5" />
                        Apri Planimetria (Immagine)
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUploadStart} />
                    </label>
                </div>
            )}
            {imageSrc && (
                <div ref={containerWrapperRef} onMouseDown={handleContainerMouseDown} onMouseMove={handleContainerMouseMove}
                    className={`absolute inset-0 overflow-auto bg-slate-200 grid place-items-center ${mode === 'pan' ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair'}`}
                >
                    <div style={{ width: `${imgSize.w * scale}px`, height: `${imgSize.h * scale}px` }} className="relative shadow-2xl bg-white flex-none">
                        <div ref={containerRef} className="w-full h-full relative" style={{ transform: `rotate(${rotation}deg)` }} onMouseDown={handleMapMouseDown} onMouseUp={handleMapMouseUp}>
                            <img src={imageSrc} alt="Map" className="w-full h-full object-contain pointer-events-none" draggable={false} />
                            <svg className="absolute inset-0 w-full h-full z-0 pointer-events-none">
                                {lines.map(line => (
                                    <line key={line.id} x1={`${line.startX}%`} y1={`${line.startY}%`} x2={`${line.endX}%`} y2={`${line.endY}%`} stroke={line.color} strokeWidth={3 * markerScale} strokeOpacity={0.8} />
                                ))}
                                {points.map(p => (p.targetX !== undefined && p.targetY !== undefined) && (
                                    <g key={`line-${p.id}`}>
                                        <line x1={`${p.targetX}%`} y1={`${p.targetY}%`} x2={`${p.x}%`} y2={`${p.y}%`} stroke="#dc2626" strokeWidth={1 * markerScale} strokeDasharray="3,3" />
                                        <circle cx={`${p.targetX}%`} cy={`${p.targetY}%`} r={3 * markerScale} fill="#dc2626" onMouseDown={(e) => handleTargetMouseDown(e, p.id)} className="pointer-events-auto cursor-move"/>
                                    </g>
                                ))}
                            </svg>
                            {points.map((point) => (
                                <Marker key={point.id} point={point} scale={scale} markerScale={markerScale} isSelected={selectedPointId === point.id} onMouseDown={handleMarkerMouseDown} onDelete={handleDeletePoint} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
          </div>
          <Sidebar 
            points={points} 
            isOpen={isSidebarOpen} 
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)} 
            onDeletePoint={handleDeletePoint} 
            onSelectPoint={setSelectedPointId} 
            onUpdatePoint={updatePoint} 
            onRepositionPoint={() => setMode('reposition')} 
            selectedPointId={selectedPointId} 
            onExportJSON={handleSaveProject} 
            onImportJSON={handleImportJSON} 
            onPreviewPDF={() => generatePDF(imageSrc!, points, lines, markerScale, planName, true).then(url => { if (url) { setPdfPreviewUrl(url); setShowPdfPreview(true); } })} 
            imageName={imageName} 
            planName={planName} 
            floor={floor} 
            isRepositioning={mode === 'reposition'} 
          />
      </div>
    </div>
  );
}
