
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

export const Marker: React.FC<MarkerProps> = ({ 
  point, 
  markerScale,
  isSelected, 
  onMouseDown,
}) => {
  
  // Base dimensions
  const size = 32 * markerScale; // Diameter of the main circle
  const fontSize = 14 * markerScale;
  
  // Appendix dimensions (Typology)
  const appendixFontSize = 11 * markerScale;
  const appendixPadding = 3 * markerScale;

  const showTypology = point.typology && point.typology.trim() !== '';

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
      {/* Container for the marker composition */}
      <div className="relative">
        
        {/* Main Circle (Sequential Number) */}
        <div 
          className={`
            flex items-center justify-center 
            rounded-full shadow-md border-2 font-bold
            transition-colors duration-200
            ${isSelected 
              ? 'bg-blue-600 border-white text-white ring-2 ring-blue-300' 
              : 'bg-red-600 border-white text-white'}
          `}
          style={{
            width: `${size}px`,
            height: `${size}px`,
            fontSize: `${fontSize}px`,
            lineHeight: 1,
            zIndex: 10
          }}
        >
          {point.number}
        </div>

        {/* Typology Appendix (Square Label) - Top Right */}
        {showTypology && (
          <div 
            className={`
              absolute flex items-center justify-center font-bold shadow-sm border
              whitespace-nowrap z-20 rounded-[4px]
              ${isSelected 
                  ? 'bg-white text-blue-600 border-blue-600' 
                  : 'bg-white text-red-600 border-red-600'}
            `}
            style={{
              top: `-${size * 0.3}px`,    // Offset upwards
              left: `${size * 0.7}px`,    // Offset right
              fontSize: `${appendixFontSize}px`,
              padding: `${appendixPadding}px`,
              minWidth: `${size * 0.6}px`, // Minimum width relative to marker
              height: `${size * 0.6}px`,   // Fixed height relative to marker
              lineHeight: 1
            }}
          >
            {point.typology}
          </div>
        )}

      </div>

      {/* Hover tooltip for description */}
      <div 
        className="absolute bottom-full mb-3 opacity-0 group-hover:opacity-100 bg-black/80 text-white px-2 py-1 rounded pointer-events-none whitespace-nowrap backdrop-blur-sm transition-opacity z-50"
        style={{ fontSize: '12px' }}
      >
        {point.description || `Punto ${point.number}`}
      </div>
    </div>
  );
};
