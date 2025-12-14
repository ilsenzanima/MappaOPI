
import React, { useState } from 'react';
import { MapPoint } from '../types';
import { Trash2, MapPin, Download, Upload, X, Search, Hash, Crosshair, FileText, Eye } from 'lucide-react';

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
  points,
  isOpen,
  onToggle,
  onDeletePoint,
  onSelectPoint,
  onUpdatePoint,
  onRepositionPoint,
  selectedPointId,
  onExportJSON,
  onImportJSON,
  onPreviewPDF,
  imageName,
  planName,
  floor,
  isRepositioning
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const selectedPoint = points.find(p => p.id === selectedPointId);

  const filteredPoints = points.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const desc = (p.description || '').toLowerCase();
    const num = p.number.toString();
    const typo = (p.typology || '').toLowerCase();
    return desc.includes(term) || num.includes(term) || typo.includes(term);
  });

  return (
      <div
        className={`
          fixed top-14 right-0 bottom-0 bg-white shadow-2xl border-l border-gray-200
          transition-transform duration-300 ease-in-out z-40 flex flex-col
          w-80 max-w-[85vw]
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 bg-slate-50 flex justify-between items-start">
            <div className="min-w-0 flex-1 mr-2">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 truncate" title={planName}>
                    <MapPin className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <span className="truncate">{planName || 'Nuovo Progetto'}</span>
                </h2>
                <div className="text-xs text-slate-500 mt-1 flex flex-col min-w-0">
                    {floor && <span className="truncate">Piano: <strong>{floor}</strong></span>}
                    {imageName && <span className="truncate" title={imageName}>File: {imageName}</span>}
                </div>
            </div>
            <button onClick={onToggle} className="p-1 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0">
                <X className="w-5 h-5 text-slate-500" />
            </button>
        </div>

        {/* Data Actions (JSON & PDF) */}
        <div className="p-3 border-b border-gray-100 bg-white space-y-2">
            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={onExportJSON}
                    className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 px-3 rounded text-xs font-medium"
                >
                    <Download className="w-3 h-3" />
                    JSON
                </button>
                <label className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 px-3 rounded cursor-pointer text-xs font-medium">
                    <Upload className="w-3 h-3" />
                    JSON
                    <input type="file" accept=".json" className="hidden" onChange={onImportJSON} />
                </label>
            </div>
            <button
                onClick={onPreviewPDF}
                className="w-full flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 px-3 rounded text-xs font-bold border border-blue-200 transition-colors"
            >
                <Eye className="w-3 h-3" />
                Anteprima Report PDF
            </button>
        </div>

        {/* Selected Point Editor */}
        {selectedPoint && (
            <div className="p-4 bg-slate-50 border-b border-slate-200 animate-in slide-in-from-right-5 fade-in duration-200 flex-shrink-0">
                <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-slate-700 text-sm">Modifica Punto (ID: {selectedPoint.number})</span>
                    <button 
                        onClick={() => onDeletePoint(selectedPoint.id)}
                        className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-red-100 transition-colors"
                    >
                        <Trash2 className="w-3 h-3" /> Elimina
                    </button>
                </div>
                
                {/* Reposition Button */}
                <button
                    onClick={onRepositionPoint}
                    className={`w-full mb-3 flex items-center justify-center gap-2 py-2 rounded text-sm font-bold transition-colors ${
                        isRepositioning 
                        ? 'bg-amber-100 text-amber-700 border border-amber-300 animate-pulse' 
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    <Crosshair className={`w-4 h-4 ${isRepositioning ? 'animate-spin' : ''}`} />
                    {isRepositioning ? 'Clicca sulla mappa...' : 'Riposiziona in Mappa'}
                </button>

                {/* Typological Number Input */}
                <div className="mb-3">
                   <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Numero Tipologico</label>
                   <div className="relative">
                       <Hash className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                       <input 
                          type="text" 
                          value={selectedPoint.typology || ''} 
                          onChange={(e) => onUpdatePoint(selectedPoint.id, { typology: e.target.value })}
                          className="w-full pl-8 p-2 text-lg font-bold border border-slate-300 rounded shadow-sm focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 placeholder-slate-400"
                          placeholder="Es. 1, 2"
                       />
                   </div>
                   <p className="text-[10px] text-slate-500 mt-1">Questo numero appare sulla mappa.</p>
                </div>

                <div className="space-y-2">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Descrizione</label>
                        <textarea
                            value={selectedPoint.description || ''}
                            onChange={(e) => onUpdatePoint(selectedPoint.id, { description: e.target.value })}
                            placeholder="Inserisci note sul punto..."
                            className="w-full text-sm p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-400 outline-none resize-none h-16 bg-white text-slate-800"
                        />
                    </div>
                </div>
            </div>
        )}

        {/* Search Bar */}
        <div className="px-3 pt-3 pb-2 bg-slate-50/50 flex-shrink-0">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                <input
                    type="text"
                    placeholder="Cerca punti..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none transition-all bg-white"
                />
            </div>
        </div>

        {/* Points List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-slate-50/50">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
              {searchTerm ? `Risultati (${filteredPoints.length})` : 'Lista Punti'}
          </h3>
          
          {points.length === 0 ? (
            <div className="text-center text-gray-400 mt-10 p-4">
              <p className="text-sm">Nessun punto.</p>
            </div>
          ) : filteredPoints.length === 0 ? (
             <div className="text-center text-gray-400 mt-10 p-4">
                <p className="text-sm">Nessun punto trovato.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPoints.map((point) => (
                <div
                  key={point.id}
                  onClick={() => onSelectPoint(point.id)}
                  className={`
                    flex items-center gap-3 p-2 rounded border cursor-pointer transition-all
                    ${selectedPointId === point.id 
                      ? 'bg-white border-blue-400 ring-1 ring-blue-400 shadow-md' 
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}
                  `}
                >
                    {/* Visual Preview of the Marker */}
                    <div className={`
                      flex-shrink-0 min-w-[28px] h-7 px-1 rounded-full flex items-center justify-center border font-bold text-xs
                      ${selectedPointId === point.id ? 'bg-blue-600 text-white border-blue-700' : 'bg-red-600 text-white border-red-700'}
                    `}>
                      {point.number}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline">
                            <span className="text-[10px] text-gray-400 font-mono">ID: {point.number}</span>
                             {point.typology && point.typology !== point.number.toString() && (
                                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-1 rounded">#{point.typology}</span>
                             )}
                        </div>
                        <p className={`text-xs truncate ${point.description ? 'text-slate-800' : 'text-slate-400 italic'}`}>
                             {point.description || 'Nessuna descrizione'}
                        </p>
                    </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-2 border-t border-gray-200 bg-white text-[10px] text-gray-500 text-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            Totale punti: {points.length}
        </div>
      </div>
  );
};
