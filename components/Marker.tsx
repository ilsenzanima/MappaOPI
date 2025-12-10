
import React from 'react';
import { MapPoint } from '../types';
import { PointIcon } from './PointIcons';

interface MarkerProps {
  point: MapPoint;
  scale: number; // Map zoom scale (not used for sizing anymore, kept for prop compatibility or tooltip)
  markerScale: number; // User preference scale for symbols
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, pointId: string) => void;
  onDelete: (pointId: string) => void;
}

export const Marker: React.FC<MarkerProps> = ({ 
  point, 
  scale, 
  markerScale,
  isSelected, 
  onMouseDown,
}) => {
  // Since we are physically resizing the map container (width/height), 
  // we do NOT need to divide by 'scale' to keep markers constant size.
  // They are absolute positioned elements on a resizing canvas.
  // Their pixel size defined here will be their screen size.
  
  const baseSize = 40 * markerScale;
  const markerSize = baseSize; 
  
  // INCREASED BADGE SIZE
  // Was baseSize / 2.2 -> Now baseSize / 1.7 (Bigger circle)
  const badgeSize = (baseSize / 1.7);
  // Was baseSize / 3.5 -> Now baseSize / 2.6 (Bigger font)
  const badgeFontSize = (baseSize / 2.6);
  
  const iconSize = (baseSize / 1.6);

  return (
    <div
      className={`absolute flex flex-col items-center justify-center cursor-move group transition-transform duration-75 z-10`}
      style={{
        left: `${point.x}%`,
        top: `${point.y}%`,
        transform: 'translate(-50%, -50%)', // Center the symbol exactly on the coordinates
      }}
      onMouseDown={(e) => {
        e.stopPropagation(); // Prevent map drag or click
        onMouseDown(e, point.id);
      }}
    >
      {/* The visible marker container */}
      <div 
        className={`
          relative flex items-center justify-center 
          rounded-full shadow-lg border-2 
          transition-colors duration-200
          ${isSelected ? 'bg-blue-600 border-white text-white z-50 ring-2 ring-blue-300' : 'bg-white border-red-500 text-red-600'}
        `}
        style={{
          width: `${markerSize}px`,
          height: `${markerSize}px`,
        }}
      >
        {/* The Icon */}
        <div style={{ width: `${iconSize}px`, height: `${iconSize}px` }}>
            <PointIcon type={point.type} className="w-full h-full" />
        </div>

        {/* The Number Badge (Top Right) */}
        <div 
          className={`
            absolute -top-2 -right-2 flex items-center justify-center rounded-full shadow-sm font-bold border
            ${isSelected ? 'bg-white text-blue-700 border-blue-700' : 'bg-red-600 text-white border-white'}
          `}
          style={{
            width: `${badgeSize}px`,
            height: `${badgeSize}px`,
            fontSize: `${badgeFontSize}px`,
            lineHeight: 1
          }}
        >
          {point.number}
        </div>
      </div>

      {/* Hover tooltip for coordinates/desc */}
      <div 
        className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 bg-black/80 text-white px-2 py-1 rounded pointer-events-none whitespace-nowrap backdrop-blur-sm transition-opacity"
        style={{ fontSize: '12px' }}
      >
        <span className="font-bold">#{point.number}</span> {point.description ? `- ${point.description}` : ''}
      </div>
    </div>
  );
};
