
import React from 'react';
import { MapPoint } from '../types';

interface MarkerProps {
  point: MapPoint;
  scale: number; 
  markerScale: number; 
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, pointId: string) => void;
  onDelete: (pointId: string) => void;
}

// Funzione helper per ordinare i tipologici numericamente
const sortTypology = (typology: string): string => {
  if (!typology) return "";
  return typology
    .split(/[,\s/]+/) // Divide per virgola, spazio o slash
    .filter(t => t.trim() !== "")
    .sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (isNaN(numA) || isNaN(numB)) return a.localeCompare(b); // Fallback alfabetico se non numerico
      return numA - numB;
    })
    .join(", ");
};

export const Marker: React.FC<MarkerProps> = ({ 
  point, 
  markerScale,
  isSelected, 
  onMouseDown,
}) => {
  const size = 32 * markerScale;
  const fontSize = 12 * markerScale;
  const appendixFontSize = 10 * markerScale;
  const appendixPadding = 2 * markerScale;

  // Mostriamo la tipologia ORDINATA al centro.
  const rawTypology = point.typology && point.typology.trim() !== '' ? point.typology : "-";
  const mainText = rawTypology !== "-" ? sortTypology(rawTypology) : "-";
  const appendixText = point.number.toString();
  
  const baseBg = isSelected ? 'bg-blue-600' : 'bg-red-600';
  const baseBorder = isSelected ? 'border-white' : 'border-white';
  const textClass = 'text-white';

  return (
    <div
      className={`absolute flex flex-col items-center justify-center cursor-move group transition-transform duration-75 z-10`}
      style={{
        left: `${point.x}%`,
        top: `${point.y}%`,
        transform: 'translate(-50%, -50%)', 
      }}
      onMouseDown={(e) => {
        e.stopPropagation(); 
        onMouseDown(e, point.id);
      }}
    >
      <div className="relative">
        {/* Corpo centrale - Tipologia Ordinata */}
        <div 
          className={`
            flex items-center justify-center 
            rounded-full shadow-lg border-2 font-bold px-2
            transition-all duration-200 whitespace-nowrap
            ${baseBg} ${baseBorder} ${textClass}
            ${isSelected ? 'ring-4 ring-blue-300 scale-110 z-30' : 'z-10'}
          `}
          style={{
            minWidth: `${size}px`,
            height: `${size}px`,
            fontSize: `${fontSize}px`,
            lineHeight: 1,
          }}
        >
          {mainText}
        </div>

        {/* Appendice in apice - Numero Intervento */}
        <div 
          className={`
            absolute flex items-center justify-center font-black shadow-md border
            whitespace-nowrap z-20 rounded-md bg-white
            ${isSelected ? 'text-blue-600 border-blue-600' : 'text-slate-800 border-slate-300'}
          `}
          style={{
            top: `-${size * 0.4}px`,
            left: `80%`,
            fontSize: `${appendixFontSize}px`,
            padding: `${appendixPadding}px ${appendixPadding * 2}px`,
            minWidth: `${size * 0.5}px`,
            height: `${size * 0.5}px`,
            lineHeight: 1
          }}
        >
          {appendixText}
        </div>
      </div>

      <div 
        className="absolute bottom-full mb-4 opacity-0 group-hover:opacity-100 bg-slate-800 text-white px-2 py-1 rounded-md pointer-events-none whitespace-nowrap backdrop-blur-sm transition-opacity z-50 text-[10px] font-medium"
      >
        {point.description || `Intervento ${point.number}`}
      </div>
    </div>
  );
};
