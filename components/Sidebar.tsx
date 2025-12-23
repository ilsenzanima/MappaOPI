
import React, { useState } from 'react';
import { MapPoint } from '../types';
import { 
  Trash2, MapPin, Download, Upload, X, Search, Hash, 
  Crosshair, Camera, Plus, Sparkles, Loader2, Info
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface SidebarProps {
  points: MapPoint[];
  isOpen: boolean;
  onToggle: () => void;
  onDeletePoint: (id: string) => void;
  onSelectPoint: (id: string) => void;
  onUpdatePoint: (id: string, data: Partial<MapPoint>) => void;
  onRepositionPoint: () => void;
  selectedPointId: string | null;
  onExportJSON: () => void;
  onImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPreviewPDF: () => void;
  imageName: string | null;
  planName: string;
  floor: string;
  isRepositioning: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  points, isOpen, onToggle, onDeletePoint, onSelectPoint, onUpdatePoint,
  onRepositionPoint, selectedPointId, onExportJSON, onImportJSON, onPreviewPDF,
  imageName, planName, floor, isRepositioning
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const selectedPoint = points.find(p => p.id === selectedPointId);

  const filteredPoints = points.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (p.description || '').toLowerCase().includes(term) || 
           p.number.toString().includes(term) || 
           (p.typology || '').toLowerCase().includes(term);
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedPoint || !e.target.files?.length) return;
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
          if (event.target?.result) {
              const currentImages = selectedPoint.images || [];
              onUpdatePoint(selectedPoint.id, { images: [...currentImages, event.target.result as string] });
          }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
  };

  const analyzeWithAI = async () => {
    if (!selectedPoint?.images?.length) return;
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const lastImage = selectedPoint.images[selectedPoint.images.length - 1];
      const base64Data = lastImage.split(',')[1];
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
              { text: "Sei un ispettore di cantiere esperto. Descrivi brevemente cosa vedi in questa foto di sopralluogo, concentrandoti su eventuali problemi tecnici, stato di avanzamento o materiali. Sii conciso e tecnico (max 25 parole)." }
            ]
          }
        ]
      });

      if (response.text) {
        const currentDesc = selectedPoint.description ? selectedPoint.description + "\n\n" : "";
        onUpdatePoint(selectedPoint.id, { description: currentDesc + "Note AI: " + response.text });
      }
    } catch (err) {
      console.error(err);
      alert("Errore durante l'analisi AI.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className={`fixed top-14 right-0 bottom-0 bg-white shadow-2xl border-l border-slate-200 transition-transform duration-300 z-40 flex flex-col w-80 max-w-[85vw] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-start shrink-0">
          <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 truncate">
                  <MapPin className="w-5 h-5 text-red-500 shrink-0" />
                  <span className="truncate">{planName || 'Nuovo Progetto'}</span>
              </h2>
              <div className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-wider">
                  {floor ? `Piano: ${floor}` : 'Piano non specificato'}
              </div>
          </div>
          <button onClick={onToggle} className="p-1 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
      </div>

      <div className="p-3 border-b border-slate-100 bg-white grid grid-cols-2 gap-2 shrink-0">
          <button onClick={onExportJSON} className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-3 rounded-lg text-xs font-bold transition-colors">
              <Download className="w-3 h-3" /> Esporta JSON
          </button>
          <label className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-3 rounded-lg cursor-pointer text-xs font-bold transition-colors">
              <Upload className="w-3 h-3" /> Importa JSON
              <input type="file" accept=".json" className="hidden" onChange={onImportJSON} />
          </label>
          <button onClick={onPreviewPDF} className="col-span-2 w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-2.5 px-3 rounded-lg text-xs font-bold shadow-md transition-all">
              <Sparkles className="w-3 h-3" /> Genera Report PDF
          </button>
      </div>

      {selectedPoint ? (
          <div className="p-4 bg-white border-b border-slate-200 overflow-y-auto max-h-[65vh] custom-scrollbar shrink-0">
              <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] font-bold">{selectedPoint.number}</span>
                    <span className="font-bold text-slate-700 text-sm">Dettagli Punto</span>
                  </div>
                  <button onClick={() => onDeletePoint(selectedPoint.id)} className="text-red-500 hover:text-red-700 text-xs font-bold p-1 rounded hover:bg-red-50 transition-colors flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Rimuovi
                  </button>
              </div>
              
              <button onClick={onRepositionPoint} className={`w-full mb-4 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${isRepositioning ? 'bg-amber-500 text-white animate-pulse' : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-400'}`}>
                  <Crosshair className={`w-4 h-4 ${isRepositioning ? 'animate-spin' : ''}`} />
                  {isRepositioning ? 'Trascina sulla mappa...' : 'Riposiziona Punto'}
              </button>

              <div className="mb-4">
                 <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">Identificativo / Sigla</label>
                 <div className="relative">
                     <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                     <input 
                        type="text" 
                        value={selectedPoint.typology || ''} 
                        onChange={(e) => onUpdatePoint(selectedPoint.id, { typology: e.target.value })} 
                        className="w-full pl-9 p-2.5 text-sm font-bold text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm" 
                        placeholder="Es. 15, 7, 16"
                     />
                 </div>
              </div>

              <div className="mb-4">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Note di Sopralluogo</label>
                    {selectedPoint.images?.length ? (
                        <button 
                            onClick={analyzeWithAI} 
                            disabled={isAnalyzing}
                            className="text-[10px] font-bold text-blue-600 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100 disabled:opacity-50 transition-colors"
                        >
                            {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            AI Assistant
                        </button>
                    ) : null}
                  </div>
                  <textarea 
                    value={selectedPoint.description || ''} 
                    onChange={(e) => onUpdatePoint(selectedPoint.id, { description: e.target.value })} 
                    placeholder="Descrivi lo stato o l'interferenza..." 
                    className="w-full text-sm p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-400 min-h-[100px] outline-none bg-white text-slate-900"
                  />
              </div>

              <div className="mb-2">
                  <label className="flex justify-between items-center text-[10px] font-black text-slate-500 mb-3 uppercase tracking-widest">
                      Foto Cantiere ({selectedPoint.images?.length || 0})
                      <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white p-2 rounded-lg shadow-lg transition-all active:scale-95">
                          <Plus className="w-4 h-4" />
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      </label>
                  </label>
                  
                  {selectedPoint.images?.length ? (
                      <div className="grid grid-cols-3 gap-2">
                          {selectedPoint.images.map((img, idx) => (
                              <div key={idx} className="relative group aspect-square rounded-lg border border-slate-200 overflow-hidden bg-slate-100">
                                  <img src={img} alt="" className="w-full h-full object-cover" />
                                  <button onClick={() => {
                                      const newImages = selectedPoint.images!.filter((_, i) => i !== idx);
                                      onUpdatePoint(selectedPoint.id, { images: newImages });
                                  }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><X className="w-3 h-3" /></button>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-400 flex flex-col items-center">
                           <Camera className="w-10 h-10 mb-2 opacity-20" />
                           <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Carica foto rilievo</span>
                      </div>
                  )}
              </div>
          </div>
      ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <Info className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">Seleziona un punto sulla mappa per visualizzare i dettagli o aggiungere foto.</p>
          </div>
      )}

      <div className="px-4 py-4 shrink-0 bg-white border-t border-slate-100">
          <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Cerca tra i punti..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 transition-all outline-none"/>
          </div>
      </div>

      {points.length > 0 && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 bg-slate-50">
            <div className="space-y-2">
                {filteredPoints.map((point) => (
                  <div key={point.id} onClick={() => onSelectPoint(point.id)} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedPointId === point.id ? 'bg-white border-blue-500 shadow-lg scale-[1.02]' : 'bg-white border-transparent hover:border-slate-200 shadow-sm'}`}>
                      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white ${selectedPointId === point.id ? 'bg-blue-600' : 'bg-red-600'}`}>
                        {point.number}
                      </div>
                      <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline">
                              <span className="text-[10px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded">#{point.typology || point.number}</span>
                              <span className="text-[9px] text-slate-400 font-bold uppercase">{new Date(point.createdAt).toLocaleDateString()}</span>
                          </div>
                          <p className="text-xs truncate font-medium text-slate-500 mt-1">{point.description || 'Nessuna nota tecnica...'}</p>
                      </div>
                      {point.images?.length ? <Camera className="w-4 h-4 text-slate-300" /> : null}
                  </div>
                ))}
            </div>
          </div>
      )}
    </div>
  );
};
