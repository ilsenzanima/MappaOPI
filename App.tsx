
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Marker } from './components/Marker';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { ProjectManager } from './components/ProjectManager';
import { MapPoint, ProjectState, InteractionMode, SavedProject, MapLine, LineColor } from './types';
import { Maximize, Check, Trash2, X, ExternalLink } from 'lucide-react';
import { saveProject } from './db';
import { renderMapToBlob, generatePDF } from './utils';

const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15);
};

export default function App() {
  // State: Data
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

  // State: UI & Modes
  const [mode, setMode] = useState<InteractionMode>('pan');
  const [activeLineColor, setActiveLineColor] = useState<LineColor>('#dc2626');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [scale, setScale] = useState(1);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  
  // State: Modals
  const [showProjectModal, setShowProjectModal] = useState(false); 
  const [showManagerModal, setShowManagerModal] = useState(false); 
  const [tempImageFile, setTempImageFile] = useState<File | null>(null);
  const [pendingImageName, setPendingImageName] = useState<string | null>(null);

  // PDF Preview State
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  // Dragging state (Markers)
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'badge' | 'target'>('badge');
  
  // Creation state (Add Point / Line)
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
      // Data reset
      setPoints([]);
      setLines([]);
      setPlanName('');
      setFloor('');
      setImageSrc(null);
      setImageName(null);
      setImgSize({ w: 0, h: 0 });
      setCurrentProjectId(undefined);
      
      // UI reset
      setScale(1);
      setRotation(0);
      setMarkerScale(1);
      setSelectedPointId(null);
      setSelectedLineId(null);
      setMode('pan');
      
      // Cleanup temp states
      setPendingImageName(null);
      setTempImageFile(null);
      setCreationStart(null);
      setCurrentMousePos(null);
      setDraggingPointId(null);
  };

  const handleNewProject = () => {
      if (imageSrc || points.length > 0) {
          if (window.confirm('Sei sicuro di voler creare un nuovo progetto? Tutti i dati non salvati andranno persi.')) {
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
            lines,
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
      setSelectedPointId(null);
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

  // --- Handlers: Bulk Image Upload ---
  const handleBulkImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!window.confirm(`Stai per caricare ${files.length} foto. Il sistema tenterà di assegnarle automaticamente ai punti basandosi sul nome del file (es. "..._1.jpg" -> Punto 1). Vuoi procedere?`)) {
        e.target.value = '';
        return;
    }

    const fileArray: File[] = Array.from(files);
    let matchedCount = 0;
    const pointsMap = new Map<number, MapPoint>(points.map(p => [p.number, p]));
    const regex = /_(\d+)(?:_\d+)?\.[^.]+$/;

    const promises = fileArray.map(file => {
        return new Promise<void>((resolve) => {
            const match = file.name.match(regex);
            if (match && match[1]) {
                const pointNum = parseInt(match[1], 10);
                const point = pointsMap.get(pointNum);
                
                if (point) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        if (event.target?.result && typeof event.target.result === 'string') {
                            const newImg = event.target.result;
                            const p = pointsMap.get(pointNum);
                            if (p) {
                                const existing = p.images || [];
                                pointsMap.set(pointNum, {
                                    ...p,
                                    images: [...existing, newImg]
                                });
                                matchedCount++;
                            }
                        }
                        resolve();
                    };
                    reader.readAsDataURL(file);
                } else {
                    resolve();
                }
            } else {
                resolve();
            }
        });
    });

    await Promise.all(promises);
    setPoints(Array.from(pointsMap.values()));
    alert(`Caricamento completato! ${matchedCount} foto assegnate ai punti.`);
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

  // --- Handlers: Map Interaction (Creation & Dragging) ---

  const handleMapMouseDown = (e: React.MouseEvent) => {
      if (mode === 'add' || mode === 'line' || mode === 'reposition') {
         if (!imageSrc || !containerRef.current) return;
         const coords = getRelativeCoordinates(e.clientX, e.clientY);
         if (coords.x < 0 || coords.x > 100 || coords.y < 0 || coords.y > 100) return;
         
         setCreationStart(coords);
         setCurrentMousePos(coords);
      }
      
      if (mode !== 'pan') {
          setSelectedLineId(null);
      }
  };

  const handleMapMouseUp = (e: React.MouseEvent) => {
      if (!creationStart) return;
      const endCoords = getRelativeCoordinates(e.clientX, e.clientY);

      if (mode === 'reposition' && selectedPointId) {
          const dx = endCoords.x - creationStart.x;
          const dy = endCoords.y - creationStart.y;
          const dist = Math.sqrt(dx*dx + dy*dy);

          setPoints(prev => prev.map(p => {
              if (p.id === selectedPointId) {
                  if (dist > 1.0) {
                      return {
                          ...p,
                          x: endCoords.x,
                          y: endCoords.y,
                          targetX: creationStart.x,
                          targetY: creationStart.y
                      };
                  } else {
                      return {
                          ...p,
                          x: endCoords.x,
                          y: endCoords.y,
                          targetX: endCoords.x, 
                          targetY: endCoords.y
                      };
                  }
              }
              return p;
          }));
          
          setMode('pan');
          setCreationStart(null);
          setCurrentMousePos(null);
          return;
      }

      if (mode === 'add') {
          const dx = endCoords.x - creationStart.x;
          const dy = endCoords.y - creationStart.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          const nextNum = points.length + 1;

          const newPoint: MapPoint = {
              id: generateId(),
              number: nextNum,
              typology: nextNum.toString(),
              x: endCoords.x, 
              y: endCoords.y,
              description: '',
              createdAt: Date.now(),
          };

          if (dist > 1.0) {
              newPoint.targetX = creationStart.x;
              newPoint.targetY = creationStart.y;
          } else {
              newPoint.targetX = endCoords.x;
              newPoint.targetY = endCoords.y;
          }

          setPoints(prev => [...prev, newPoint]);
          setSelectedPointId(newPoint.id);
      } else if (mode === 'line') {
          const dx = endCoords.x - creationStart.x;
          const dy = endCoords.y - creationStart.y;
          if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
              const newLine: MapLine = {
                  id: generateId(),
                  startX: creationStart.x,
                  startY: creationStart.y,
                  endX: endCoords.x,
                  endY: endCoords.y,
                  color: activeLineColor
              };
              setLines(prev => [...prev, newLine]);
          }
      }

      setCreationStart(null);
      setCurrentMousePos(null);
  };

  const handleMarkerMouseDown = (e: React.MouseEvent, id: string) => {
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

  const handleLineClick = (e: React.MouseEvent, id: string) => {
      if (mode === 'pan') return; 
      e.stopPropagation();
      setSelectedLineId(id);
  };

  const handleDeleteLine = (id: string) => {
      setLines(prev => prev.filter(l => l.id !== id));
      setSelectedLineId(null);
  };

  const updatePoint = (id: string, data: Partial<MapPoint>) => {
      setPoints(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  };

  const handleRepositionPoint = () => {
      if (selectedPointId) {
          setMode('reposition');
      }
  };

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (draggingPointId && containerRef.current) {
        const { x, y } = getRelativeCoordinates(e.clientX, e.clientY);
        setPoints(prev => prev.map(p => {
             if (p.id !== draggingPointId) return p;
             if (dragType === 'target') {
                 return {
                     ...p,
                     targetX: Math.max(0, Math.min(100, x)),
                     targetY: Math.max(0, Math.min(100, y))
                 };
             } else {
                 return { 
                     ...p, 
                     x: Math.max(0, Math.min(100, x)), 
                     y: Math.max(0, Math.min(100, y)) 
                 };
             }
        }));
    }

    if ((mode === 'add' || mode === 'line' || mode === 'reposition') && creationStart && containerRef.current) {
        const coords = getRelativeCoordinates(e.clientX, e.clientY);
        setCurrentMousePos(coords);
    }
  }, [draggingPointId, dragType, rotation, scale, mode, creationStart]);

  const handleGlobalMouseUp = useCallback(() => {
    setDraggingPointId(null);
    setIsPanning(false);
    document.body.style.cursor = '';
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
      e.preventDefault();
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

  const handleExportJSON = () => {
    const data: ProjectState = {
      version: 1,
      planName,
      floor,
      imageName: imageName || '',
      rotation,
      markerScale,
      points: points,
      lines: lines
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
        const json = JSON.parse(event.target?.result as string);
        
        // Normalize the JSON structure: could be [{...}] or {...}
        let reportData = null;
        if (Array.isArray(json) && json.length > 0 && json[0].dati) {
            reportData = json[0];
        } else if (json.dati) {
            reportData = json;
        }

        if (reportData && Array.isArray(reportData.dati)) {
            let shouldMerge = false;
            if (points.length > 0) {
                 const wantToMerge = window.confirm(
                    `Rilevati punti esistenti.\n\nVUOI AGGIORNARE I DATI?\nPremendo OK: Aggiornerai solo descrizioni e tipologici dei punti corrispondenti (mantenendo foto e posizioni attuali).\nPremendo ANNULLA: Cancellerai tutto e importerai i nuovi punti da zero.`
                 );
                 if (wantToMerge) shouldMerge = true;
                 else {
                    if (!window.confirm("Sei sicuro di voler sovrascrivere tutto? Le foto e le posizioni attuali andranno perse.")) {
                        e.target.value = '';
                        return;
                    }
                 }
            }

            const rawData = reportData.dati;
            
            if (shouldMerge) {
                 const updatedPoints = [...points];
                 let updatesCount = 0;
                 let newCount = 0;

                 rawData.forEach((item: any, idx: number) => {
                     const num = parseInt(item['N Foto']);
                     if (isNaN(num)) return;
                     const existingIndex = updatedPoints.findIndex(p => p.number === num);

                     if (existingIndex !== -1) {
                         updatedPoints[existingIndex] = {
                             ...updatedPoints[existingIndex],
                             description: item['Descrizione Completa'] || updatedPoints[existingIndex].description,
                             typology: (item['N Tipologico'] || updatedPoints[existingIndex].typology).toString()
                         };
                         updatesCount++;
                     } else {
                         // Grid positioning for new points
                         const x = 5 + (newCount % 10) * 9;
                         const y = 5 + Math.floor(newCount / 10) * 12;
                         updatedPoints.push({
                             id: generateId(),
                             number: num,
                             typology: (item['N Tipologico'] || '').toString(),
                             description: item['Descrizione Completa'] || '',
                             x, y,
                             createdAt: Date.now()
                         });
                         newCount++;
                     }
                 });
                 setPoints(updatedPoints);
                 if (reportData.piano) setFloor(reportData.piano);
                 alert(`Aggiornamento completato!\n${updatesCount} punti aggiornati.\n${newCount} nuovi punti aggiunti (disposti in griglia).`);
            } else {
                const newPoints: MapPoint[] = [];
                rawData.forEach((item: any, idx: number) => {
                    const num = parseInt(item['N Foto']) || (idx + 1);
                    // Distribute points in a grid starting from top-left (5,5)
                    const x = 5 + (idx % 10) * 9;
                    const y = 5 + Math.floor(idx / 10) * 12;
                    newPoints.push({
                        id: generateId(),
                        number: num,
                        typology: (item['N Tipologico'] || '').toString(),
                        description: item['Descrizione Completa'] || '',
                        x, y,
                        createdAt: Date.now()
                    });
                });
                setPoints(newPoints);
                if (reportData.piano) setFloor(reportData.piano);
                alert(`Importati ${newPoints.length} punti. Sono stati disposti in una griglia ordinata per facilitarne il posizionamento.`);
            }
            e.target.value = '';
            return;
        }

        // Standard Legacy formats
        if (Array.isArray(json)) {
            if (points.length > 0) {
                if (!window.confirm(`Hai importato una lista di ${json.length} punti. Vuoi sovrascrivere i punti attuali?`)) {
                    e.target.value = '';
                    return;
                }
            }
            const importedPoints: MapPoint[] = json.map((item: any, index: number) => {
                const x = 5 + (index % 10) * 9;
                const y = 5 + Math.floor(index / 10) * 12;
                return {
                    id: generateId(),
                    number: item.number || (index + 1),
                    typology: (item.typology || item.number || (index + 1)).toString(),
                    description: item.description || '',
                    x, y,
                    createdAt: Date.now()
                };
            });
            setPoints(importedPoints);
            alert(`Importati ${importedPoints.length} punti.`);
            e.target.value = '';
            return;
        }

        const projectState = json as ProjectState;
        if (projectState.points && Array.isArray(projectState.points)) {
            if (points.length > 0) {
                if (!window.confirm("Sovrascrivere i dati attuali con il backup completo?")) {
                    e.target.value = '';
                    return;
                }
            }
            const importedPoints = projectState.points.map(p => ({ 
                ...p, 
                typology: (p.typology || p.number).toString() 
            }));
            setPoints(importedPoints);
            setLines(projectState.lines || []);
            setPlanName(projectState.planName || 'Importato');
            setFloor(projectState.floor || '');
            setRotation(projectState.rotation || 0);
            setMarkerScale(projectState.markerScale || 1);
            setCurrentProjectId(undefined); 
            if (projectState.imageName && projectState.imageName !== imageName) {
                setPendingImageName(projectState.imageName);
                setImageSrc(null); 
                setImageName(null); 
                setImgSize({ w: 0, h: 0 });
            }
        }
      } catch (err) {
        alert("Errore file JSON. Assicurati che il formato sia corretto.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportImage = async () => {
      if (!imageSrc) return;
      const blob = await renderMapToBlob(imageSrc, points, lines, markerScale);
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
          alert("Si è verificato un errore durante l'esportazione della foto.");
      }
  };

  const handleExportPDF = async () => {
      if (!imageSrc) return;
      await generatePDF(imageSrc, points, lines, markerScale, planName, false);
  };
  
  const handlePreviewPDF = async () => {
    if (!imageSrc) return;
    const blobUrl = await generatePDF(imageSrc, points, lines, markerScale, planName, true);
    if (typeof blobUrl === 'string') {
        setPdfPreviewUrl(blobUrl);
        setShowPdfPreview(true);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-slate-100">
      <Topbar 
        mode={mode} setMode={setMode} scale={scale}
        onZoomIn={() => setScale(s => Math.min(s + 0.2, 5))}
        onZoomOut={() => setScale(s => Math.max(s - 0.2, 0.1))}
        onResetZoom={() => { setScale(1); setRotation(0); }}
        rotation={rotation} setRotation={setRotation}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        activeLineColor={activeLineColor} setActiveLineColor={setActiveLineColor}
        onSaveProject={handleSaveProject} onOpenProjectManager={() => setShowManagerModal(true)}
        onExportImage={handleExportImage} onExportPDF={handleExportPDF}
        hasImage={!!imageSrc} markerScale={markerScale}
        onIncreaseMarkerSize={() => setMarkerScale(s => Math.min(s + 0.2, 3))}
        onDecreaseMarkerSize={() => setMarkerScale(s => Math.max(s - 0.2, 0.5))}
        onBulkImageUpload={handleBulkImageUpload} onNewProject={handleNewProject}
      />
      <div className="flex flex-1 relative overflow-hidden">
          <div className="flex-1 relative bg-slate-200 overflow-hidden">
            {showPdfPreview && pdfPreviewUrl && (
                 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                     <div className="bg-white w-full h-full max-w-6xl rounded-lg shadow-2xl flex flex-col overflow-hidden">
                         <div className="flex justify-between items-center p-3 border-b bg-slate-50">
                             <div className="flex items-center gap-4">
                                <h3 className="font-bold text-slate-700">Anteprima Report PDF</h3>
                                <a href={pdfPreviewUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded hover:bg-blue-200 transition-colors font-medium">
                                    <ExternalLink className="w-3 h-3" /> Apri in nuova scheda
                                </a>
                             </div>
                             <button onClick={() => { setShowPdfPreview(false); URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(null); }} className="p-1 hover:bg-slate-200 rounded-full">
                                 <X className="w-6 h-6 text-slate-500" />
                             </button>
                         </div>
                         <div className="flex-1 bg-slate-200 relative">
                             <object data={pdfPreviewUrl} type="application/pdf" className="w-full h-full">
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-4 text-center">
                                    <p className="mb-4 text-lg font-medium">Impossibile visualizzare l'anteprima.</p>
                                    <a href={pdfPreviewUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 font-bold transition-transform hover:scale-105">
                                        <ExternalLink className="w-5 h-5" /> Apri PDF
                                    </a>
                                </div>
                             </object>
                         </div>
                     </div>
                 </div>
            )}
            {showProjectModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4 text-slate-800">Dettagli Planimetria</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Nome Planimetria</label>
                                <input type="text" value={planName} onChange={(e) => setPlanName(e.target.value)} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Piano</label>
                                <input type="text" value={floor} onChange={(e) => setFloor(e.target.value)} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"/>
                            </div>
                            <div className="pt-4 flex justify-end gap-2">
                                <button onClick={() => setShowProjectModal(false)} className="px-4 py-2 text-slate-500 hover:text-slate-700">Annulla</button>
                                <button onClick={confirmProjectDetails} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold">Conferma</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <ProjectManager isOpen={showManagerModal} onClose={() => setShowManagerModal(false)} onLoadProject={handleLoadSavedProject}/>
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
            {imageSrc && (
                <div ref={containerWrapperRef} onMouseDown={handleContainerMouseDown} onMouseMove={handleContainerMouseMove}
                    className={`absolute inset-0 overflow-auto bg-slate-200 grid place-items-center
                        ${mode === 'pan' ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''}
                        ${(mode === 'add' || mode === 'line' || mode === 'reposition') ? 'cursor-crosshair' : ''}
                        ${mode === 'move' ? 'cursor-default' : ''}
                    `}
                >
                    <div style={{ width: `${imgSize.w * scale}px`, height: `${imgSize.h * scale}px` }} className="relative shadow-2xl bg-white select-none flex-none">
                        <div ref={containerRef} className="w-full h-full relative" style={{ transform: `rotate(${rotation}deg)` }} onMouseDown={handleMapMouseDown} onMouseUp={handleMapMouseUp}>
                            <img src={imageSrc} alt="Planimetria" className="w-full h-full object-contain pointer-events-none block" draggable={false} />
                            <svg className="absolute inset-0 w-full h-full z-0 pointer-events-none">
                                {lines.map(line => (
                                    <g key={line.id} className="pointer-events-auto cursor-pointer" onClick={(e) => handleLineClick(e, line.id)}>
                                        <line x1={`${line.startX}%`} y1={`${line.startY}%`} x2={`${line.endX}%`} y2={`${line.endY}%`} stroke="transparent" strokeWidth={15 * markerScale} />
                                        <line x1={`${line.startX}%`} y1={`${line.startY}%`} x2={`${line.endX}%`} y2={`${line.endY}%`} stroke={line.color} strokeWidth={3 * markerScale} strokeOpacity={0.8} strokeLinecap="round" className={selectedLineId === line.id ? 'filter drop-shadow-[0_0_2px_rgba(0,0,0,0.5)]' : ''}/>
                                    </g>
                                ))}
                                {mode === 'line' && creationStart && currentMousePos && (
                                    <line x1={`${creationStart.x}%`} y1={`${creationStart.y}%`} x2={`${currentMousePos.x}%`} y2={`${currentMousePos.y}%`} stroke={activeLineColor} strokeWidth={3 * markerScale} strokeOpacity={0.6}/>
                                )}
                                {points.map(p => (p.targetX !== undefined && p.targetY !== undefined && (Math.abs(p.targetX - p.x) > 0.1 || Math.abs(p.targetY - p.y) > 0.1)) ? (
                                    <g key={`line-${p.id}`}>
                                        <line x1={`${p.targetX}%`} y1={`${p.targetY}%`} x2={`${p.x}%`} y2={`${p.y}%`} stroke="#dc2626" strokeWidth={2 * markerScale} strokeLinecap="round" />
                                        <circle cx={`${p.targetX}%`} cy={`${p.targetY}%`} r={3 * markerScale} fill="#dc2626" className={mode === 'move' ? 'cursor-move pointer-events-auto hover:fill-blue-600' : ''} onMouseDown={(e) => handleTargetMouseDown(e, p.id)}/>
                                    </g>
                                ) : null)}
                                {(mode === 'add' || mode === 'reposition') && creationStart && currentMousePos && (
                                     <g>
                                        <line x1={`${creationStart.x}%`} y1={`${creationStart.y}%`} x2={`${currentMousePos.x}%`} y2={`${currentMousePos.y}%`} stroke="#dc2626" strokeWidth={2 * markerScale} strokeDasharray="5,5"/>
                                        <circle cx={`${creationStart.x}%`} cy={`${creationStart.y}%`} r={3 * markerScale} fill="#dc2626" />
                                     </g>
                                )}
                            </svg>
                            {selectedLineId && (() => {
                                const line = lines.find(l => l.id === selectedLineId);
                                if (!line) return null;
                                return (
                                    <button onClick={() => handleDeleteLine(line.id)} className="absolute z-20 bg-white text-red-600 rounded-full p-1 shadow-md border border-red-200 hover:bg-red-50" style={{ left: `${(line.startX + line.endX) / 2}%`, top: `${(line.startY + line.endY) / 2}%`, transform: 'translate(-50%, -50%)' }}><Trash2 className="w-4 h-4" /></button>
                                );
                            })()}
                            {points.map((point) => (
                                <Marker key={point.id} point={point} scale={scale} markerScale={markerScale} isSelected={selectedPointId === point.id} onMouseDown={handleMarkerMouseDown} onDelete={handleDeletePoint} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
          </div>
          <Sidebar points={points} isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} onDeletePoint={handleDeletePoint} onSelectPoint={setSelectedPointId} onUpdatePoint={updatePoint} onRepositionPoint={handleRepositionPoint} selectedPointId={selectedPointId} onExportJSON={handleExportJSON} onImportJSON={handleImportJSON} onPreviewPDF={handlePreviewPDF} imageName={imageName} planName={planName} floor={floor} isRepositioning={mode === 'reposition'} />
      </div>
    </div>
  );
}
